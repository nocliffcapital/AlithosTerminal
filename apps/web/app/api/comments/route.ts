import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { polymarketClient } from '@/lib/api/polymarket';

// GET /api/comments?marketId=xxx
// According to Polymarket API docs: https://docs.polymarket.com/api-reference/comments/list-comments
// Comments API doesn't require authentication - comments are public
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');

    console.log('[Comments API] GET request received, marketId:', marketId);

    if (!marketId) {
      console.warn('[Comments API] No marketId provided');
      return NextResponse.json(
        { error: 'marketId is required' },
        { status: 400 }
      );
    }

    // Fetch comments from Polymarket Gamma API
    try {
      console.log('[Comments API] Fetching market data for:', marketId);
      // First, fetch the market to get its ID (required by comments API)
      const market = await polymarketClient.getMarket(marketId);
      console.log('[Comments API] Market data received:', market ? { 
        id: market.id, 
        conditionId: market.conditionId,
        eventId: market.eventId,
        eventTitle: market.eventTitle,
        seriesId: market.seriesId,
        question: market.question
      } : 'null');
      
      if (!market) {
        console.warn('[Comments API] Market not found:', marketId);
        return NextResponse.json(
          { error: 'Market not found' },
          { status: 404 }
        );
      }

      // Try to get a numeric ID from the market
      // Polymarket comments API expects a numeric parent_entity_id
      // Comments are often attached to Events, not individual markets
      // Try eventId first (if available), then market.id, then conditionId, then the original marketId
      let numericMarketId: number | null = null;
      let entityIdToUse: number | null = null;
      let triedEventId = false;
      let triedSeriesId = false;
      let foundEventId: string | null = null;
      let foundEventTitle: string | null = null;
      let foundSeriesId: string | null = null;
      let foundSeriesTitle: string | null = null;
      
      // IMPORTANT: Comments are often on Series level, not Event level
      // First, try seriesId if available in market object (prioritize Series)
      if (market.seriesId) {
        const seriesIdAsInt = parseInt(market.seriesId, 10);
        if (!isNaN(seriesIdAsInt)) {
          entityIdToUse = seriesIdAsInt;
          triedSeriesId = true;
          foundSeriesId = market.seriesId;
          foundSeriesTitle = market.seriesTitle || null;
          console.log('[Comments API] Found seriesId in market object, will try Series entity type first:', seriesIdAsInt);
        }
      }
      
      // If no seriesId, try eventId if available in market object
      if (!foundSeriesId && market.eventId) {
        const eventIdAsInt = parseInt(market.eventId, 10);
        if (!isNaN(eventIdAsInt)) {
          entityIdToUse = eventIdAsInt;
          triedEventId = true;
          foundEventId = market.eventId;
          foundEventTitle = market.eventTitle || null;
          console.log('[Comments API] Found eventId in market object, will try Event entity type:', eventIdAsInt);
        }
      }
      
      // If no seriesId or eventId in market object, try to find them by searching events
      // This is necessary because getMarket() doesn't always include eventId/seriesId
      // IMPORTANT: Comments are often on Series level, then Event level, not individual markets
      // For example: "What price will Ethereum hit in 2025?" is the Series
      // "What price will Ethereum hit in November?" is an Event within that Series
      // Individual markets like "Will Ethereum hit $8,000?" belong to that event
      if (!foundSeriesId && !foundEventId) {
        try {
          console.log('[Comments API] Searching events for market:', marketId);
          // Try with a larger limit to find more events
          // Also try without the active/closed filters to find all events
          const eventsUrls = [
            `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=1000`,
            `https://gamma-api.polymarket.com/events?limit=1000`, // Try without filters
          ];
          
          let events: any[] = [];
          for (const eventsUrl of eventsUrls) {
            try {
              const eventsResponse = await fetch(eventsUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000), // 15 second timeout
              });
              
              if (eventsResponse.ok) {
                const fetchedEvents = await eventsResponse.json();
                events = fetchedEvents;
                console.log(`[Comments API] Found ${events.length} events from ${eventsUrl}`);
                break; // Use first successful response
              }
            } catch (err) {
              console.warn(`[Comments API] Failed to fetch from ${eventsUrl}:`, err);
              continue;
            }
          }
          
          if (events.length > 0) {
            console.log(`[Comments API] Searching through ${events.length} events for market ${marketId}`);
            console.log(`[Comments API] Market being searched:`, {
              marketId,
              marketIdFromAPI: market.id,
              conditionId: market.conditionId,
              slug: market.slug,
              question: market.question
            });
            
            // Find the event that contains this market
            let eventsChecked = 0;
            for (const event of events) {
              if (event.markets && Array.isArray(event.markets)) {
                eventsChecked++;
                
                // Try multiple matching strategies
                const marketInEvent = event.markets.find((m: any) => {
                  const marketIdMatch = m.id?.toString() === marketId || 
                                       m.id?.toString() === market.id;
                  const conditionIdMatch = m.conditionId?.toLowerCase() === market.conditionId?.toLowerCase();
                  const slugMatch = m.slug === market.slug || m.slug === marketId;
                  
                  return marketIdMatch || conditionIdMatch || slugMatch;
                });
                
                if (marketInEvent && event.id) {
                  // IMPORTANT: Check for Series first (comments are often on Series level)
                  // Series is an array in the event object, take the first one if available
                  const series = Array.isArray(event.series) && event.series.length > 0 ? event.series[0] : null;
                  const seriesId = series?.id || event.seriesId || event.series_id;
                  if (seriesId) {
                    const seriesIdAsInt = parseInt(seriesId.toString(), 10);
                    if (!isNaN(seriesIdAsInt)) {
                      // Prioritize Series ID over Event ID
                      entityIdToUse = seriesIdAsInt;
                      triedSeriesId = true;
                      foundSeriesId = seriesId.toString();
                      foundSeriesTitle = series?.title || series?.name || event.seriesTitle || null;
                      console.log('[Comments API] ✅ Found seriesId by searching events (prioritized):', {
                        seriesId: seriesIdAsInt,
                        seriesTitle: foundSeriesTitle,
                        eventId: event.id,
                        eventTitle: event.title || event.name,
                        eventSlug: event.slug,
                        marketId: marketId,
                        marketInEvent: marketInEvent.id,
                        totalMarketsInEvent: event.markets.length,
                        eventsChecked: eventsChecked
                      });
                      
                      // Also store eventId for reference
                      const eventIdAsInt = parseInt(event.id.toString(), 10);
                      if (!isNaN(eventIdAsInt)) {
                        foundEventId = event.id.toString();
                        foundEventTitle = event.title || event.name || null;
                      }
                      
                      break;
                    }
                  }
                  
                  // If no Series, use Event ID
                  const eventIdAsInt = parseInt(event.id.toString(), 10);
                  if (!isNaN(eventIdAsInt)) {
                    entityIdToUse = eventIdAsInt;
                    triedEventId = true;
                    foundEventId = event.id.toString();
                    foundEventTitle = event.title || event.name || null;
                    
                    console.log('[Comments API] ✅ Found eventId by searching events:', {
                      eventId: eventIdAsInt,
                      eventTitle: foundEventTitle,
                      eventSlug: event.slug,
                      marketId: marketId,
                      marketInEvent: marketInEvent.id,
                      totalMarketsInEvent: event.markets.length,
                      eventsChecked: eventsChecked
                    });
                    
                    break;
                  } else {
                    console.warn('[Comments API] Event ID is not numeric:', event.id);
                  }
                }
              }
            }
            
            if (!foundEventId) {
              console.warn('[Comments API] ⚠️ Could not find eventId for market:', marketId);
              console.warn('[Comments API] Market details:', {
                marketId,
                marketIdFromAPI: market.id,
                conditionId: market.conditionId,
                slug: market.slug,
                question: market.question
              });
              console.warn(`[Comments API] Checked ${eventsChecked} events with markets, but none matched`);
              
              // Log sample events for debugging
              if (events.length > 0) {
                const sampleEvent = events[0];
                console.log('[Comments API] Sample event structure:', {
                  id: sampleEvent.id,
                  title: sampleEvent.title,
                  slug: sampleEvent.slug,
                  marketsCount: sampleEvent.markets?.length || 0,
                  sampleMarketIds: sampleEvent.markets?.slice(0, 3).map((m: any) => m.id) || []
                });
              }
              
              // Try to fetch event directly by slug if we have a slug pattern
              // Some events might not be in the events list but can be fetched directly
              // Try to extract event slug from market question or slug
              const possibleEventSlug = market.slug?.replace(/-\d+$/, '').replace(/^market-/, '').replace(/^event-/, '');
              if (possibleEventSlug && possibleEventSlug !== market.slug) {
                console.log(`[Comments API] Trying to fetch event directly by slug: ${possibleEventSlug}`);
                try {
                  // Try to fetch event by slug (if Polymarket API supports it)
                  // This is a fallback if the event wasn't in the events list
                  const eventBySlugUrl = `https://gamma-api.polymarket.com/events?slug=${possibleEventSlug}&limit=1`;
                  const eventBySlugResponse = await fetch(eventBySlugUrl, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                  });
                  
                  if (eventBySlugResponse.ok) {
                    const eventsBySlug = await eventBySlugResponse.json();
                    if (Array.isArray(eventsBySlug) && eventsBySlug.length > 0) {
                      const event = eventsBySlug[0];
                      if (event.id) {
                        const eventIdAsInt = parseInt(event.id.toString(), 10);
                        if (!isNaN(eventIdAsInt)) {
                          entityIdToUse = eventIdAsInt;
                          triedEventId = true;
                          foundEventId = event.id.toString();
                          foundEventTitle = event.title || event.name || null;
                          console.log('[Comments API] ✅ Found eventId by slug lookup:', {
                            eventId: eventIdAsInt,
                            eventTitle: foundEventTitle,
                            eventSlug: event.slug,
                            searchedSlug: possibleEventSlug
                          });
                        }
                      }
                    }
                  }
                } catch (slugError: any) {
                  console.warn('[Comments API] Could not fetch event by slug (non-critical):', slugError.message);
                }
              }
            }
          } else {
            console.warn('[Comments API] No events found from events API');
          }
        } catch (eventSearchError: any) {
          console.warn('[Comments API] Could not search events for eventId (non-critical):', eventSearchError.message);
          // Continue with market ID fallback
        }
      }
      
      // If no eventId found, try parsing market.id as integer
      if (entityIdToUse === null) {
        const idAsInt = parseInt(market.id, 10);
        if (!isNaN(idAsInt)) {
          entityIdToUse = idAsInt;
        } else {
          // Try conditionId
          const conditionIdAsInt = parseInt(market.conditionId, 10);
          if (!isNaN(conditionIdAsInt)) {
            entityIdToUse = conditionIdAsInt;
          } else {
            // Try the original marketId parameter
            const marketIdAsInt = parseInt(marketId, 10);
            if (!isNaN(marketIdAsInt)) {
              entityIdToUse = marketIdAsInt;
            }
          }
        }
      }
      
      numericMarketId = entityIdToUse;

      if (numericMarketId === null) {
        console.error('[Comments API] Could not find numeric ID for market:', {
          marketId,
          marketIdValue: market.id,
          conditionId: market.conditionId,
          eventId: market.eventId,
        });
        // Return empty array instead of error - some markets may not have comments
        return NextResponse.json([]);
      }

      console.log('[Comments API] Using numeric ID:', numericMarketId, triedEventId ? '(from eventId)' : '(from marketId)');
      console.log('[Comments API] Market details:', {
        originalMarketId: marketId,
        marketIdFromAPI: market.id,
        conditionId: market.conditionId,
        eventId: foundEventId || market.eventId || 'not found',
        eventTitle: foundEventTitle || (market as any).eventTitle || 'not found',
        seriesId: foundSeriesId || 'not found',
        seriesTitle: foundSeriesTitle || 'not found',
        numericMarketId,
        usingEventId: triedEventId,
        usingSeriesId: triedSeriesId,
      });
      console.log('[Comments API] Calling polymarketClient.getComments...');
      
      // Fetch comments using the numeric ID
      // Try both eventId (if found) and marketId, as comments might be on either
      let polymarketComments: any[] = [];
      
      // Prepare comment params according to Polymarket API docs
      // limit and offset are required (>= 0), default to limit=100, offset=0
      const commentParams = {
        limit: 100,
        offset: 0,
        order: 'createdAt' as const,
        ascending: false,
      };
      
      // Try ALL possible IDs with ALL entity types
      // Comments can be on Series, Event, or Market level - we need to try everything
      // getComments() automatically tries all entity types (Event, Series, market) for each ID
      
      const idsToTry: Array<{ id: number; name: string; type: 'series' | 'event' | 'market' }> = [];
      
      // Collect all possible IDs to try
      if (foundSeriesId) {
        const seriesIdAsInt = parseInt(foundSeriesId, 10);
        if (!isNaN(seriesIdAsInt)) {
          idsToTry.push({ id: seriesIdAsInt, name: 'Series ID', type: 'series' });
        }
      }
      
      if (foundEventId) {
        const eventIdAsInt = parseInt(foundEventId, 10);
        if (!isNaN(eventIdAsInt)) {
          idsToTry.push({ id: eventIdAsInt, name: 'Event ID', type: 'event' });
        }
      }
      
      // Try market ID from market object
      const marketIdAsInt = parseInt(market.id, 10);
      if (!isNaN(marketIdAsInt)) {
        idsToTry.push({ id: marketIdAsInt, name: 'Market ID (from market object)', type: 'market' });
      }
      
      // Try original marketId parameter
      const originalMarketIdAsInt = parseInt(marketId, 10);
      if (!isNaN(originalMarketIdAsInt) && originalMarketIdAsInt !== marketIdAsInt) {
        idsToTry.push({ id: originalMarketIdAsInt, name: 'Market ID (from parameter)', type: 'market' });
      }
      
      // Try numericMarketId if different
      if (numericMarketId && !idsToTry.some(item => item.id === numericMarketId)) {
        idsToTry.push({ id: numericMarketId, name: 'Numeric Market ID', type: 'market' });
      }
      
      console.log(`[Comments API] Will try ${idsToTry.length} different IDs:`, idsToTry.map(item => `${item.name} (${item.id})`).join(', '));
      
      // Try each ID until we find comments
      for (const idInfo of idsToTry) {
        if (polymarketComments.length > 0) {
          console.log(`[Comments API] ✅ Already found comments, stopping search`);
          break; // Stop if we found comments
        }
        
        console.log(`[Comments API] 🔍 Trying ${idInfo.name} (${idInfo.id}) - getComments will try all entity types (Event, Series, market)`);
        const comments = await polymarketClient.getComments(idInfo.id.toString(), commentParams);
        
        console.log(`[Comments API] 📊 getComments returned ${comments.length} comments for ${idInfo.name} (${idInfo.id})`);
        
        if (comments.length > 0) {
          polymarketComments = comments;
          if (idInfo.type === 'series') {
            triedSeriesId = true;
          } else if (idInfo.type === 'event') {
            triedEventId = true;
          }
          console.log(`[Comments API] ✅ SUCCESS: Found ${comments.length} comments using ${idInfo.name} (${idInfo.id})`);
          break; // Stop searching once we find comments
        } else {
          console.log(`[Comments API] ⚠️ No comments found with ${idInfo.name} (${idInfo.id}) - will try next ID`);
        }
      }
      
      if (polymarketComments.length === 0) {
        console.warn(`[Comments API] ❌ No comments found after trying all ${idsToTry.length} IDs`);
        console.warn(`[Comments API] Tried IDs:`, idsToTry.map(item => `${item.name} (${item.id})`).join(', '));
        console.warn(`[Comments API] Market info:`, {
          marketId,
          marketIdFromAPI: market.id,
          conditionId: market.conditionId,
          eventId: foundEventId,
          eventTitle: foundEventTitle,
          seriesId: foundSeriesId,
          question: market.question
        });
      }
      
      console.log('[Comments API] getComments returned:', Array.isArray(polymarketComments) ? `${polymarketComments.length} comments` : 'not an array');
      if (polymarketComments.length > 0) {
        console.log('[Comments API] Sample comment:', JSON.stringify(polymarketComments[0], null, 2));
      } else {
        console.warn('[Comments API] ⚠️ No comments found. This could mean:');
        console.warn('[Comments API]   1. The market has no comments on Polymarket');
        console.warn('[Comments API]   2. The entity type doesn\'t match (tried: Event, Series, market)');
        console.warn('[Comments API]   3. The numeric ID conversion is incorrect');
        console.warn('[Comments API]   Market ID:', marketId, 'Numeric ID:', numericMarketId);
      }

      // Transform Polymarket comment format to match our expected format
      const transformedComments = polymarketComments.map((comment: any) => ({
        id: comment.id || '',
        userId: comment.userAddress || '',
        marketId: marketId,
        content: comment.body || '',
        createdAt: comment.createdAt || new Date().toISOString(),
        updatedAt: comment.updatedAt || comment.createdAt || new Date().toISOString(),
        user: {
          id: comment.userAddress || '',
          email: null,
          walletAddress: comment.userAddress || null,
          // Add Polymarket profile data if available
          profile: comment.profile ? {
            name: comment.profile.name || null,
            pseudonym: comment.profile.pseudonym || null,
            displayUsernamePublic: comment.profile.displayUsernamePublic || false,
            bio: comment.profile.bio || null,
            isMod: comment.profile.isMod || false,
            isCreator: comment.profile.isCreator || false,
            profileImage: comment.profile.profileImage || null,
            baseAddress: comment.profile.baseAddress || null,
          } : null,
        },
        reactions: comment.reactions || [],
        reactionCount: comment.reactionCount || 0,
        reportCount: comment.reportCount || 0,
        parentCommentID: comment.parentCommentID || null,
        replyAddress: comment.replyAddress || null,
      }));

      // Log success for debugging
      if (transformedComments.length > 0) {
        console.log(`[Comments API] Successfully fetched ${transformedComments.length} comments for market ${marketId}`);
      } else {
        console.log(`[Comments API] No comments found for market ${marketId} (numeric ID: ${numericMarketId})`);
      }
      
      // Include debug info in response for client-side logging
      const response = NextResponse.json(transformedComments);
      response.headers.set('X-Comments-Debug', JSON.stringify({
        marketId,
        numericMarketId,
        commentsFound: transformedComments.length,
        marketIdFromAPI: market.id,
        conditionId: market.conditionId,
        eventId: foundEventId || market.eventId || null,
        eventTitle: foundEventTitle || (market as any).eventTitle || null,
        seriesId: foundSeriesId || null,
        seriesTitle: foundSeriesTitle || null,
        usingEventId: triedEventId,
        usingSeriesId: triedSeriesId,
      }));
      return response;
    } catch (apiError: any) {
      console.error('[Comments API] Polymarket API error:', {
        message: apiError.message,
        name: apiError.name,
        stack: apiError.stack,
        marketId,
      });
      
      // If it's a "not found" or "no comments" type error, return empty array instead of error
      if (apiError.message?.includes('not found') || 
          apiError.message?.includes('No comments') ||
          apiError.message?.includes('404')) {
        console.log(`[Comments API] Market ${marketId} has no comments or comments not available`);
        return NextResponse.json([]);
      }
      
      throw apiError;
    }
  } catch (error: any) {
    console.error('[Comments API] Error fetching comments:', error);
    console.error('[Comments API] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch comments from Polymarket', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}

// POST /api/comments
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError || 'User not authenticated' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Comments API] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const { marketId, content } = body;

    if (!marketId || !content) {
      return NextResponse.json(
        { error: 'marketId and content are required' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content cannot exceed 5000 characters' },
        { status: 400 }
      );
    }

    // Create comment
    try {
      const comment = await prisma.comment.create({
        data: {
          userId: user.id,
          marketId,
          content: content.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
            },
          },
        },
      });

      return NextResponse.json(comment, { status: 201 });
    } catch (dbError: any) {
      console.error('[Comments API] Database error creating comment:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        name: dbError.name,
      });

      // Check for Prisma-specific errors
      if (dbError.code === 'P2002') {
        return NextResponse.json(
          { error: 'Duplicate comment', details: 'A comment with this ID already exists' },
          { status: 409 }
        );
      }

      if (dbError.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invalid reference', details: 'User or market does not exist' },
          { status: 400 }
        );
      }

      // Check if it's a table not found error
      if (dbError.message?.includes('does not exist') || 
          dbError.message?.includes('Unknown table') || 
          dbError.code === 'P2021' ||
          dbError.message?.includes('model Comment')) {
        return NextResponse.json(
          { 
            error: 'Comments table not found', 
            details: 'Database migration required. Run: npx prisma migrate dev',
            hint: 'If migration was already run, restart the Next.js dev server to reload Prisma client.'
          },
          { status: 500 }
        );
      }

      throw dbError;
    }
  } catch (error: any) {
    console.error('[Comments API] Error creating comment:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });

    // Check if it's a Prisma client issue
    if (error.message?.includes('comment') || 
        error.message?.includes('Comment') ||
        error.message?.includes('Property \'comment\' does not exist')) {
      return NextResponse.json(
        { 
          error: 'Prisma client needs to be regenerated',
          details: 'The Comment model was added to the schema, but the Prisma client needs to be regenerated. Run: npx prisma generate',
          hint: 'Restart the Next.js dev server after regenerating the Prisma client.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to create comment', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}

