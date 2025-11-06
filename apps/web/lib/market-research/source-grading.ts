/**
 * Source grading system
 * Grades sources (A-D) based on credibility, recency, bias, and clarity
 */

import { ValyuResult, GradedSource, SourceGrade } from './types';

// Credible domains (reputable news sources, academic institutions, etc.)
const CREDIBLE_DOMAINS = [
  'reuters.com',
  'bloomberg.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'nytimes.com',
  'washingtonpost.com',
  'bbc.com',
  'theguardian.com',
  'ap.org',
  'cnn.com',
  'forbes.com',
  'techcrunch.com',
  'github.com',
  'stackoverflow.com',
  'wikipedia.org',
  'edu', // Academic institutions
  'gov', // Government sources
];

// Potentially biased or low-quality domains
const SUSPICIOUS_DOMAINS = [
  'blogspot.com',
  'wordpress.com',
  'medium.com', // Mixed quality
  'reddit.com', // User-generated content
];

/**
 * Grade a source based on credibility, recency, bias, and clarity
 */
export function gradeSource(source: ValyuResult): GradedSource {
  const credibilityScore = assessCredibility(source);
  const recencyScore = assessRecency(source);
  const biasScore = assessBias(source);
  const clarityScore = assessClarity(source);

  // Calculate overall grade
  const averageScore = (credibilityScore + recencyScore + biasScore + clarityScore) / 4;
  const grade = scoreToGrade(averageScore);

  // Generate explanation
  const explanation = generateExplanation({
    grade,
    credibilityScore,
    recencyScore,
    biasScore,
    clarityScore,
    domain: source.domain,
    publishedDate: source.publishedDate,
  });

  return {
    source,
    grade,
    credibilityScore,
    recencyScore,
    biasScore,
    clarityScore,
    explanation,
  };
}

/**
 * Assess credibility based on domain and author
 */
function assessCredibility(source: ValyuResult): number {
  let score = 0.5; // Base score

  // Check domain reputation
  if (source.domain) {
    const domainLower = source.domain.toLowerCase();
    
    // High credibility domains
    if (CREDIBLE_DOMAINS.some(d => domainLower.includes(d))) {
      score = 0.9;
    }
    // Academic or government domains
    else if (domainLower.endsWith('.edu') || domainLower.endsWith('.gov')) {
      score = 0.95;
    }
    // Suspicious domains
    else if (SUSPICIOUS_DOMAINS.some(d => domainLower.includes(d))) {
      score = 0.3;
    }
    // Unknown domains - neutral
    else {
      score = 0.5;
    }
  }

  // Author presence adds slight credibility
  if (source.author) {
    score = Math.min(1.0, score + 0.1);
  }

  return score;
}

/**
 * Assess recency of the source
 */
function assessRecency(source: ValyuResult): number {
  if (!source.publishedDate) {
    // No date available - assume moderate recency
    return 0.5;
  }

  try {
    const publishedDate = new Date(source.publishedDate);
    const now = new Date();
    const daysAgo = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

    // Very recent (within 7 days)
    if (daysAgo <= 7) {
      return 1.0;
    }
    // Recent (within 30 days)
    else if (daysAgo <= 30) {
      return 0.9;
    }
    // Moderate (within 90 days)
    else if (daysAgo <= 90) {
      return 0.7;
    }
    // Older (within 1 year)
    else if (daysAgo <= 365) {
      return 0.5;
    }
    // Very old (over 1 year)
    else {
      return 0.3;
    }
  } catch {
    // Invalid date format
    return 0.5;
  }
}

/**
 * Assess bias (objectivity) of the source
 */
function assessBias(source: ValyuResult): number {
  // Simple heuristic: look for bias indicators in title and content
  const text = `${source.title} ${source.content}`.toLowerCase();
  
  // Bias indicators (subjective language)
  const biasIndicators = [
    'amazing', 'terrible', 'worst', 'best', 'horrible', 'fantastic',
    'must', 'should', 'unfortunately', 'fortunately', 'sadly',
    'obviously', 'clearly', 'undoubtedly',
  ];
  
  const biasCount = biasIndicators.filter(indicator => text.includes(indicator)).length;
  
  // More bias indicators = lower objectivity score
  // Normalize: 0 indicators = 1.0, 5+ indicators = 0.3
  const biasScore = Math.max(0.3, 1.0 - (biasCount * 0.15));
  
  return biasScore;
}

/**
 * Assess clarity and coherence of the content
 */
function assessClarity(source: ValyuResult): number {
  const content = source.content || '';
  
  // Very short content is unclear
  if (content.length < 100) {
    return 0.3;
  }
  
  // Moderate length is good
  if (content.length >= 100 && content.length <= 5000) {
    return 0.8;
  }
  
  // Very long content may be less clear (but still informative)
  if (content.length > 5000) {
    return 0.6;
  }
  
  // Check for coherence indicators (complete sentences, proper structure)
  const sentenceCount = (content.match(/[.!?]+/g) || []).length;
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  
  if (wordCount > 0 && sentenceCount > 0) {
    const avgWordsPerSentence = wordCount / sentenceCount;
    // Good sentences are 10-25 words on average
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
      return Math.min(1.0, 0.8 + 0.2);
    }
  }
  
  return 0.7;
}

/**
 * Convert numeric score (0-1) to letter grade
 */
function scoreToGrade(score: number): SourceGrade {
  if (score >= 0.8) return 'A';
  if (score >= 0.6) return 'B';
  if (score >= 0.4) return 'C';
  return 'D';
}

/**
 * Generate explanation for the grade
 */
function generateExplanation(params: {
  grade: SourceGrade;
  credibilityScore: number;
  recencyScore: number;
  biasScore: number;
  clarityScore: number;
  domain?: string;
  publishedDate?: string;
}): string {
  const parts: string[] = [];
  
  // Credibility assessment
  if (params.credibilityScore >= 0.8) {
    parts.push('high credibility');
  } else if (params.credibilityScore >= 0.6) {
    parts.push('moderate credibility');
  } else {
    parts.push('low credibility');
  }
  
  // Recency assessment
  if (params.recencyScore >= 0.8) {
    parts.push('very recent');
  } else if (params.recencyScore >= 0.6) {
    parts.push('moderately recent');
  } else {
    parts.push('older content');
  }
  
  // Bias assessment
  if (params.biasScore >= 0.8) {
    parts.push('objective');
  } else if (params.biasScore >= 0.6) {
    parts.push('somewhat objective');
  } else {
    parts.push('potentially biased');
  }
  
  // Domain info
  if (params.domain) {
    parts.push(`from ${params.domain}`);
  }
  
  return `Grade ${params.grade}: ${parts.join(', ')}`;
}



