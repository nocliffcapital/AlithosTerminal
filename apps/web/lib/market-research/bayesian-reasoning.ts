/**
 * Bayesian reasoning to merge findings into confidence-weighted outcome
 */

import { GradedSource, AnalysisResult, BayesianResult, BayesianProbabilities, Market } from './types';

/**
 * Apply Bayesian reasoning to merge all findings
 */
export function applyBayesianReasoning(
  gradedSources: GradedSource[],
  analysisResult: AnalysisResult,
  market: Market
): BayesianResult {
  // Prior probability: Start with market's current probability
  const priorProbability = market.outcomePrices?.YES || 0.5;
  
  // Calculate source weights by grade
  const gradeWeights = calculateGradeWeights(gradedSources);
  
  // Calculate likelihood from sources
  const sourceLikelihood = calculateSourceLikelihood(gradedSources, gradeWeights);
  
  // Calculate agent confidence weight
  const agentConfidence = analysisResult.overallConfidence;
  
  // Combine priors and likelihoods using Bayes' theorem
  const posteriorProbabilities = calculatePosteriorProbabilities(
    priorProbability,
    sourceLikelihood,
    agentConfidence
  );
  
  // Calculate overall confidence
  const confidence = calculateOverallConfidence(
    gradedSources,
    analysisResult,
    posteriorProbabilities
  );
  
  // Generate explanation
  const explanation = generateBayesianExplanation(
    priorProbability,
    posteriorProbabilities,
    gradeWeights,
    confidence
  );
  
  return {
    probabilities: posteriorProbabilities,
    confidence,
    weightedEvidence: gradeWeights,
    explanation,
  };
}

/**
 * Calculate weights for each grade
 */
function calculateGradeWeights(gradedSources: GradedSource[]): {
  gradeAWeight: number;
  gradeBWeight: number;
  gradeCWeight: number;
  gradeDWeight: number;
} {
  const gradeCounts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };
  
  gradedSources.forEach(gs => {
    gradeCounts[gs.grade]++;
  });
  
  const total = gradedSources.length || 1;
  
  // Weight by count and quality
  // A sources get 4x weight, B get 2x, C get 1x, D get 0.5x
  const gradeAWeight = (gradeCounts.A / total) * 4;
  const gradeBWeight = (gradeCounts.B / total) * 2;
  const gradeCWeight = (gradeCounts.C / total) * 1;
  const gradeDWeight = (gradeCounts.D / total) * 0.5;
  
  // Normalize to sum to 1
  const totalWeight = gradeAWeight + gradeBWeight + gradeCWeight + gradeDWeight;
  const normalized = totalWeight > 0 ? totalWeight : 1;
  
  return {
    gradeAWeight: gradeAWeight / normalized,
    gradeBWeight: gradeBWeight / normalized,
    gradeCWeight: gradeCWeight / normalized,
    gradeDWeight: gradeDWeight / normalized,
  };
}

/**
 * Calculate likelihood from sources
 */
function calculateSourceLikelihood(
  gradedSources: GradedSource[],
  gradeWeights: ReturnType<typeof calculateGradeWeights>
): { yes: number; no: number; uncertain: number } {
  // Analyze sources for YES/NO/UNCERTAIN sentiment
  let yesWeight = 0;
  let noWeight = 0;
  let uncertainWeight = 0;
  
  gradedSources.forEach(gs => {
    // Weight by grade
    let weight = 0;
    switch (gs.grade) {
      case 'A':
        weight = gradeWeights.gradeAWeight;
        break;
      case 'B':
        weight = gradeWeights.gradeBWeight;
        break;
      case 'C':
        weight = gradeWeights.gradeCWeight;
        break;
      case 'D':
        weight = gradeWeights.gradeDWeight;
        break;
    }
    
    // Simple sentiment analysis on content
    const content = (gs.source.content || '').toLowerCase();
    const title = (gs.source.title || '').toLowerCase();
    const text = `${title} ${content}`;
    
    // YES indicators
    const yesIndicators = ['will', 'likely', 'expected', 'probable', 'positive', 'success', 'win'];
    const yesCount = yesIndicators.filter(ind => text.includes(ind)).length;
    
    // NO indicators
    const noIndicators = ['unlikely', 'doubt', 'fail', 'negative', 'reject', 'not', "won't"];
    const noCount = noIndicators.filter(ind => text.includes(ind)).length;
    
    // Determine sentiment
    if (yesCount > noCount) {
      yesWeight += weight;
    } else if (noCount > yesCount) {
      noWeight += weight;
    } else {
      uncertainWeight += weight;
    }
  });
  
  // Normalize to probabilities
  const totalWeight = yesWeight + noWeight + uncertainWeight || 1;
  
  return {
    yes: yesWeight / totalWeight,
    no: noWeight / totalWeight,
    uncertain: uncertainWeight / totalWeight,
  };
}

