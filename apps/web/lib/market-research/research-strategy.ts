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
  const searchQueries = generateSearchQueries(marketQuestion, keyInformationNeeded, market.category);

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
    
    // Politics categories
    if (categoryLower.includes('election') || categoryLower.includes('presidential-election')) {
      info.push('Latest polling data and voter surveys');
      info.push('Campaign developments and candidate activities');
      info.push('Voter registration and turnout projections');
      info.push('Electoral college projections and swing states');
      info.push('Debate performances and public appearances');
      info.push('Endorsements and political support');
    } else if (categoryLower.includes('us-politics') || categoryLower.includes('uptspt-politics')) {
      info.push('Congressional actions and legislative developments');
      info.push('Administration policies and executive orders');
      info.push('Supreme Court decisions and legal challenges');
      info.push('State-level political developments');
      info.push('Public opinion polls and approval ratings');
      info.push('Political scandals and controversies');
    } else if (categoryLower.includes('politics')) {
      info.push('Government policy changes and announcements');
      info.push('Legislative developments and voting records');
      info.push('Public opinion and polling data');
      info.push('Political party strategies and positions');
      info.push('International relations and diplomatic moves');
    } else if (categoryLower.includes('geopolitics')) {
      info.push('International relations and diplomatic developments');
      info.push('Military actions and defense policies');
      info.push('Trade agreements and economic sanctions');
      info.push('Alliance formations and treaty negotiations');
      info.push('Regional conflicts and peace processes');
      info.push('UN and international organization actions');
    
    // Sports categories
    } else if (categoryLower.includes('formula1') || categoryLower.includes('f1')) {
      info.push('Current championship standings and points');
      info.push('Recent race results and finishing positions');
      info.push('Driver performance and current form');
      info.push('Team performance and car development');
      info.push('Qualifying results and grid positions');
      info.push('Upcoming race schedule and track characteristics');
      info.push('Driver/team injuries and technical issues');
    } else if (categoryLower.includes('nfl')) {
      info.push('Current season standings and win-loss records');
      info.push('Recent game results and scores');
      info.push('Player statistics and performance metrics');
      info.push('Team injuries and roster changes');
      info.push('Upcoming schedule and matchups');
      info.push('Playoff implications and scenarios');
    } else if (categoryLower.includes('nba')) {
      info.push('Current season standings and win-loss records');
      info.push('Recent game results and scores');
      info.push('Player statistics and performance metrics');
      info.push('Team injuries and roster changes');
      info.push('Upcoming schedule and matchups');
      info.push('Playoff seeding and tiebreakers');
    } else if (categoryLower.includes('mlb')) {
      info.push('Current season standings and win-loss records');
      info.push('Recent game results and scores');
      info.push('Player statistics and batting/pitching stats');
      info.push('Team injuries and roster changes');
      info.push('Upcoming schedule and series matchups');
      info.push('Playoff race and wild card standings');
    } else if (categoryLower.includes('nhl')) {
      info.push('Current season standings and points');
      info.push('Recent game results and scores');
      info.push('Player statistics and performance metrics');
      info.push('Team injuries and roster changes');
      info.push('Upcoming schedule and matchups');
      info.push('Playoff race and wild card standings');
    } else if (categoryLower.includes('soccer')) {
      info.push('Current league standings and points');
      info.push('Recent match results and scores');
      info.push('Player statistics and goal/assist records');
      info.push('Team injuries and squad availability');
      info.push('Upcoming fixtures and schedule');
      info.push('Transfer news and roster changes');
    } else if (categoryLower.includes('sports')) {
      info.push('Current standings and recent performance');
      info.push('Latest news and recent developments');
      info.push('Recent wins, losses, and results');
      info.push('Current form and momentum');
      info.push('Team/player injuries and availability');
      info.push('Upcoming fixtures and schedule');
    
    // Finance categories
    } else if (categoryLower.includes('crypto') || categoryLower.includes('crypto-prices')) {
      info.push('Current cryptocurrency prices and market cap');
      info.push('Trading volume and liquidity metrics');
      info.push('Regulatory developments and government actions');
      info.push('Exchange listings and delistings');
      info.push('Network upgrades and technical developments');
      info.push('Market sentiment and fear/greed index');
      info.push('Whale movements and large transactions');
    } else if (categoryLower.includes('stocks')) {
      info.push('Current stock prices and market cap');
      info.push('Earnings reports and financial results');
      info.push('Analyst ratings and price targets');
      info.push('Company news and announcements');
      info.push('Market trends and sector performance');
      info.push('Insider trading and institutional activity');
    } else if (categoryLower.includes('economy') || categoryLower.includes('economics')) {
      info.push('Economic indicators and data releases');
      info.push('Central bank policies and interest rate decisions');
      info.push('Inflation and employment statistics');
      info.push('GDP growth and forecasts');
      info.push('Government fiscal policies and budget decisions');
      info.push('Trade balance and international trade data');
    } else if (categoryLower.includes('business')) {
      info.push('Company financial reports and earnings');
      info.push('Business strategy and expansion plans');
      info.push('Market share and competitive position');
      info.push('Management changes and leadership');
      info.push('Product launches and innovations');
      info.push('Merger and acquisition activity');
    
    // Tech categories
    } else if (categoryLower.includes('artificial-intelligence') || categoryLower.includes('ai')) {
      info.push('Latest AI model releases and capabilities');
      info.push('AI research breakthroughs and papers');
      info.push('Company AI product launches and updates');
      info.push('Regulatory developments and AI governance');
      info.push('AI adoption rates and use cases');
      info.push('Competitive landscape and market leaders');
    } else if (categoryLower.includes('big-tech') || categoryLower.includes('tech')) {
      info.push('Product announcements and releases');
      info.push('Company financial reports and earnings');
      info.push('Industry trends and market analysis');
      info.push('Regulatory actions and antitrust cases');
      info.push('Partnerships and strategic alliances');
      info.push('Innovation and R&D developments');
    
    // Entertainment categories
    } else if (categoryLower.includes('movies')) {
      info.push('Box office performance and revenue');
      info.push('Critical reviews and audience ratings');
      info.push('Award nominations and wins');
      info.push('Release dates and distribution plans');
      info.push('Cast and crew announcements');
      info.push('Marketing campaigns and promotional activity');
    } else if (categoryLower.includes('music')) {
      info.push('Chart positions and streaming numbers');
      info.push('Album and single releases');
      info.push('Award nominations and wins');
      info.push('Tour dates and concert announcements');
      info.push('Artist collaborations and features');
      info.push('Industry recognition and critical acclaim');
    } else if (categoryLower.includes('video-games') || categoryLower.includes('gaming')) {
      info.push('Game sales and revenue figures');
      info.push('Critical reviews and user ratings');
      info.push('Release dates and launch announcements');
      info.push('Update patches and content releases');
      info.push('Esports tournaments and competitive results');
      info.push('Player base and active user numbers');
    } else if (categoryLower.includes('pop-culture') || categoryLower.includes('entertainment')) {
      info.push('Trending topics and viral content');
      info.push('Celebrity news and social media activity');
      info.push('Award shows and nominations');
      info.push('Cultural events and milestones');
      info.push('Fan engagement and community activity');
    
    // Health categories
    } else if (categoryLower.includes('covid')) {
      info.push('Case numbers and infection rates');
      info.push('Vaccination rates and distribution');
      info.push('Government policies and restrictions');
      info.push('Variant developments and research');
      info.push('Healthcare system capacity');
      info.push('International travel restrictions');
    } else if (categoryLower.includes('health')) {
      info.push('Medical research and clinical trials');
      info.push('FDA approvals and regulatory decisions');
      info.push('Public health data and statistics');
      info.push('Healthcare policy changes');
      info.push('Disease outbreaks and containment');
      info.push('Treatment availability and access');
    
    // Climate and environment
    } else if (categoryLower.includes('climate')) {
      info.push('Temperature records and climate data');
      info.push('Extreme weather events and patterns');
      info.push('Government climate policies and commitments');
      info.push('Carbon emissions and reduction targets');
      info.push('Renewable energy adoption and capacity');
      info.push('International climate agreements');
    } else if (categoryLower.includes('weather')) {
      info.push('Current weather conditions and forecasts');
      info.push('Extreme weather events and warnings');
      info.push('Historical weather patterns and records');
      info.push('Seasonal trends and climate anomalies');
      info.push('Natural disaster impacts and recovery');
    
    // Space
    } else if (categoryLower.includes('space')) {
      info.push('Mission launches and schedules');
      info.push('Spacecraft status and operations');
      info.push('Scientific discoveries and research findings');
      info.push('NASA and space agency announcements');
      info.push('Commercial space developments');
      info.push('International space collaboration');
    
    // Legal
    } else if (categoryLower.includes('legal')) {
      info.push('Court decisions and rulings');
      info.push('Legal proceedings and case developments');
      info.push('Judicial appointments and confirmations');
      info.push('Legislative changes and law updates');
      info.push('Settlement negotiations and outcomes');
      info.push('Legal precedent and case law');
    
    // Geopolitical conflicts
    } else if (categoryLower.includes('ukraine')) {
      info.push('Military developments and battlefield updates');
      info.push('International aid and support packages');
      info.push('Diplomatic negotiations and peace talks');
      info.push('Economic sanctions and their impacts');
      info.push('Refugee movements and humanitarian situation');
      info.push('International alliance positions and support');
    } else if (categoryLower.includes('middle-east') || categoryLower.includes('israel')) {
      info.push('Military actions and conflict developments');
      info.push('Diplomatic negotiations and peace processes');
      info.push('International intervention and mediation');
      info.push('Humanitarian situation and aid delivery');
      info.push('Regional alliance positions');
      info.push('Economic impacts and sanctions');
    } else if (categoryLower.includes('immigration')) {
      info.push('Border policy changes and enforcement');
      info.push('Immigration statistics and data');
      info.push('Legal challenges and court decisions');
      info.push('International agreements and treaties');
      info.push('Refugee and asylum processing');
      info.push('Public opinion and political positions');
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
function generateSearchQueries(question: string, keyInformation: string[], category?: string): string[] {
  const queries: string[] = [];
  const questionWords = question.split(/\s+/).filter(w => w.length > 3); // Filter out short words
  const currentYear = new Date().getFullYear();

  // Primary query: market question itself
  queries.push(question);

  // Extract key terms from question
  const keyTerms = extractKeyTerms(question);
  if (keyTerms.length > 0) {
    queries.push(keyTerms.join(' '));
    // Add current year to key terms for time-sensitive queries
    queries.push(`${keyTerms.join(' ')} ${currentYear}`);
  }

  // Category-specific queries
  if (category) {
    const categoryLower = category.toLowerCase();
    
    // Politics categories
    if (categoryLower.includes('election') || categoryLower.includes('presidential-election')) {
      queries.push(`${keyTerms.join(' ')} polling ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} campaign ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} electoral college ${currentYear}`);
    } else if (categoryLower.includes('us-politics') || categoryLower.includes('uptspt-politics')) {
      queries.push(`${keyTerms.join(' ')} congress ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} supreme court ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} approval rating ${currentYear}`);
    } else if (categoryLower.includes('politics')) {
      queries.push(`${keyTerms.join(' ')} policy ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} legislation ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} polling ${currentYear}`);
    } else if (categoryLower.includes('geopolitics')) {
      queries.push(`${keyTerms.join(' ')} diplomatic ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} international relations ${currentYear}`);
    
    // Sports categories
    } else if (categoryLower.includes('formula1') || categoryLower.includes('f1')) {
      queries.push(`${keyTerms.join(' ')} championship standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} race results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} driver performance ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} qualifying ${currentYear}`);
    } else if (categoryLower.includes('nfl')) {
      queries.push(`${keyTerms.join(' ')} standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} game results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} player stats ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} playoff ${currentYear}`);
    } else if (categoryLower.includes('nba')) {
      queries.push(`${keyTerms.join(' ')} standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} game results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} player stats ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} playoff ${currentYear}`);
    } else if (categoryLower.includes('mlb')) {
      queries.push(`${keyTerms.join(' ')} standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} game results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} player stats ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} playoff ${currentYear}`);
    } else if (categoryLower.includes('nhl')) {
      queries.push(`${keyTerms.join(' ')} standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} game results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} player stats ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} playoff ${currentYear}`);
    } else if (categoryLower.includes('soccer')) {
      queries.push(`${keyTerms.join(' ')} league standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} match results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} player stats ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} transfer ${currentYear}`);
    } else if (categoryLower.includes('sports')) {
      queries.push(`${keyTerms.join(' ')} latest news ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} recent results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} current standings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} recent performance`);
      queries.push(`${keyTerms.join(' ')} current form`);
    
    // Finance categories
    } else if (categoryLower.includes('crypto') || categoryLower.includes('crypto-prices')) {
      queries.push(`${keyTerms.join(' ')} price ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} market cap ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} regulation ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} exchange ${currentYear}`);
    } else if (categoryLower.includes('stocks')) {
      queries.push(`${keyTerms.join(' ')} stock price ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} earnings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} analyst ${currentYear}`);
    } else if (categoryLower.includes('economy') || categoryLower.includes('economics')) {
      queries.push(`${keyTerms.join(' ')} economic data ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} central bank ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} inflation ${currentYear}`);
    } else if (categoryLower.includes('business')) {
      queries.push(`${keyTerms.join(' ')} earnings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} financial results ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} merger ${currentYear}`);
    
    // Tech categories
    } else if (categoryLower.includes('artificial-intelligence') || categoryLower.includes('ai')) {
      queries.push(`${keyTerms.join(' ')} AI model ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} AI research ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} AI product ${currentYear}`);
    } else if (categoryLower.includes('big-tech') || categoryLower.includes('tech')) {
      queries.push(`${keyTerms.join(' ')} product launch ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} earnings ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} antitrust ${currentYear}`);
    
    // Entertainment categories
    } else if (categoryLower.includes('movies')) {
      queries.push(`${keyTerms.join(' ')} box office ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} reviews ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} awards ${currentYear}`);
    } else if (categoryLower.includes('music')) {
      queries.push(`${keyTerms.join(' ')} chart ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} streaming ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} awards ${currentYear}`);
    } else if (categoryLower.includes('video-games') || categoryLower.includes('gaming')) {
      queries.push(`${keyTerms.join(' ')} sales ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} reviews ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} esports ${currentYear}`);
    } else if (categoryLower.includes('pop-culture') || categoryLower.includes('entertainment')) {
      queries.push(`${keyTerms.join(' ')} trending ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} viral ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} awards ${currentYear}`);
    
    // Health categories
    } else if (categoryLower.includes('covid')) {
      queries.push(`${keyTerms.join(' ')} cases ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} vaccination ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} variant ${currentYear}`);
    } else if (categoryLower.includes('health')) {
      queries.push(`${keyTerms.join(' ')} medical research ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} FDA approval ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} clinical trial ${currentYear}`);
    
    // Climate and environment
    } else if (categoryLower.includes('climate')) {
      queries.push(`${keyTerms.join(' ')} climate data ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} emissions ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} renewable energy ${currentYear}`);
    } else if (categoryLower.includes('weather')) {
      queries.push(`${keyTerms.join(' ')} weather forecast ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} extreme weather ${currentYear}`);
    
    // Space
    } else if (categoryLower.includes('space')) {
      queries.push(`${keyTerms.join(' ')} mission ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} NASA ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} spacecraft ${currentYear}`);
    
    // Legal
    } else if (categoryLower.includes('legal')) {
      queries.push(`${keyTerms.join(' ')} court decision ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} legal case ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} settlement ${currentYear}`);
    
    // Geopolitical conflicts
    } else if (categoryLower.includes('ukraine')) {
      queries.push(`${keyTerms.join(' ')} military ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} aid ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} sanctions ${currentYear}`);
    } else if (categoryLower.includes('middle-east') || categoryLower.includes('israel')) {
      queries.push(`${keyTerms.join(' ')} conflict ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} diplomatic ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} humanitarian ${currentYear}`);
    } else if (categoryLower.includes('immigration')) {
      queries.push(`${keyTerms.join(' ')} border policy ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} immigration data ${currentYear}`);
      queries.push(`${keyTerms.join(' ')} asylum ${currentYear}`);
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
    
    // Politics categories
    if (categoryLower.includes('election') || categoryLower.includes('presidential-election')) {
      factors.push('Polling data and voter sentiment');
      factors.push('Electoral college projections');
      factors.push('Campaign momentum and fundraising');
    } else if (categoryLower.includes('us-politics') || categoryLower.includes('uptspt-politics')) {
      factors.push('Congressional approval and voting records');
      factors.push('Supreme Court decisions');
      factors.push('Administration approval ratings');
    } else if (categoryLower.includes('politics')) {
      factors.push('Public opinion and polling');
      factors.push('Political endorsements');
      factors.push('Legislative support');
    } else if (categoryLower.includes('geopolitics')) {
      factors.push('International alliance positions');
      factors.push('Diplomatic leverage');
      factors.push('Military capabilities');
    
    // Sports categories
    } else if (categoryLower.includes('formula1') || categoryLower.includes('f1')) {
      factors.push('Championship points and standings');
      factors.push('Recent race performance');
      factors.push('Car reliability and technical issues');
      factors.push('Qualifying pace');
    } else if (categoryLower.includes('nfl') || categoryLower.includes('nba') || categoryLower.includes('mlb') || categoryLower.includes('nhl')) {
      factors.push('Win-loss record and standings');
      factors.push('Head-to-head matchups');
      factors.push('Injury reports and roster depth');
      factors.push('Home/away performance');
    } else if (categoryLower.includes('soccer')) {
      factors.push('League position and points');
      factors.push('Goal difference and form');
      factors.push('Squad depth and injuries');
      factors.push('Home/away record');
    } else if (categoryLower.includes('sports')) {
      factors.push('Team/player statistics');
      factors.push('Injury reports');
      factors.push('Recent form and momentum');
    
    // Finance categories
    } else if (categoryLower.includes('crypto') || categoryLower.includes('crypto-prices')) {
      factors.push('Market sentiment and fear/greed index');
      factors.push('Technical indicators and price action');
      factors.push('Trading volume and liquidity');
      factors.push('Regulatory environment');
    } else if (categoryLower.includes('stocks')) {
      factors.push('Earnings growth and P/E ratios');
      factors.push('Analyst ratings and price targets');
      factors.push('Market cap and trading volume');
      factors.push('Sector performance');
    } else if (categoryLower.includes('economy') || categoryLower.includes('economics')) {
      factors.push('Economic indicators (GDP, inflation, employment)');
      factors.push('Central bank policy and interest rates');
      factors.push('Government fiscal policy');
      factors.push('Trade balance and currency strength');
    } else if (categoryLower.includes('business')) {
      factors.push('Revenue growth and profitability');
      factors.push('Market share and competitive position');
      factors.push('Management quality and strategy');
      factors.push('Merger and acquisition activity');
    
    // Tech categories
    } else if (categoryLower.includes('artificial-intelligence') || categoryLower.includes('ai')) {
      factors.push('Model performance and capabilities');
      factors.push('Research breakthroughs and papers');
      factors.push('Product adoption and usage');
      factors.push('Regulatory framework');
    } else if (categoryLower.includes('big-tech') || categoryLower.includes('tech')) {
      factors.push('Product innovation and releases');
      factors.push('Revenue growth and profitability');
      factors.push('Market share and competition');
      factors.push('Regulatory scrutiny');
    
    // Entertainment categories
    } else if (categoryLower.includes('movies')) {
      factors.push('Box office performance');
      factors.push('Critical and audience ratings');
      factors.push('Award recognition');
      factors.push('Marketing budget and reach');
    } else if (categoryLower.includes('music')) {
      factors.push('Chart positions and streaming numbers');
      factors.push('Radio play and airtime');
      factors.push('Award recognition');
      factors.push('Social media engagement');
    } else if (categoryLower.includes('video-games') || categoryLower.includes('gaming')) {
      factors.push('Sales figures and revenue');
      factors.push('Critical and user ratings');
      factors.push('Active player base');
      factors.push('Esports performance');
    } else if (categoryLower.includes('pop-culture') || categoryLower.includes('entertainment')) {
      factors.push('Social media engagement');
      factors.push('Trending status and virality');
      factors.push('Award recognition');
      factors.push('Fan base size and activity');
    
    // Health categories
    } else if (categoryLower.includes('covid')) {
      factors.push('Case numbers and infection rates');
      factors.push('Vaccination coverage');
      factors.push('Variant prevalence');
      factors.push('Healthcare system capacity');
    } else if (categoryLower.includes('health')) {
      factors.push('Clinical trial results');
      factors.push('FDA approval status');
      factors.push('Treatment efficacy');
      factors.push('Market adoption');
    
    // Climate and environment
    } else if (categoryLower.includes('climate')) {
      factors.push('Temperature trends and records');
      factors.push('Carbon emissions levels');
      factors.push('Renewable energy adoption');
      factors.push('Policy implementation');
    } else if (categoryLower.includes('weather')) {
      factors.push('Weather pattern trends');
      factors.push('Extreme event frequency');
      factors.push('Seasonal anomalies');
      factors.push('Forecast accuracy');
    
    // Space
    } else if (categoryLower.includes('space')) {
      factors.push('Mission success rate');
      factors.push('Launch schedule adherence');
      factors.push('Budget and funding');
      factors.push('Technical capabilities');
    
    // Legal
    } else if (categoryLower.includes('legal')) {
      factors.push('Court precedent');
      factors.push('Legal argument strength');
      factors.push('Judicial composition');
      factors.push('Settlement likelihood');
    
    // Geopolitical conflicts
    } else if (categoryLower.includes('ukraine')) {
      factors.push('Military capabilities and resources');
      factors.push('International support and aid');
      factors.push('Economic sanctions impact');
      factors.push('Diplomatic negotiation progress');
    } else if (categoryLower.includes('middle-east') || categoryLower.includes('israel')) {
      factors.push('Military balance of power');
      factors.push('International intervention');
      factors.push('Humanitarian situation');
      factors.push('Regional alliance positions');
    } else if (categoryLower.includes('immigration')) {
      factors.push('Border enforcement capacity');
      factors.push('Legal framework and court decisions');
      factors.push('International agreements');
      factors.push('Public opinion and political will');
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



