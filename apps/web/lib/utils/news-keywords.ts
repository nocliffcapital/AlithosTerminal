/**
 * News keyword extraction utilities
 * Extracts relevant keywords from market data for NewsAPI.ai queries
 * Enhanced with entity extraction, proper noun detection, and event context
 */

import { Market } from '@/lib/api/polymarket';
import { detectCompany } from './company-detector';
import { isLocation } from '@/lib/data/locations';

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
 * Generic event terms that should be filtered out from event titles
 */
const GENERIC_EVENT_TERMS = new Set([
  'predictions', 'forecasts', 'markets', 'questions', 'outcomes', 'options',
  'choices', 'scenarios', 'possibilities', 'events', 'series', 'group',
  'collection', 'set', 'list', 'bundle', 'pack', 'batch',
]);

/**
 * Question words to filter out
 */
const QUESTION_WORDS = new Set([
  'what', 'who', 'when', 'where', 'how', 'why', 'which', 'whose', 'whom',
]);

/**
 * Common capitalized words that are not proper nouns
 */
const COMMON_CAPITALIZED_WORDS = new Set([
  'Will', 'The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For',
  'Of', 'With', 'By', 'From', 'As', 'Is', 'Are', 'Was', 'Were', 'Been',
  'Have', 'Has', 'Had', 'Do', 'Does', 'Did', 'This', 'That', 'These', 'Those',
  'What', 'Which', 'Who', 'When', 'Where', 'How', 'Why', 'Can', 'Could',
  'Should', 'Would', 'May', 'Might', 'Must', 'Shall', 'If', 'Then', 'Than',
]);

/**
 * Market entities extracted from questions
 */
export interface MarketEntities {
  people: string[];        // Person names
  organizations: string[]; // Company names, institutions
  locations: string[];     // Places, countries, cities
  events: string[];        // Event names, competitions
  dates: string[];         // Years, specific dates
  products: string[];      // Products, movies, books
  other: string[];        // Other specific terms
}

/**
 * Structured keywords for query construction
 */
export interface CoreKeywords {
  primary: string[];      // Must-have keywords (AND logic)
  secondary: string[];     // Important keywords (AND logic, lower priority)
  related: string[];      // Related terms (OR logic)
}

/**
 * Scored keyword for ranking
 */
interface ScoredKeyword {
  keyword: string;
  score: number;
}

/**
 * Normalize text for matching (lowercase, remove special chars)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text looks like a person name
 * Patterns: "First Last", "Will [Name]...", "[Name] will..."
 */
