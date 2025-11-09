import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware-api';
import { polymarketClient } from '@/lib/api/polymarket';
import { planResearchStrategy } from '@/lib/market-research/research-strategy';
import { gradeSource } from '@/lib/market-research/source-grading';
import { runMultiAgentAnalysis, runResearchAgent, EventContext } from '@/lib/market-research/multi-agent-analysis';
import { applyBayesianReasoning } from '@/lib/market-research/bayesian-reasoning';
import { FinalVerdict, MarketResearchResult, GradedSource, ValyuResult } from '@/lib/market-research/types';
import { getPrismaClient } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Request validation schema
 */
const researchRequestSchema = z.object({
  marketId: z.string().min(1, 'Market ID is required'),
  forceRefresh: z.boolean().optional().default(false), // Force refresh even if cached
  includeIntermediate: z.boolean().optional().default(true), // Include intermediate agent outputs
});

/**
 * POST /api/market-research
 * Run AI-powered market research analysis
 */
async function handler(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const validationResult = researchRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { marketId, forceRefresh, includeIntermediate } = validationResult.data;

    // Step 0: Check cache if not forcing refresh
    if (!forceRefresh) {
      const prisma = getPrismaClient();
      const cachedResearch = await prisma.marketResearch.findFirst({
        where: {
          userId: user.id,
          marketId: marketId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Return cached result if it's less than 24 hours old
      if (cachedResearch) {
        const cacheAge = Date.now() - new Date(cachedResearch.createdAt).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);
        
        if (cacheAgeHours < 24) {
          console.log(`[Market Research] Returning cached result (${cacheAgeHours.toFixed(1)} hours old)`);
          const cachedResult = cachedResearch.result as unknown as MarketResearchResult;
          
          // Add intermediate results if requested and available
          if (includeIntermediate && cachedResearch.intermediateResults) {
            (cachedResult as any).intermediate = cachedResearch.intermediateResults;
          }
          
          return NextResponse.json(cachedResult);
        }
      }
    }

    // Step 1: Fetch market data
    console.log(`[Market Research] Starting research for market: ${marketId}`);
    const market = await polymarketClient.getMarket(marketId);
    
    if (!market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    // Step 2: Plan research strategy
    console.log('[Market Research] Planning research strategy...');
    const researchStrategy = planResearchStrategy(market);

    // Step 2.5: Detect event context if market is part of an event group
    let eventContext: EventContext | undefined;
    const eventId = market.eventId;
    const hasEventInfo = eventId && (market as any).eventTitle;
    
    if (hasEventInfo) {
      console.log(`[Market Research] Market is part of event: ${(market as any).eventTitle}`);
      try {
        // Fetch all markets to find event group
        const allMarkets = await polymarketClient.getMarkets({ active: true });
        const eventMarkets = allMarkets.filter(m => m.eventId === eventId);
        
        if (eventMarkets.length > 1) {
          console.log(`[Market Research] Found ${eventMarkets.length} markets in event`);
          eventContext = {
            eventTitle: (market as any).eventTitle,
            allMarkets: eventMarkets,
            analyzedMarketId: market.id,
          };
        }
      } catch (error) {
        console.error('[Market Research] Failed to fetch event markets:', error);
        // Continue without event context
      }
    }

    // Step 3: Execute Research Agent to gather information
    console.log('[Market Research] Running Research Agent...');
    let uniqueResults: ValyuResult[] = [];
    try {
      // Add timeout wrapper for research agent (60 seconds max)
      const researchPromise = runResearchAgent(market, researchStrategy, eventContext);
      const timeoutPromise = new Promise<ValyuResult[]>((_, reject) => {
        setTimeout(() => reject(new Error('Research agent timed out after 60 seconds')), 60000);
      });
      
      const researchResults = await Promise.race([researchPromise, timeoutPromise]);
      uniqueResults = researchResults;
      
      console.log(`[Market Research] Research Agent found ${uniqueResults.length} sources`);
    } catch (error) {
      console.error('[Market Research] Research Agent failed:', error);
      return NextResponse.json(
        {
          error: 'Research agent failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    if (uniqueResults.length === 0) {
      return NextResponse.json(
        { error: 'No research results found. Please try again later.' },
        { status: 500 }
      );
    }

    // Step 4: Grade all sources (A-D)
    console.log(`[Market Research] Grading ${uniqueResults.length} sources...`);
    const gradedSources: GradedSource[] = uniqueResults.map(source =>
      gradeSource(source)
    );

    // Sort by grade (A first, then B, C, D)
    const gradeOrder = { A: 0, B: 1, C: 2, D: 3 };
    gradedSources.sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);

    // Step 5: Run multi-agent analysis loop
    console.log('[Market Research] Running multi-agent analysis...');
    let analysisResult;
    try {
      // Add timeout wrapper for multi-agent analysis (90 seconds max)
      const analysisPromise = runMultiAgentAnalysis(market, gradedSources);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Multi-agent analysis timed out after 90 seconds')), 90000);
      });
      
      analysisResult = await Promise.race([analysisPromise, timeoutPromise]) as Awaited<ReturnType<typeof runMultiAgentAnalysis>>;
    } catch (error) {
      console.error('[Market Research] Multi-agent analysis failed:', error);
      return NextResponse.json(
        {
          error: 'Multi-agent analysis failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Step 6: Apply Bayesian reasoning
    console.log('[Market Research] Applying Bayesian reasoning...');
    const bayesianResult = applyBayesianReasoning(
      gradedSources,
      analysisResult,
      market
    );

    // Step 7: Determine final verdict (YES/UNCERTAIN/NO)
    const verdict = determineFinalVerdict(bayesianResult.probabilities);

    // Build comprehensive result
    const result: MarketResearchResult = {
      marketId,
      marketQuestion: market.question || '',
      verdict,
      confidence: bayesianResult.confidence,
      gradedSources,
      analysisResult,
      bayesianResult,
      researchStrategy,
      timestamp: new Date().toISOString(),
    };

    // Store intermediate results if available
    const intermediateResults = (analysisResult as any).intermediate || null;

    // Step 8: Store result in database for caching and historical tracking
    try {
      const prisma = getPrismaClient();
      await prisma.marketResearch.create({
        data: {
          userId: user.id,
          marketId,
          marketQuestion: market.question || '',
          verdict,
          confidence: bayesianResult.confidence,
          result: result as Prisma.InputJsonValue,
          intermediateResults: intermediateResults ? (intermediateResults as Prisma.InputJsonValue) : null,
        },
      });
      console.log('[Market Research] Result stored in database');
    } catch (dbError) {
      console.error('[Market Research] Failed to store result in database:', dbError);
      // Continue even if database storage fails
    }

    console.log(`[Market Research] Research complete. Verdict: ${verdict} (confidence: ${(bayesianResult.confidence * 100).toFixed(1)}%)`);

    // Add intermediate results to response if requested
    const responseResult: any = { ...result };
    if (includeIntermediate && intermediateResults) {
      responseResult.intermediate = intermediateResults;
    }

    return NextResponse.json(responseResult);
  } catch (error) {
    console.error('[Market Research] Error:', error);
    return NextResponse.json(
      {
        error: 'Market research failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Determine final verdict based on Bayesian probabilities
 */
function determineFinalVerdict(probabilities: {
  yes: number;
  no: number;
  uncertain: number;
}): FinalVerdict {
  // Threshold logic:
  // YES: P(YES) > 0.65
  // NO: P(NO) > 0.65
  // UNCERTAIN: Otherwise
  if (probabilities.yes > 0.65) {
    return 'YES';
  } else if (probabilities.no > 0.65) {
    return 'NO';
  } else {
    return 'UNCERTAIN';
  }
}

// Export with rate limiting
// Note: This route can take 60-120 seconds due to multi-agent analysis
// Next.js API routes have a default timeout, but this should work for most deployments
export const POST = withRateLimit(handler, rateLimitConfigs.write);

// Increase max duration for this route (Vercel/serverless functions)
export const maxDuration = 180; // 180 seconds (3 minutes) - increased for OpenAI API calls

