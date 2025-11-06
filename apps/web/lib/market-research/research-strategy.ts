/**
 * Research strategy planning
 * Analyzes market question and identifies what to look for
 */

import { Market } from '@/lib/api/polymarket';
import { ResearchStrategy } from './types';

/**
 * Plan research strategy based on market question
 */
export function planResearchStrategy(market: Market): ResearchStrategy {
  const marketQuestion = market.question || '';
  const endDate = market.endDate ? new Date(market.endDate) : null;
  const now = new Date();
  const daysUntilEnd = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 *24))) : null;

  // Extract key information needs
  const keyInformationNeeded = identifyKeyInformation(marketQuestion, market.category, daysUntilEnd);

  // Generate search queries
  const searchQueries = generateSearchQueries(marketQuestion, market.category, keyInformationNeeded);

  // Identify important factors
  const importantFactors = identifyImportantFactors(marketQuestion, market.category);

  // Timeline considerations
  const timelineConsiderations = generateTimelineConsiderations(endDate, daysUntilEnd);

  return {
    marketQuestion,
    keyInformationNeeded,
    searchQueries,
    importantFactors,
    timelineConsiderations,
  };
}

/**
 * Identify key information needed based on market question
 */
function identifyKeyInformation(question: string, category?: string, daysUntilEnd?: number | null): string[] {
  const info: string[] = [];
  const questionLower = question.toLowerCase();

  // General information needs
  info.push('Current status and recent developments');
  info.push('Expert opinions and analysis');
  info.push('Historical context and precedents');

  // Category-specific information
  if (category) {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('politics') || categoryLower.includes('election')) {
      info.push('Polling data and voter sentiment');
      info.push('Political developments and endorsements');
      info.push('Election rules and deadlines');
    } else if (categoryLower.includes('sports')) {
      info.push('Team performance and statistics');
      info.push('Player injuries and availability');
      info.push('Recent match results');
    } else if (categoryLower.includes('crypto') || categoryLower.includes('finance')) {
      info.push('Market trends and technical analysis');
      info.push('Regulatory developments');
      info.push('Market sentiment indicators');
    } else if (categoryLower.includes('tech')) {
      info.push('Product announcements and releases');
      info.push('Company financial reports');
      info.push('Industry trends');
    }
  }

  // Question-specific information
  if (questionLower.includes('will') || questionLower.includes('will be')) {
    info.push('Future predictions and forecasts');
    info.push('Upcoming events and deadlines');
  }

  if (questionLower.includes('exceed') || questionLower.includes('above') || questionLower.includes('below')) {
    info.push('Current metrics and benchmarks');
    info.push('Trend analysis');
  }

  // Timeline-specific information
  if (daysUntilEnd !== null && daysUntilEnd !== undefined) {
    if (daysUntilEnd <= 7) {
      info.push('Immediate developments and breaking news');
    } else if (daysUntilEnd <= 30) {
      info.push('Short-term trends and upcoming events');
    }
  }

  return info;
}

/**
 * Generate search queries based on market question
 */
function generateSearchQueries(question: string, category?: string, keyInformation: string[]): string[] {
  const queries: string[] = [];
  const questionWords = question.split(/\s+/).filter(w => w.length > 3); // Filter out short words

  // Primary query: market question itself
  queries.push(question);

  // Extract key terms from question
  const keyTerms = extractKeyTerms(question);
  if (keyTerms.length > 0) {
    queries.push(keyTerms.join(' '));
  }

  // Category-specific queries
  if (category) {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('politics')) {
      queries.push(`${keyTerms.join(' ')} election 2024`);
      queries.push(`${keyTerms.join(' ')} polling`);
    } else if (categoryLower.includes('sports')) {
      queries.push(`${keyTerms.join(' ')} 2024 season`);
      queries.push(`${keyTerms.join(' ')} recent performance`);
    } else if (categoryLower.includes('crypto')) {
      queries.push(`${keyTerms.join(' ')} cryptocurrency price`);
      queries.push(`${keyTerms.join(' ')} blockchain news`);
    }
  }

  // Add queries for key information needs
  keyInformation.slice(0, 3).forEach(info => {
    if (keyTerms.length > 0) {
      queries.push(`${keyTerms.join(' ')} ${info.toLowerCase()}`);
    }
  });

  // Remove duplicates and limit to 5 queries
  return Array.from(new Set(queries)).slice(0, 5);
}

/**
 * Extract key terms from question (remove stop words)
 */
function extractKeyTerms(question: string): string[] {
  const stopWords = new Set([
    'will', 'be', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'been', 'have', 'has',
    'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
  ]);

  return question
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5); // Limit to 5 key terms
}

/**
 * Identify important factors to consider
 */
function identifyImportantFactors(question: string, category?: string): string[] {
  const factors: string[] = [];
  const questionLower = question.toLowerCase();

  // General factors
  factors.push('Current market probability');
  factors.push('Volume and liquidity');
  factors.push('Recent price movements');

  // Question-specific factors
  if (questionLower.includes('before') || questionLower.includes('by')) {
    factors.push('Deadline and timeline constraints');
  }

  if (questionLower.includes('exceed') || questionLower.includes('above')) {
    factors.push('Current value vs target threshold');
    factors.push('Trend direction');
  }

  // Category-specific factors
  if (category) {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('politics')) {
      factors.push('Public opinion and polling');
      factors.push('Political endorsements');
    } else if (categoryLower.includes('sports')) {
      factors.push('Team/player statistics');
      factors.push('Injury reports');
    } else if (categoryLower.includes('crypto')) {
      factors.push('Market sentiment');
      factors.push('Technical indicators');
    }
  }

  return factors;
}

/**
 * Generate timeline considerations
 */
function generateTimelineConsiderations(endDate: Date | null, daysUntilEnd: number | null): string {
  if (!endDate || daysUntilEnd === null) {
    return 'Market has no specified end date. Focus on long-term trends and developments.';
  }

  if (daysUntilEnd <= 7) {
    return `Market resolves in ${daysUntilEnd} day(s). Focus on immediate developments and breaking news.`;
  } else if (daysUntilEnd <= 30) {
    return `Market resolves in ${daysUntilEnd} days. Consider short-term trends and upcoming events.`;
  } else if (daysUntilEnd <= 90) {
    return `Market resolves in ${daysUntilEnd} days. Balance short-term and medium-term factors.`;
  } else {
    return `Market resolves in ${daysUntilEnd} days. Consider long-term trends and structural factors.`;
  }
}



