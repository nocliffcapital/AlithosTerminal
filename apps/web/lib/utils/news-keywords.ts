/**
 * News keyword extraction utilities
 * Extracts relevant keywords from market data for NewsAPI.ai queries
 */

import { Market } from '@/lib/api/polymarket';
import { detectCompany } from './company-detector';

/**
 * Stop words to filter out from keyword extraction
 */
const STOP_WORDS = new Set([
  'will', 'be', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'been', 'have', 'has',
  'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
  'when', 'where', 'how', 'why', 'can', 'could', 'should', 'would', 'may', 'might',
  'must', 'shall', 'if', 'then', 'than', 'more', 'most', 'less', 'least', 'very',
  'much', 'many', 'some', 'any', 'all', 'each', 'every', 'both', 'either', 'neither',
]);

/**
 * Generic terms that are too common to be useful as keywords
 * These will be filtered out unless they're part of a specific phrase
 */
const GENERIC_TERMS = new Set([
  'largest', 'biggest', 'smallest', 'best', 'worst', 'top', 'bottom',
  'company', 'companies', 'world', 'global', 'international', 'national',
  'end', 'beginning', 'start', 'finish', 'complete', 'finish',
  'market', 'markets', 'cap', 'capitalization', 'value', 'worth',
  'price', 'prices', 'cost', 'costs', 'revenue', 'profit', 'loss',
  'happen', 'happens', 'happened', 'occur', 'occurs', 'occurred',
  'reach', 'reaches', 'reached', 'hit', 'hits', 'hitting',
]);

/**
 * Question words to filter out
 */
const QUESTION_WORDS = new Set([
  'what', 'who', 'when', 'where', 'how', 'why', 'which', 'whose', 'whom',
]);

/**
 * Extract key terms from text (remove stop words and question words)
 * Preserves quoted phrases and important terms
 */
function extractKeyTerms(text: string): string[] {
  if (!text) return [];

  const terms: string[] = [];
  
  // First, extract quoted phrases (like "Avatar: Fire and Ash")
  const quotedPhrases = text.match(/["']([^"']+)["']/g);
  if (quotedPhrases) {
    quotedPhrases.forEach(phrase => {
      // Remove quotes and clean up
      const cleanPhrase = phrase.replace(/["']/g, '').trim();
      if (cleanPhrase.length > 2) {
        terms.push(cleanPhrase);
      }
    });
  }

  // Extract years (4-digit numbers like 2025)
  const years = text.match(/\b(19|20)\d{2}\b/g);
  if (years) {
    years.forEach(year => {
      if (!terms.includes(year)) {
        terms.push(year);
      }
    });
  }

  // Extract other key terms (remove quoted phrases and years first)
  let textWithoutQuotes = text.replace(/["'][^"']+["']/g, '');
  textWithoutQuotes = textWithoutQuotes.replace(/\b(19|20)\d{2}\b/g, '');
  
  const words = textWithoutQuotes
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !STOP_WORDS.has(word) && 
      !QUESTION_WORDS.has(word)
    )
    .filter((word, index, array) => array.indexOf(word) === index); // Remove duplicates

  terms.push(...words);
  
  // Limit to 10 key terms per source
  return terms.slice(0, 10);
}

/**
 * Extract keywords from market data for NewsAPI.ai queries
 * Focuses on specific, unique identifiers (company names, tickers, years)
 * and filters out generic terms that are too common
 * 
 * Priority order:
 * 1. Company names and tickers (most specific)
 * 2. Years (if relevant)
 * 3. Specific terms from question (filtered for generic terms)
 * 
 * @param market - Market object to extract keywords from
 * @returns Array of relevant keywords (3-5 keywords, focused on specific terms)
 */
export function extractNewsKeywords(market: Market | null): string[] {
  if (!market) return [];

  const keywords: string[] = [];
  const seen = new Set<string>();

  // Helper to add keywords without duplicates, filtering generic terms
  const addKeywords = (terms: string[], allowGeneric = false) => {
    for (const term of terms) {
      const normalized = term.toLowerCase().trim();
      if (normalized && normalized.length > 2 && !seen.has(normalized)) {
        // Filter out generic terms unless explicitly allowed
        if (!allowGeneric && GENERIC_TERMS.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        keywords.push(term.trim());
      }
    }
  };

  // 1. Company names and tickers (highest priority - most specific)
  const companyInfo = detectCompany(market.question);
  if (companyInfo.companyName && companyInfo.confidence !== 'none') {
    addKeywords([companyInfo.companyName], true); // Allow company name even if it's in generic terms
    if (companyInfo.ticker) {
      addKeywords([companyInfo.ticker], true);
    }
  }

  // 2. Extract years (specific and useful)
  const yearMatches = market.question.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    addKeywords(yearMatches, true);
  }

  // 3. Extract quoted phrases (like movie titles, specific names)
  const quotedPhrases = market.question.match(/["']([^"']+)["']/g);
  if (quotedPhrases) {
    quotedPhrases.forEach(phrase => {
      const cleanPhrase = phrase.replace(/["']/g, '').trim();
      if (cleanPhrase.length > 2) {
        addKeywords([cleanPhrase], true);
      }
    });
  }

  // 4. Extract specific terms from question (filtering out generic terms)
  // Only extract terms that are NOT generic and NOT already added
  const questionWords = market.question
    .toLowerCase()
    .replace(/["'][^"']+["']/g, '') // Remove quoted phrases (already handled)
    .replace(/\b(19|20)\d{2}\b/g, '') // Remove years (already handled)
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !STOP_WORDS.has(word) && 
      !QUESTION_WORDS.has(word) &&
      !GENERIC_TERMS.has(word) && // Filter out generic terms
      !seen.has(word) // Don't add duplicates
    )
    .filter((word, index, array) => array.indexOf(word) === index)
    .slice(0, 3); // Limit to 3 additional specific terms

  addKeywords(questionWords, false);

  // Remove duplicate keywords (case-insensitive)
  const uniqueKeywords: string[] = [];
  const seenLower = new Set<string>();
  
  for (const keyword of keywords) {
    const lower = keyword.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      uniqueKeywords.push(keyword);
    }
  }

  // Prioritize: company names, tickers, years, and specific terms
  // Limit to 3-5 most relevant keywords - focus on specific identifiers
  // Event Registry works best with specific, unique terms
  const prioritized = uniqueKeywords.slice(0, 5);
  
  return prioritized;
}

/**
 * Convert keywords array to query string for NewsAPI.ai
 * Event Registry supports both string and array for keyword parameter
 * @param keywords - Array of keywords
 * @returns Query string (keywords joined with spaces)
 */
export function keywordsToQuery(keywords: string[]): string {
  if (keywords.length === 0) return '';
  
  // Join keywords with spaces
  // Event Registry will search for articles containing all keywords (AND logic)
  return keywords.join(' ');
}

/**
 * Get keywords as array for Event Registry API
 * Event Registry supports keyword as string or string array
 * @param keywords - Array of keywords
 * @returns Array of keywords (can be used directly in API request)
 */
export function keywordsToArray(keywords: string[]): string[] {
  return keywords.filter(k => k && k.trim().length > 0);
}

