/**
 * Location data for entity extraction
 * Used to identify locations (countries, cities, states) in market questions
 */

// Major countries
export const COUNTRIES = new Set([
  'united states', 'usa', 'us', 'america',
  'china', 'japan', 'germany', 'france', 'united kingdom', 'uk', 'britain',
  'italy', 'spain', 'canada', 'australia', 'south korea', 'india', 'russia',
  'brazil', 'mexico', 'argentina', 'south africa', 'egypt', 'nigeria',
  'saudi arabia', 'uae', 'israel', 'turkey', 'poland', 'netherlands',
  'belgium', 'sweden', 'norway', 'denmark', 'finland', 'switzerland',
  'austria', 'greece', 'portugal', 'ireland', 'new zealand', 'singapore',
  'hong kong', 'taiwan', 'thailand', 'indonesia', 'philippines', 'vietnam',
  'ukraine', 'belarus', 'romania', 'czech republic', 'hungary', 'croatia',
  'chile', 'colombia', 'peru', 'venezuela', 'pakistan', 'bangladesh',
]);

// Major cities
export const CITIES = new Set([
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'san francisco', 'columbus', 'fort worth', 'charlotte', 'indianapolis',
  'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit',
  'nashville', 'portland', 'oklahoma city', 'las vegas', 'memphis',
  'london', 'paris', 'berlin', 'madrid', 'rome', 'amsterdam', 'vienna',
  'brussels', 'stockholm', 'copenhagen', 'oslo', 'helsinki', 'dublin',
  'zurich', 'milan', 'barcelona', 'munich', 'frankfurt', 'hamburg',
  'tokyo', 'osaka', 'kyoto', 'yokohama', 'nagoya', 'sapporo',
  'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'hangzhou',
  'hong kong', 'singapore', 'seoul', 'bangkok', 'jakarta', 'manila',
  'sydney', 'melbourne', 'brisbane', 'perth', 'auckland', 'wellington',
  'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
  'moscow', 'saint petersburg', 'kiev', 'kyiv', 'warsaw', 'prague',
  'budapest', 'bucharest', 'athens', 'lisbon', 'dublin', 'cairo',
  'johannesburg', 'cape town', 'lagos', 'nairobi', 'riyadh', 'dubai',
  'tel aviv', 'istanbul', 'ankara', 'tehran', 'baghdad', 'damascus',
  'sao paulo', 'rio de janeiro', 'buenos aires', 'lima', 'bogota',
  'santiago', 'caracas', 'mexico city', 'montreal', 'toronto', 'vancouver',
]);

// US States
export const US_STATES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
  'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
  'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming', 'district of columbia', 'dc',
]);

// Regions
export const REGIONS = new Set([
  'europe', 'asia', 'africa', 'americas', 'north america', 'south america',
  'middle east', 'east asia', 'southeast asia', 'south asia', 'central asia',
  'western europe', 'eastern europe', 'nordic', 'scandinavia', 'balkans',
  'mediterranean', 'caribbean', 'latin america', 'oceania', 'pacific',
  'atlantic', 'arctic', 'antarctic',
]);

/**
 * Check if a term is a known location
 */
export function isLocation(term: string): boolean {
  const normalized = term.toLowerCase().trim();
  return (
    COUNTRIES.has(normalized) ||
    CITIES.has(normalized) ||
    US_STATES.has(normalized) ||
    REGIONS.has(normalized)
  );
}

/**
 * Get all known locations (for debugging/testing)
 */
export function getAllLocations(): string[] {
  return [
    ...Array.from(COUNTRIES),
    ...Array.from(CITIES),
    ...Array.from(US_STATES),
    ...Array.from(REGIONS),
  ];
}