function isLikelyPersonName(text: string): boolean {
  if (!text || text.length < 2) return false;
  
  const normalized = text.trim();
  const words = normalized.split(/\s+/);
  
  // Single word names (common first names)
  if (words.length === 1) {
    const word = words[0];
    // Check if it's a common first name pattern (capitalized, 2+ chars)
    if (word.length >= 2 && word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
      // Exclude common words
      if (!COMMON_CAPITALIZED_WORDS.has(word) && !STOP_WORDS.has(word.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Two-word names (First Last)
  if (words.length === 2) {
    const [first, last] = words;
    // Both words should be capitalized and not be common words
    if (
      first[0] === first[0].toUpperCase() &&
      last[0] === last[0].toUpperCase() &&
      !COMMON_CAPITALIZED_WORDS.has(first) &&
      !COMMON_CAPITALIZED_WORDS.has(last) &&
      !STOP_WORDS.has(first.toLowerCase()) &&
      !STOP_WORDS.has(last.toLowerCase())
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract person names from question using patterns
 */
function extractPersonNames(question: string): string[] {
  const names: string[] = [];
  
  // Pattern: "Will [Name]..." or "[Name] will..."
  const willPattern = /(?:^|\s)(?:Will\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|be|win|have|become)/i;
  const willMatch = question.match(willPattern);
  if (willMatch && willMatch[1]) {
    const name = willMatch[1].trim();
    if (isLikelyPersonName(name)) {
      names.push(name);
    }
  }
  
  // Pattern: "[Name] will..." at start
  const nameWillPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+will/i;
  const nameWillMatch = question.match(nameWillPattern);
  if (nameWillMatch && nameWillMatch[1]) {
    const name = nameWillMatch[1].trim();
    if (isLikelyPersonName(name) && !names.includes(name)) {
      names.push(name);
    }
  }
  
  // Extract capitalized word pairs that look like names
  const words = question.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i].replace(/[^\w]/g, '');
    const word2 = words[i + 1].replace(/[^\w]/g, '');
    
    if (word1 && word2 && word1[0] === word1[0].toUpperCase() && word2[0] === word2[0].toUpperCase()) {
      const potentialName = `${word1} ${word2}`;
      if (isLikelyPersonName(potentialName) && !names.includes(potentialName)) {
        names.push(potentialName);
      }
    }
  }
  
  return names;
}

/**
 * Extract locations from question
 */
function extractLocations(question: string): string[] {
  const locations: string[] = [];
  const normalized = normalizeText(question);
  const words = question.split(/\s+/);
  
  // Check for known locations
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    if (isLocation(cleanWord)) {
      locations.push(word.trim());
    }
  }
  
  // Check for multi-word locations (e.g., "New York", "United States")
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`.toLowerCase().replace(/[^\w\s]/g, '');
    if (isLocation(twoWord)) {
      locations.push(`${words[i]} ${words[i + 1]}`.trim());
    }
  }
  
  return locations;
}

/**
 * Extract proper nouns (capitalized words/phrases)
 */
function extractProperNouns(question: string): string[] {
  const properNouns: string[] = [];
  const words = question.split(/\s+/);
  
  // Extract capitalized words that aren't common words
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (
      cleanWord.length >= 2 &&
      cleanWord[0] === cleanWord[0].toUpperCase() &&
      !COMMON_CAPITALIZED_WORDS.has(cleanWord) &&
      !STOP_WORDS.has(cleanWord.toLowerCase())
    ) {
      properNouns.push(cleanWord);
    }
  }
  
  // Extract capitalized phrases (2-3 words)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = words.slice(i, i + 2).join(' ').replace(/[^\w\s]/g, ' ').trim();
    const phraseWords = phrase.split(/\s+/);
    if (
      phraseWords.length === 2 &&
      phraseWords[0][0] === phraseWords[0][0].toUpperCase() &&
      phraseWords[1][0] === phraseWords[1][0].toUpperCase() &&
      !COMMON_CAPITALIZED_WORDS.has(phraseWords[0]) &&
      !COMMON_CAPITALIZED_WORDS.has(phraseWords[1])
    ) {
      properNouns.push(phrase);
    }
  }
  
  return properNouns.filter((noun, index, array) => array.indexOf(noun) === index);
}

/**
 * Extract all market entities from question
 */
function extractMarketEntities(question: string, category?: string): MarketEntities {
  const entities: MarketEntities = {
    people: [],
    organizations: [],
    locations: [],
    events: [],
    dates: [],
    products: [],
    other: [],
  };
  
  // Extract years
  const yearMatches = question.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    entities.dates.push(...yearMatches);
  }
  
  // Extract quoted phrases (products, movies, books, specific names)
  const quotedPhrases = question.match(/["']([^"']+)["']/g);
  if (quotedPhrases) {
    quotedPhrases.forEach(phrase => {
      const cleanPhrase = phrase.replace(/["']/g, '').trim();
      if (cleanPhrase.length > 2) {
        // Categorize based on context
        if (category?.toLowerCase().includes('movie') || category?.toLowerCase().includes('entertainment')) {
          entities.products.push(cleanPhrase);
        } else {
          entities.other.push(cleanPhrase);
        }
      }
    });
  }
  
  // Extract person names
  entities.people = extractPersonNames(question);
  
  // Extract locations
  entities.locations = extractLocations(question);
  
  // Extract proper nouns (organizations, events, etc.)
  const properNouns = extractProperNouns(question);
  for (const noun of properNouns) {
    // Skip if already categorized
    if (
      entities.people.some(p => p.includes(noun) || noun.includes(p)) ||
      entities.locations.some(l => l.includes(noun) || noun.includes(l))
    ) {
      continue;
    }
    
    // Check if it's likely an organization (company detector will handle known companies)
    const companyInfo = detectCompany(question);
    if (companyInfo.companyName && noun.toLowerCase().includes(companyInfo.companyName.toLowerCase())) {
      entities.organizations.push(noun);
    } else {
      // Could be event, organization, or other
      entities.other.push(noun);
    }
  }
  
  return entities;
}

/**
 * Check if event term is too generic
 */
function isGenericEventTerm(term: string): boolean {
  const normalized = term.toLowerCase().trim();
  return GENERIC_EVENT_TERMS.has(normalized);
}

/**
 * Extract specific terms from event title (years, names, locations)
 */
function extractSpecificEventTerms(eventTitle: string): string[] {
  const terms: string[] = [];
  
  // Extract years
  const yearMatches = eventTitle.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    terms.push(...yearMatches);
  }
  
  // Extract locations
  const locations = extractLocations(eventTitle);
  terms.push(...locations);
  
  // Extract proper nouns (excluding generic terms)
  const words = eventTitle.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '').trim();
    if (
      cleanWord.length >= 2 &&
      cleanWord[0] === cleanWord[0].toUpperCase() &&
      !isGenericEventTerm(cleanWord) &&
      !COMMON_CAPITALIZED_WORDS.has(cleanWord) &&
      !STOP_WORDS.has(cleanWord.toLowerCase())
    ) {
      terms.push(cleanWord);
    }
  }
  
  return terms.filter((term, index, array) => array.indexOf(term) === index);
}

/**
 * Extract keywords from event/series titles, filtering generic terms
 */
function extractEventKeywords(eventTitle?: string, seriesTitle?: string): string[] {
  const keywords: string[] = [];
  
  if (eventTitle) {
    const eventTerms = extractSpecificEventTerms(eventTitle);
    keywords.push(...eventTerms);
  }
  
  if (seriesTitle && seriesTitle !== eventTitle) {
    const seriesTerms = extractSpecificEventTerms(seriesTitle);
    // Only add series terms that aren't already in event terms
    for (const term of seriesTerms) {
      if (!keywords.some(k => k.toLowerCase() === term.toLowerCase())) {
        keywords.push(term);
      }
    }
  }
  
  return keywords;
}

/**
 * Check if event keyword adds value without over-broadening
 */
function shouldIncludeEventKeyword(keyword: string, marketKeywords: string[]): boolean {
  const normalized = keyword.toLowerCase().trim();
  
  // Don't add if it's generic
  if (isGenericEventTerm(normalized)) {
    return false;
  }
  
  // Don't add if it's already in market keywords
  if (marketKeywords.some(k => k.toLowerCase() === normalized)) {
    return false;
  }
  
  // Add if it's specific (year, location, proper noun)
  if (
    /^\d{4}$/.test(normalized) || // Year
    isLocation(normalized) || // Location
    (normalized.length >= 3 && normalized[0] === normalized[0].toUpperCase()) // Proper noun
  ) {
    return true;
  }
  
  return false;
}

/**
 * Score keywords by relevance
 */
function scoreKeywords(keywords: string[], market: Market): ScoredKeyword[] {
  const scored: ScoredKeyword[] = [];
  
  for (const keyword of keywords) {
    let score = 0;
    const normalized = keyword.toLowerCase().trim();
    
    // Specificity scoring
    // Proper nouns get higher scores
    if (keyword[0] === keyword[0].toUpperCase() && keyword.length > 2) {
      score += 10;
    }
    
    // Company names get high scores
    const companyInfo = detectCompany(market.question);
    if (companyInfo.companyName && normalized.includes(companyInfo.companyName.toLowerCase())) {
      score += 15;
    }
    if (companyInfo.ticker && normalized === companyInfo.ticker.toLowerCase()) {
      score += 15;
    }
    
    // Years get medium scores
    if (/^\d{4}$/.test(normalized)) {
      score += 8;
    }
    
    // Locations get medium scores
    if (isLocation(normalized)) {
      score += 8;
    }
    
    // Person names get high scores
    if (isLikelyPersonName(keyword)) {
      score += 12;
    }
    
    // Length scoring (longer = more specific)
    if (keyword.length >= 10) {
      score += 5;
    } else if (keyword.length >= 5) {
      score += 3;
    }
    
    // Category relevance (if keyword matches category)
    if (market.category) {
      const categoryLower = market.category.toLowerCase();
      const keywordLower = normalized;
      
      // Sports keywords for sports markets
      if (categoryLower.includes('sport') && (
        keywordLower.includes('team') || keywordLower.includes('player') ||
        keywordLower.includes('league') || keywordLower.includes('championship')
      )) {
        score += 5;
      }
      
      // Political keywords for political markets
      if (categoryLower.includes('politic') && (
        keywordLower.includes('election') || keywordLower.includes('candidate') ||
        keywordLower.includes('party') || keywordLower.includes('vote')
      )) {
        score += 5;
      }
    }
    
    // Penalize generic terms
    if (GENERIC_TERMS.has(normalized)) {
      score -= 10;
    }
    
    scored.push({ keyword, score });
  }
  
  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Expand keywords by category
 */
function expandKeywordsByCategory(keywords: string[], category?: string): string[] {
  if (!category) return keywords;
  
  const expanded = [...keywords];
  const categoryLower = category.toLowerCase();
  
  // Sports: Add league/competition terms
  if (categoryLower.includes('sport') || categoryLower.includes('nfl') || 
      categoryLower.includes('nba') || categoryLower.includes('mlb') ||
      categoryLower.includes('nhl') || categoryLower.includes('soccer') ||
      categoryLower.includes('f1') || categoryLower.includes('formula1')) {
    // Keywords already contain team/player names, no need to add generic terms
  }
  
  // Politics: Add election terms
  if (categoryLower.includes('politic') || categoryLower.includes('election')) {
    // Keywords already contain candidate names, no need to add generic terms
  }
  
  // Entertainment: Add award/competition terms
  if (categoryLower.includes('entertainment') || categoryLower.includes('movie') ||
      categoryLower.includes('music') || categoryLower.includes('gaming')) {
    // Keywords already contain titles/names, no need to add generic terms
  }
  
  return expanded;
}

/**
 * Extract core keywords from market (must-have keywords)
 */
function extractCoreKeywords(market: Market): CoreKeywords {
  const core: CoreKeywords = {
    primary: [],
    secondary: [],
    related: [],
  };
  
  const seen = new Set<string>();
  
  // Helper to add keywords without duplicates
  const addKeyword = (keyword: string, priority: 'primary' | 'secondary' | 'related') => {
    const normalized = keyword.toLowerCase().trim();
    if (normalized && normalized.length > 2 && !seen.has(normalized)) {
      seen.add(normalized);
      core[priority].push(keyword.trim());
    }
  };
  
  // Extract entities from market question
  const entities = extractMarketEntities(market.question, market.category);
  
  // Primary keywords: Company names, tickers, person names, quoted phrases
  if (entities.organizations.length > 0) {
    entities.organizations.forEach(org => addKeyword(org, 'primary'));
  }
  
  const companyInfo = detectCompany(market.question);
  if (companyInfo.companyName && companyInfo.confidence !== 'none') {
    addKeyword(companyInfo.companyName, 'primary');
    if (companyInfo.ticker) {
      addKeyword(companyInfo.ticker, 'primary');
    }
  }
  
  entities.people.forEach(person => addKeyword(person, 'primary'));
  entities.products.forEach(product => addKeyword(product, 'primary'));
  
  // Secondary keywords: Years, locations, other proper nouns
  entities.dates.forEach(date => addKeyword(date, 'secondary'));
  entities.locations.forEach(location => addKeyword(location, 'secondary'));
  
  // Extract event keywords (as secondary/related, not primary)
  const eventKeywords = extractEventKeywords(market.eventTitle, market.seriesTitle);
  for (const eventKeyword of eventKeywords) {
    if (shouldIncludeEventKeyword(eventKeyword, [...core.primary, ...core.secondary])) {
      // Years and locations from events go to secondary
      if (/^\d{4}$/.test(eventKeyword) || isLocation(eventKeyword.toLowerCase())) {
        addKeyword(eventKeyword, 'secondary');
      } else {
        // Other event terms go to related
        addKeyword(eventKeyword, 'related');
      }
    }
  }
  
  // Other specific terms from question (filtered for generic terms)
  const questionWords = market.question
    .toLowerCase()
    .replace(/["'][^"']+["']/g, '') // Remove quoted phrases
    .replace(/\b(19|20)\d{2}\b/g, '') // Remove years
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !STOP_WORDS.has(word) && 
      !QUESTION_WORDS.has(word) &&
      !GENERIC_TERMS.has(word) &&
      !seen.has(word)
    )
    .filter((word, index, array) => array.indexOf(word) === index)
    .slice(0, 3);
  
  questionWords.forEach(word => addKeyword(word, 'secondary'));
  
  // Score and prioritize
  const allKeywords = [...core.primary, ...core.secondary, ...core.related];
  const scored = scoreKeywords(allKeywords, market); // Already sorted by score descending
  
  // Rebuild with scored keywords, preserving priority structure
  const newCore: CoreKeywords = {
    primary: [],
    secondary: [],
    related: [],
  };
  
  // Primary: Top 2-3 highest scored keywords that were originally primary
  const primaryKeywords = scored.filter(s => core.primary.includes(s.keyword));
  newCore.primary = primaryKeywords.slice(0, 3).map(s => s.keyword);
  
  // Secondary: Next 2-3 keywords that were originally secondary (or primary if not already added)
  const secondaryKeywords = scored.filter(s => 
    (core.secondary.includes(s.keyword) || core.primary.includes(s.keyword)) &&
    !newCore.primary.includes(s.keyword)
  );
  newCore.secondary = secondaryKeywords.slice(0, 3).map(s => s.keyword);
  
  // Related: Remaining keywords (up to 3) that were originally related
  const relatedKeywords = scored.filter(s => 
    (core.related.includes(s.keyword) || 
     (!newCore.primary.includes(s.keyword) && !newCore.secondary.includes(s.keyword))) &&
    s.score > 0 // Only include keywords with positive scores
  );
  newCore.related = relatedKeywords.slice(0, 3).map(s => s.keyword);
  
  // Expand by category
  const expandedPrimary = expandKeywordsByCategory(newCore.primary, market.category);
  const expandedSecondary = expandKeywordsByCategory(newCore.secondary, market.category);
  const expandedRelated = expandKeywordsByCategory(newCore.related, market.category);
  
  return {
    primary: expandedPrimary.slice(0, 3),
    secondary: expandedSecondary.slice(0, 3),
    related: expandedRelated.slice(0, 3),
  };
}

/**
 * Build optimized query string for NewsAPI.ai
 */
function buildOptimizedQuery(market: Market): string {
  const core = extractCoreKeywords(market);
  
  // Combine primary and secondary keywords (AND logic)
  const coreKeywords = [...core.primary, ...core.secondary];
  
  // Use related keywords (OR logic) - but limit to avoid over-broadening
  const relatedKeywords = core.related.slice(0, 2);
  
  // Build query: core keywords (AND) + related keywords (OR)
  // For now, we'll use all keywords with AND logic for better precision
  // The API route will handle the AND/OR logic
  const allKeywords = [...coreKeywords, ...relatedKeywords];
  
  return allKeywords.join(' ');
}

/**
 * Extract keywords from market data for NewsAPI.ai queries
 * Returns structured keywords (primary, secondary, related)
 * 
 * @param market - Market object to extract keywords from
 * @returns Structured keywords object
 */
export function extractNewsKeywords(market: Market | null): CoreKeywords {
  if (!market) {
    return { primary: [], secondary: [], related: [] };
  }
  
  return extractCoreKeywords(market);
}

/**
 * Convert structured keywords to query string (backward compatibility)
 */
export function keywordsToQuery(keywords: string[] | CoreKeywords): string {
  if (Array.isArray(keywords)) {
    // Legacy format: array of keywords
    return keywords.filter(k => k && k.trim().length > 0).join(' ');
  }
  
  // New format: CoreKeywords object
  const core = keywords;
  const allKeywords = [...core.primary, ...core.secondary, ...core.related];
  return allKeywords.filter(k => k && k.trim().length > 0).join(' ');
}

/**
 * Get keywords as array for Event Registry API
 */
export function keywordsToArray(keywords: string[] | CoreKeywords): string[] {
  if (Array.isArray(keywords)) {
    return keywords.filter(k => k && k.trim().length > 0);
  }
  
  const core = keywords;
  return [...core.primary, ...core.secondary, ...core.related].filter(k => k && k.trim().length > 0);
}
