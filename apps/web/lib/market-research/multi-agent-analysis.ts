/**
 * Multi-agent analysis system using OpenAI Agents SDK
 * Implements research → analyst → critic → aggregator loop
 */

import { Agent, run, setDefaultOpenAIKey } from '@openai/agents';
import { GradedSource, AnalysisResult, AgentAnalysis, Market, ValyuResult, ResearchStrategy } from './types';

/**
 * Event context for multi-option events
 */
export interface EventContext {
  eventTitle: string;
  allMarkets: Market[];
  analyzedMarketId: string;
}

/**
 * Run research agent to gather information about the market
 */
export async function runResearchAgent(
  market: Market,
  researchStrategy: ResearchStrategy,
  eventContext?: EventContext
): Promise<ValyuResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Verify API key format
  if (!apiKey.startsWith('sk-')) {
    throw new Error('Invalid OPENAI_API_KEY format. API key should start with "sk-"');
  }

  // Set the OpenAI API key for the SDK
  try {
    setDefaultOpenAIKey(apiKey);
  } catch (error) {
    console.error('[Research Agent] Failed to set OpenAI API key:', error);
    throw new Error('Failed to configure OpenAI API key');
  }

  // Build instructions based on whether this is a multi-option event
  let instructions: string;
  
  // Get current year for time-sensitive queries
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const isSportsCategory = market.category?.toLowerCase().includes('sports');
  
  if (eventContext && eventContext.allMarkets.length > 1) {
    // Multi-option event: include ALL options dynamically
    const allOptionsList = eventContext.allMarkets.map((m, index) => {
      const isAnalyzed = m.id === market.id;
      return `- Option ${index + 1}: ${m.question}${isAnalyzed ? ' (THIS IS THE ONE BEING ANALYZED)' : ''}`;
    }).join('\n');

    const otherOptionsList = eventContext.allMarkets
      .filter(m => m.id !== market.id)
      .map(m => m.question)
      .join(', ');

    instructions = `You are a research agent specializing in prediction markets. This market is part of an event with multiple options.

${isSportsCategory ? `**CRITICAL FOR SPORTS MARKETS**: Focus on the MOST RECENT information available:
- Current ${currentYear} season standings, results, and performance
- Latest news from the past few weeks/months
- Recent race results, wins, points, and current form
- Current driver/team performance and momentum
- Breaking news and recent developments
- Upcoming races and schedule

Prioritize information from ${currentYear} and recent months over historical data.` : ''}

Event Question: ${eventContext.eventTitle}
All Options in Event (dynamically list ALL ${eventContext.allMarkets.length} options):
${allOptionsList}

Total Options: ${eventContext.allMarkets.length}
Option Being Analyzed: ${market.question}

Your task:
1. Focus your research on "${market.question}" - the specific option being analyzed
2. However, understand that "${market.question}" is competing against ALL ${eventContext.allMarkets.length - 1} other options: ${otherOptionsList}
3. Research "${market.question}" in the competitive context of this event
4. Compare "${market.question}"'s likelihood against ALL other options in the event
5. Understand the full competitive landscape - there are ${eventContext.allMarkets.length} total options
6. Generate comprehensive research content that helps assess "${market.question}"'s probability relative to ALL competitors

Research Strategy:
- Key Information Needed: ${researchStrategy.keyInformationNeeded.join(', ')}
- Search Queries: ${researchStrategy.searchQueries.join(', ')}
- Important Factors: ${researchStrategy.importantFactors.join(', ')}
- Timeline: ${researchStrategy.timelineConsiderations}

Generate research content as multiple sources (at least 5-7 sources) covering:
- **CURRENT NEWS AND RECENT INFORMATION** (PRIORITY): Latest news, recent developments, current standings, recent results, current form
- Current status of "${market.question}"
- Recent developments affecting "${market.question}"
- Competitive position vs ALL other options in the event
- Expert opinions and analysis comparing "${market.question}" to all competitors
- Historical context and precedents
- Relative strengths and weaknesses compared to each competitor

CRITICAL: Prioritize the MOST RECENT information available. For sports markets, include:
- Current season standings and recent performance
- Latest news articles and recent developments
- Recent wins, losses, and results
- Current form and momentum
- Upcoming fixtures and schedule
- Any breaking news or recent changes

Format your response as a structured list of research sources, each with:
- Title: [Source title]
- URL: [Actual URL if available - must be a real HTTP/HTTPS URL, not a placeholder]
- Content: [Comprehensive research content]
- Published Date: [Date if relevant]
- Domain: [Source domain if relevant]

IMPORTANT: Only include URLs that are actual web addresses (http:// or https://). If you reference sources, include their actual URLs. Do not create placeholder URLs like "research-1" or "source-1".`;
  } else {
    // Single-option market
    instructions = `You are a research agent specializing in prediction markets. Research the following market question:

Market Question: ${market.question}

${isSportsCategory ? `**CRITICAL FOR SPORTS MARKETS**: Focus on the MOST RECENT information available:
- Current ${currentYear} season standings, results, and performance
- Latest news from the past few weeks/months
- Recent race results, wins, points, and current form
- Current driver/team performance and momentum
- Breaking news and recent developments
- Upcoming races and schedule

Prioritize information from ${currentYear} and recent months over historical data.` : ''}

Research Strategy:
- Key Information Needed: ${researchStrategy.keyInformationNeeded.join(', ')}
- Search Queries: ${researchStrategy.searchQueries.join(', ')}
- Important Factors: ${researchStrategy.importantFactors.join(', ')}
- Timeline: ${researchStrategy.timelineConsiderations}

Generate comprehensive research content as multiple sources (at least 5-7 sources) covering:
- **CURRENT NEWS AND RECENT INFORMATION** (PRIORITY): Latest news, recent developments, current standings, recent results, current form
- Current status and recent developments
- Expert opinions and analysis
- Historical context and precedents
- Key factors affecting the outcome

CRITICAL: Prioritize the MOST RECENT information available. Include:
- Latest news articles and recent developments
- Current standings, rankings, or metrics
- Recent results, wins, losses, or changes
- Current form, momentum, or trends
- Breaking news or recent announcements
- Upcoming events or deadlines

Format your response as a structured list of research sources, each with:
- Title: [Source title]
- URL: [Actual URL if available - must be a real HTTP/HTTPS URL, not a placeholder]
- Content: [Comprehensive research content]
- Published Date: [Date if relevant]
- Domain: [Source domain if relevant]

IMPORTANT: Only include URLs that are actual web addresses (http:// or https://). If you reference sources, include their actual URLs. Do not create placeholder URLs like "research-1" or "source-1".`;
  }

  // Create Research Agent
  const researchAgent = new Agent({
    name: 'Research',
    instructions,
    model: 'gpt-4o',
  });

  try {
    console.log('[Research Agent] Starting research...');
    const prompt = `Research the market question and generate comprehensive research content.`;
    const result = await run(researchAgent, prompt);
    const output = result.finalOutput || '';
    console.log('[Research Agent] Research completed');

    // Parse the output to extract research sources
    // The agent should return structured sources
    const sources = parseResearchOutput(output, market);

    return sources;
  } catch (error) {
    console.error('[Research Agent] Error:', error);
    
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
      throw new Error('OpenAI API authentication failed. Please check your OPENAI_API_KEY environment variable.');
    }
    
    throw new Error(`Research agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract URLs from text content
 */
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s\)]+)/gi;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Parse research agent output into ValyuResult array
 */
function parseResearchOutput(output: string, market: Market): ValyuResult[] {
  const sources: ValyuResult[] = [];
  
  // Try to parse structured format (Title:, URL:, Content:, etc.)
  const sourceBlocks = output.split(/(?=Title:|Source \d+:|#)/i);
  
  for (const block of sourceBlocks) {
    if (!block.trim()) continue;
    
    const titleMatch = block.match(/Title:\s*(.+?)(?:\n|$)/i) || block.match(/#\s*(.+?)(?:\n|$)/);
    const urlMatch = block.match(/URL:\s*(.+?)(?:\n|$)/i);
    const contentMatch = block.match(/Content:\s*([\s\S]+?)(?:\n(?:Published|Domain|Title|URL|Source|#)|$)/i);
    const dateMatch = block.match(/Published Date:\s*(.+?)(?:\n|$)/i);
    const domainMatch = block.match(/Domain:\s*(.+?)(?:\n|$)/i);
    
    const title = titleMatch?.[1]?.trim() || 'Research Source';
    let url = urlMatch?.[1]?.trim();
    const content = contentMatch?.[1]?.trim() || block.trim();
    let publishedDate = dateMatch?.[1]?.trim();
    let domain = domainMatch?.[1]?.trim();
    
    // If no URL provided, try to extract from content
    if (!url || !isValidUrl(url)) {
      const extractedUrls = extractUrls(content);
      if (extractedUrls.length > 0) {
        url = extractedUrls[0]; // Use first valid URL found
        if (!domain) {
          domain = extractDomain(url);
        }
      }
    }
    
    // Validate URL - only use if it's a valid HTTP/HTTPS URL
    if (!url || !isValidUrl(url)) {
      // Skip this source if no valid URL (don't create placeholder URLs)
      continue;
    }
    
    // Extract domain from URL if not provided
    if (!domain) {
      domain = extractDomain(url);
    }
    
    if (content && content.length > 50) {
      sources.push({
        title,
        url,
        content,
        publishedDate,
        domain,
      });
    }
  }
  
  // If parsing didn't work well, try to extract URLs from the entire output
  if (sources.length < 3) {
    const allUrls = extractUrls(output);
    if (allUrls.length > 0) {
      // Group content by URLs found
      const sections = output.split(/\n\n+/).filter(s => s.trim().length > 100);
      sections.forEach((section, index) => {
        if (section.trim().length > 100) {
          const sectionUrls = extractUrls(section);
          const url = sectionUrls.length > 0 ? sectionUrls[0] : (index < allUrls.length ? allUrls[index] : null);
          
          if (url && isValidUrl(url)) {
            sources.push({
              title: `Research Source ${sources.length + 1}`,
              url,
              content: section.trim(),
              publishedDate: new Date().toISOString(),
              domain: extractDomain(url),
            });
          }
        }
      });
    }
  }
  
  // If still not enough sources with valid URLs, try to extract from chunks
  if (sources.length < 5) {
    const allUrls = extractUrls(output);
    if (allUrls.length > 0) {
      // Split the output into chunks and try to match with URLs
      const chunkSize = Math.ceil(output.length / Math.max(5, allUrls.length));
      for (let i = 0; i < Math.min(10, allUrls.length); i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunk = output.slice(start, end).trim();
        
        if (chunk.length > 100) {
          const url = allUrls[i];
          if (url && isValidUrl(url)) {
            sources.push({
              title: `Research Source ${sources.length + 1}`,
              url,
              content: chunk,
              publishedDate: new Date().toISOString(),
              domain: extractDomain(url),
            });
          }
        }
      }
    }
  }
  
  return sources.slice(0, 10); // Limit to 10 sources max
}

/**
 * Check if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

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

