/**
 * Type definitions for AI-powered market research system
 */

import { Prisma } from '@prisma/client';

export type SourceGrade = 'A' | 'B' | 'C' | 'D';

export interface ValyuResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  author?: string;
  domain?: string;
}

export interface GradedSource {
  source: ValyuResult;
  grade: SourceGrade;
  credibilityScore: number;
  recencyScore: number;
  biasScore: number;
  clarityScore: number;
  explanation: string;
}

export interface ResearchStrategy {
  marketQuestion: string;
  keyInformationNeeded: string[];
  searchQueries: string[];
  importantFactors: string[];
  timelineConsiderations: string;
}

export interface AgentAnalysis {
  agentName: string;
  output: string;
  confidence: number;
  reasoning: string;
}

export interface AnalysisResult {
  analyst: AgentAnalysis;
  critic: AgentAnalysis;
  aggregator: AgentAnalysis;
  overallConfidence: number;
}

export interface BayesianProbabilities {
  yes: number;
  uncertain: number;
  no: number;
}

export interface BayesianResult {
  probabilities: BayesianProbabilities;
  confidence: number;
  weightedEvidence: {
    gradeAWeight: number;
    gradeBWeight: number;
    gradeCWeight: number;
    gradeDWeight: number;
  };
  explanation: string;
}

export type FinalVerdict = 'YES' | 'UNCERTAIN' | 'NO';

export interface MarketResearchResult {
  marketId: string;
  marketQuestion: string;
  verdict: FinalVerdict;
  confidence: number;
  gradedSources: GradedSource[];
  analysisResult: AnalysisResult;
  bayesianResult: BayesianResult;
  researchStrategy: ResearchStrategy;
  timestamp: string;
}

// Type that satisfies Prisma's JSON requirements
// All nested types (GradedSource[], AnalysisResult, etc.) are JSON-serializable
export type MarketResearchResultJson = MarketResearchResult & Prisma.InputJsonObject;



