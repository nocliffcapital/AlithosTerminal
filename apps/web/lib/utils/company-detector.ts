/**
 * Company name and ticker detection utilities
 * Detects company names and stock tickers from market questions
 */

// Import comprehensive company ticker mappings
import { COMPANY_TICKER_MAP } from '@/lib/data/company-tickers';

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
 * Extract potential company names from text using patterns
 */
function extractCompanyNames(text: string): string[] {
  const normalized = normalizeText(text);
  const companies: string[] = [];
  
  // Check direct matches in company map
  for (const [companyName, ticker] of Object.entries(COMPANY_TICKER_MAP)) {
    if (normalized.includes(companyName)) {
      companies.push(companyName);
    }
  }
  
  // Pattern matching for common company name structures
  // Match "Will [Company] be..." or "[Company] will..." patterns
  const patterns = [
    /will\s+([a-z\s]+?)\s+(?:be|win|have|become)/i,
    /(?:the|a)\s+([a-z\s]+?)\s+(?:will|company|stock)/i,
    /([a-z\s]+?)\s+(?:will|is expected|forecast)/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const potentialCompany = match[1].trim();
      // Check if it matches a known company
      for (const [companyName] of Object.entries(COMPANY_TICKER_MAP)) {
        if (potentialCompany.includes(companyName) || companyName.includes(potentialCompany)) {
          if (!companies.includes(companyName)) {
            companies.push(companyName);
          }
        }
      }
    }
  }
  
  return companies;
}

/**
 * Detect company name and ticker from market question
 * @param question - Market question text
 * @returns Object with company name, ticker, and confidence
 */
export function detectCompany(question: string): {
  companyName?: string;
  ticker?: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
} {
  if (!question) {
    return { confidence: 'none' };
  }
  
  const normalized = normalizeText(question);
  const companies = extractCompanyNames(question);
  
  if (companies.length === 0) {
    return { confidence: 'none' };
  }
  
  // Use the first (most likely) match, but prefer longer matches
  // Sort companies by length (longer = more specific)
  const sortedCompanies = companies.sort((a, b) => b.length - a.length);
  const detectedCompany = sortedCompanies[0];
  const ticker = COMPANY_TICKER_MAP[detectedCompany];
  
  if (!ticker) {
    return {
      companyName: detectedCompany,
      confidence: 'low',
    };
  }
  
  // Determine confidence based on match quality
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  // High confidence: exact match or very common company
  if (
    normalized.includes(detectedCompany) &&
    (detectedCompany.length > 4 || companies.length === 1)
  ) {
    confidence = 'high';
  }
  
  // Low confidence: short match or multiple matches
  if (detectedCompany.length <= 3 && companies.length > 1) {
    confidence = 'low';
  }
  
  return {
    companyName: detectedCompany,
    ticker,
    confidence,
  };
}

/**
 * Get trading symbol for a company (handles international exchanges)
 * @param ticker - Stock ticker symbol
 * @param exchange - Optional exchange code (default: 'NASDAQ' for US stocks)
 * @returns Trading symbol string
 */
export function getTradingSymbol(ticker: string, exchange?: string): string {
  // For Saudi exchange (like Aramco)
  if (ticker.includes('.SR')) {
    return ticker; // Already formatted
  }
  
  // For Japanese stocks (like Toyota)
  if (ticker.includes('.')) {
    return ticker; // Already has exchange suffix
  }
  
  // Default to NASDAQ/NYSE for US stocks
  // TradingView format: EXCHANGE:SYMBOL or just SYMBOL
  // Most US stocks work with just the symbol
  return ticker;
}

/**
 * Get all known company names (for autocomplete/search)
 */
export function getAllCompanyNames(): string[] {
  return Object.keys(COMPANY_TICKER_MAP);
}

/**
 * Search for companies by partial name
 */
export function searchCompanies(query: string): Array<{ name: string; ticker: string }> {
  const normalized = normalizeText(query);
  const results: Array<{ name: string; ticker: string }> = [];
  
  for (const [name, ticker] of Object.entries(COMPANY_TICKER_MAP)) {
    if (name.includes(normalized) || normalized.includes(name)) {
      results.push({ name, ticker });
    }
  }
  
  return results.slice(0, 10); // Limit results
}