/**
 * Calculate posterior probabilities using Bayes' theorem
 */
function calculatePosteriorProbabilities(
  priorProbability: number,
  sourceLikelihood: ReturnType<typeof calculateSourceLikelihood>,
  agentConfidence: number
): BayesianProbabilities {
  // Combine prior with source likelihood
  // P(YES | Evidence) = P(Evidence | YES) * P(YES) / P(Evidence)
  
  // Prior probabilities
  const priorYes = priorProbability;
  const priorNo = 1 - priorProbability;
  const priorUncertain = 0.1; // Small prior for uncertain
  
  // Likelihood from sources
  const likelihoodYes = sourceLikelihood.yes;
  const likelihoodNo = sourceLikelihood.no;
  const likelihoodUncertain = sourceLikelihood.uncertain;
  
  // Weight by agent confidence
  const agentWeight = agentConfidence;
  const sourceWeight = 1 - agentWeight;
  
  // Combine: Weighted average of prior and likelihood, adjusted by agent confidence
  const posteriorYes = (
    (priorYes * sourceWeight + likelihoodYes * agentWeight) * 0.7 +
    likelihoodYes * 0.3
  );
  
  const posteriorNo = (
    (priorNo * sourceWeight + likelihoodNo * agentWeight) * 0.7 +
    likelihoodNo * 0.3
  );
  
  const posteriorUncertain = (
    (priorUncertain * sourceWeight + likelihoodUncertain * agentWeight) * 0.7 +
    likelihoodUncertain * 0.3
  );
  
  // Normalize to sum to 1
  const total = posteriorYes + posteriorNo + posteriorUncertain || 1;
  
  return {
    yes: Math.max(0, Math.min(1, posteriorYes / total)),
    no: Math.max(0, Math.min(1, posteriorNo / total)),
    uncertain: Math.max(0, Math.min(1, posteriorUncertain / total)),
  };
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(
  gradedSources: GradedSource[],
  analysisResult: AnalysisResult,
  probabilities: BayesianProbabilities
): number {
  // Factor 1: Quality of sources (weighted by grade)
  const avgSourceGrade = calculateAverageSourceGrade(gradedSources);
  
  // Factor 2: Agent confidence
  const agentConfidence = analysisResult.overallConfidence;
  
  // Factor 3: Probability spread (more spread = higher confidence)
  const probabilitySpread = Math.max(
    probabilities.yes,
    probabilities.no,
    probabilities.uncertain
  ) - Math.min(probabilities.yes, probabilities.no, probabilities.uncertain);
  
  // Combine factors
  const confidence = (
    avgSourceGrade * 0.3 +
    agentConfidence * 0.4 +
    probabilitySpread * 0.3
  );
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate average source grade (0-1 scale)
 */
function calculateAverageSourceGrade(gradedSources: GradedSource[]): number {
  if (gradedSources.length === 0) return 0.5;
  
  const gradeValues = {
    A: 1.0,
    B: 0.75,
    C: 0.5,
    D: 0.25,
  };
  
  const sum = gradedSources.reduce((acc, gs) => acc + gradeValues[gs.grade], 0);
  return sum / gradedSources.length;
}

/**
 * Generate explanation for Bayesian reasoning
 */
function generateBayesianExplanation(
  priorProbability: number,
  probabilities: BayesianProbabilities,
  gradeWeights: ReturnType<typeof calculateGradeWeights>,
  confidence: number
): string {
  const parts: string[] = [];
  
  // Prior probability
  parts.push(`Prior probability: ${(priorProbability * 100).toFixed(1)}%`);
  
  // Posterior probabilities
  parts.push(`Posterior probabilities: YES ${(probabilities.yes * 100).toFixed(1)}%, NO ${(probabilities.no * 100).toFixed(1)}%, UNCERTAIN ${(probabilities.uncertain * 100).toFixed(1)}%`);
  
  // Source quality
  const totalSources = Object.values(gradeWeights).reduce((a, b) => a + b, 0);
  const qualityParts: string[] = [];
  if (gradeWeights.gradeAWeight > 0) {
    qualityParts.push(`${(gradeWeights.gradeAWeight * 100).toFixed(0)}% Grade A sources`);
  }
  if (gradeWeights.gradeBWeight > 0) {
    qualityParts.push(`${(gradeWeights.gradeBWeight * 100).toFixed(0)}% Grade B sources`);
  }
  if (qualityParts.length > 0) {
    parts.push(`Source quality: ${qualityParts.join(', ')}`);
  }
  
  // Confidence
  parts.push(`Overall confidence: ${(confidence * 100).toFixed(1)}%`);
  
  return parts.join('. ');
}



