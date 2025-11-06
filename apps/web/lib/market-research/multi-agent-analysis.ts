/**
 * Multi-agent analysis system using OpenAI Agents SDK
 * Implements analyst → critic → aggregator loop
 */

import { Agent, run, setDefaultOpenAIKey } from '@openai/agents';
import { GradedSource, AnalysisResult, AgentAnalysis, Market } from './types';

/**
 * Run multi-agent analysis on market with graded sources
 */
export interface IntermediateResults {
  analystOutput: string;
  criticOutput: string;
  aggregatorOutput: string;
}

export async function runMultiAgentAnalysis(
  market: Market,
  gradedSources: GradedSource[]
): Promise<AnalysisResult & { intermediate?: IntermediateResults }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Verify API key format (should start with sk- or sk-proj-)
  if (!apiKey.startsWith('sk-')) {
    throw new Error('Invalid OPENAI_API_KEY format. API key should start with "sk-"');
  }

  // Set the OpenAI API key for the SDK (required for server-side usage)
  // According to the quickstart guide: https://openai.github.io/openai-agents-js/guides/quickstart/
  try {
    setDefaultOpenAIKey(apiKey);
    console.log('[Multi-Agent Analysis] OpenAI API key set successfully');
  } catch (error) {
    console.error('[Multi-Agent Analysis] Failed to set OpenAI API key:', error);
    throw new Error('Failed to configure OpenAI API key');
  }

  // Prepare context for agents
  const sourcesContext = formatSourcesForAnalysis(gradedSources);
  const marketContext = formatMarketForAnalysis(market);

  // Create Analyst Agent
  const analystAgent = new Agent({
    name: 'Analyst',
    instructions: `You are a market analyst specializing in prediction markets. Your role is to analyze provided sources and market data to determine the likelihood of a market outcome.

Market Question: ${market.question}
Market Context: ${marketContext}

Graded Sources (A-D):
${sourcesContext}

Your task:
1. Analyze all provided sources carefully
2. Identify key evidence supporting YES and NO outcomes
3. Assess the strength of the evidence
4. Consider the credibility and recency of sources
5. Provide your analysis with a confidence score (0-1) and clear reasoning

Format your response as:
ANALYSIS: [Your analysis of the evidence]
CONFIDENCE: [0-1 confidence score]
REASONING: [Your reasoning for the confidence score]`,
    model: 'gpt-4o', // Use gpt-4o (most capable model currently available)
  });

  // Create Critic Agent
  const criticAgent = new Agent({
    name: 'Critic',
    instructions: `You are a critical reviewer specializing in analyzing market predictions. Your role is to review the analyst's findings for accuracy, identify any biases, and assess completeness.

Review the analyst's findings and:
1. Check for accuracy and logical consistency
2. Identify any potential biases or blind spots
3. Assess if important factors were missed
4. Evaluate if the confidence score is justified
5. Provide constructive criticism

Format your response as:
REVIEW: [Your review of the analyst's findings]
ACCURACY: [Assessment of accuracy]
BIAS: [Any biases or blind spots identified]
COMPLETENESS: [Assessment of completeness]
CONFIDENCE: [Your confidence in the analyst's assessment, 0-1]`,
    model: 'gpt-4o',
  });

  // Create Aggregator Agent
  const aggregatorAgent = new Agent({
    name: 'Aggregator',
    instructions: `You are a synthesizer that combines insights from the analyst and critic into a final, balanced assessment.

Market Question: ${market.question}

Your task:
1. Synthesize the analyst's findings and critic's review
2. Create a balanced, final assessment
3. Resolve any conflicts between analyst and critic
4. Provide a final confidence score (0-1)
5. Give clear reasoning for the final assessment

Format your response as:
ASSESSMENT: [Final balanced assessment]
CONFIDENCE: [Final confidence score, 0-1]
REASONING: [Your reasoning for the final assessment and confidence]`,
    model: 'gpt-4o',
  });

  try {
    // Step 1: Run Analyst
    console.log('[Multi-Agent] Step 1/3: Running Analyst agent...');
    const analystPrompt = `Analyze the market question and graded sources to determine the likelihood of the outcome.`;
    const analystResult = await run(analystAgent, analystPrompt);
    const analystOutput = analystResult.finalOutput || '';
    console.log('[Multi-Agent] Step 1/3: Analyst agent completed');
    const analystAnalysis = parseAgentOutput(analystOutput, 'Analyst');

    // Step 2: Run Critic on Analyst's output
    console.log('[Multi-Agent] Step 2/3: Running Critic agent...');
    const criticPrompt = `Review the following analyst's findings:
${analystOutput}

Provide your critical review of the analyst's findings.`;
    const criticResult = await run(criticAgent, criticPrompt);
    const criticOutput = criticResult.finalOutput || '';
    console.log('[Multi-Agent] Step 2/3: Critic agent completed');
    const criticAnalysis = parseAgentOutput(criticOutput, 'Critic');

    // Step 3: Run Aggregator on both outputs
    console.log('[Multi-Agent] Step 3/3: Running Aggregator agent...');
    const aggregatorPrompt = `Synthesize the following analyst's findings and critic's review into a final assessment:

ANALYST FINDINGS:
${analystOutput}

CRITIC REVIEW:
${criticOutput}

Provide your final balanced assessment.`;
    const aggregatorResult = await run(aggregatorAgent, aggregatorPrompt);
    const aggregatorOutput = aggregatorResult.finalOutput || '';
    console.log('[Multi-Agent] Step 3/3: Aggregator agent completed');
    const aggregatorAnalysis = parseAgentOutput(aggregatorOutput, 'Aggregator');

    // Calculate overall confidence (weighted average)
    const overallConfidence = (
      analystAnalysis.confidence * 0.3 +
      criticAnalysis.confidence * 0.2 +
      aggregatorAnalysis.confidence * 0.5
    );

    return {
      analyst: analystAnalysis,
      critic: criticAnalysis,
      aggregator: aggregatorAnalysis,
      overallConfidence,
      intermediate: {
        analystOutput,
        criticOutput,
        aggregatorOutput,
      },
    };
  } catch (error) {
    console.error('[Multi-Agent Analysis] Error:', error);
    
    // If there's an authentication error, provide helpful message
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
      throw new Error('OpenAI API authentication failed. Please check your OPENAI_API_KEY environment variable.');
    }
    
    throw new Error(`Multi-agent analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Format sources for analysis
 */
function formatSourcesForAnalysis(gradedSources: GradedSource[]): string {
  return gradedSources
    .map((gs, index) => {
      const source = gs.source;
      return `Source ${index + 1} (Grade ${gs.grade}):
- Title: ${source.title}
- URL: ${source.url}
- Domain: ${source.domain || 'Unknown'}
- Published: ${source.publishedDate || 'Unknown'}
- Grade Explanation: ${gs.explanation}
- Content: ${source.content.substring(0, 500)}${source.content.length > 500 ? '...' : ''}`;
    })
    .join('\n\n');
}

/**
 * Format market for analysis
 */
function formatMarketForAnalysis(market: Market): string {
  const parts: string[] = [];
  
  if (market.question) {
    parts.push(`Question: ${market.question}`);
  }
  
  if (market.category) {
    parts.push(`Category: ${market.category}`);
  }
  
  if (market.endDate) {
    const endDate = new Date(market.endDate);
    const now = new Date();
    const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`End Date: ${endDate.toLocaleDateString()} (${daysUntil} days remaining)`);
  }
  
  if (market.resolutionSource) {
    parts.push(`Resolution Source: ${market.resolutionSource}`);
  }
  
  if (market.resolutionCriteria) {
    parts.push(`Resolution Criteria: ${market.resolutionCriteria}`);
  }
  
  if (market.outcomePrices) {
    const yesProb = ((market.outcomePrices.YES || 0) * 100).toFixed(1);
    parts.push(`Current Market Probability: ${yesProb}% YES`);
  }
  
  return parts.join('\n');
}

/**
 * Parse agent output to extract structured information
 */
function parseAgentOutput(output: string, agentName: string): AgentAnalysis {
  // Extract confidence score
  const confidenceMatch = output.match(/CONFIDENCE:\s*([0-9.]+)/i) || 
                          output.match(/confidence[:\s]+([0-9.]+)/i);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
  
  // Clamp confidence to 0-1
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  
  // Extract reasoning
  const reasoningMatch = output.match(/REASONING:\s*(.+?)(?:\n|$)/is) || 
                        output.match(/reasoning[:\s]+(.+?)(?:\n|$)/is);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Analysis provided';
  
  return {
    agentName,
    output,
    confidence: clampedConfidence,
    reasoning,
  };
}

