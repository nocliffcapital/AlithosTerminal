import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy Polymarket Gamma API markets list requests
 * This avoids CORS issues when calling from the browser
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active') ?? 'true';
    const closed = searchParams.get('closed') ?? 'false'; // Default to false to exclude closed markets
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' || limitParam === null || limitParam === undefined ? null : parseInt(limitParam);
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    
    // If category is specified, use events endpoint (events have tags array with slugs)
    // Note: The events endpoint doesn't filter by category/tag parameter, so we filter client-side
    if (category || tag) {
      const filterValue = tag || category;
      console.log('[API] Fetching events and filtering by tag:', filterValue);
      
      // Fetch all events (the API doesn't filter by category/tag parameter)
      // For large limits or no limit, we need to fetch more events since each event can have multiple markets
      const requestedLimit = limit;
      // If limit is null (fetch all), use a very large number or fetch in batches
      const eventsLimit = requestedLimit === null ? 10000 : Math.min(requestedLimit * 4, 10000);
      
      const eventsUrl = `https://gamma-api.polymarket.com/events?active=${active}&closed=${closed}&limit=${eventsLimit}`;
      
      const eventsResponse = await fetch(eventsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        
        // Filter events by matching tag slug in the events' tags array
        const filterValueLower = filterValue!.toLowerCase();
        const filteredEvents = events.filter((event: any) => {
          const eventTags = event.tags || [];
          return eventTags.some((tag: any) => {
            const tagSlug = tag?.slug?.toLowerCase();
            return tagSlug === filterValueLower || 
                   tagSlug?.includes(filterValueLower) || 
                   filterValueLower.includes(tagSlug || '');
          });
        });
        
        // Extract markets from filtered events and assign the matching tag slug as category
        const markets = filteredEvents.flatMap((event: any) => {
          if (event.markets && Array.isArray(event.markets)) {
            // Find the matching tag slug to use as category
            const matchingTag = event.tags?.find((tag: any) => {
              const tagSlug = tag?.slug?.toLowerCase();
              return tagSlug === filterValueLower || 
                     tagSlug?.includes(filterValueLower) || 
                     filterValueLower.includes(tagSlug || '');
            });
            
            // Get event-level image (events often have logos like NYC seal)
            // Check multiple possible field names for event images
            const eventImage = event.imageUrl || 
                              event.image || 
                              event.icon || 
                              event.logo ||
                              event.image_url ||
                              event.cover_image ||
                              event.thumbnail ||
                              event.photo ||
                              event.picture ||
                              undefined;
            
            // Debug: Log event image extraction for multimarkets
            if (event.markets.length > 1 && eventImage) {
              console.log(`[API] Event "${event.title || event.name || event.id}" (filtered) has ${event.markets.length} markets and image:`, eventImage);
            }
            
          return event.markets.map((market: any) => {
            // Improved image fallback chain: Check all possible market image fields
            const marketImage = market.imageUrl || 
                               market.image || 
                               market.icon ||
                               market.image_url ||
                               market.cover_image ||
                               market.thumbnail ||
                               market.photo ||
                               market.picture ||
                               undefined;
            
            // Use market-specific image first, only fall back to event image if market doesn't have one
            // Each market should have its own image (e.g., candidate headshot, team logo)
            // Event image is only used as a fallback when market doesn't have its own image
            const finalImageUrl = marketImage || eventImage || undefined;
            
            // Debug: Log when we assign event image to a market
            if (eventImage && !marketImage && event.markets.length > 1) {
              console.log(`[API] Assigning event image to market "${market.question || market.id}" (no market image available):`, eventImage);
            }
            
            // Extract Series information (Events can belong to Series)
            // Series is an array, take the first one if available
            const series = Array.isArray(event.series) && event.series.length > 0 ? event.series[0] : null;
            const seriesId = series?.id?.toString() || event.seriesId?.toString() || event.series_id?.toString() || null;
            const seriesTitle = series?.title || series?.name || null;
            const seriesImageUrl = series?.image || series?.imageUrl || series?.icon || null;
            const seriesSlug = series?.slug || event.seriesSlug || null;
            
            return {
              ...market,
              // Assign the matching tag slug as the category
              category: matchingTag?.slug || filterValue,
              // Use improved image fallback chain (market image first, then event image, then series image)
              imageUrl: finalImageUrl,
              // Store event information for grouping
              eventId: event.id || event.slug || event.title,
              eventImageUrl: eventImage,
              eventTitle: event.title || event.name,
              // Store series information for Series-level grouping
              seriesId: seriesId || undefined,
              seriesTitle: seriesTitle || undefined,
              seriesImageUrl: seriesImageUrl || undefined,
              seriesSlug: seriesSlug || undefined,
            };
          });
          }
          return [];
        });
        
      // Only slice if we have a limit and more markets than requested
      const finalMarkets = requestedLimit !== null && markets.length > requestedLimit
        ? markets.slice(0, requestedLimit)
        : markets;
      
      console.log(`[API] ✅ Fetched ${events.length} events, filtered to ${filteredEvents.length} events with tag "${filterValue}", extracted ${markets.length} markets (returning ${finalMarkets.length})`);
      return NextResponse.json(finalMarkets);
      } else {
        console.warn('[API] Events endpoint failed, falling back to markets endpoint');
      }
    }
    
    // Default: Use events endpoint to get event images (even when no category filter)
    // This ensures we get event-level images like NYC seal
    // For large limits or no limit, we need to fetch more events since each event can have multiple markets
    const requestedLimit = limit;
    // If limit is null (fetch all), use a very large number
    // Most events have 1-5 markets, so we multiply by 3-4 to ensure we get enough
    const eventsLimit = requestedLimit === null ? 10000 : Math.min(requestedLimit * 4, 10000);
    
    console.log(`[API] Fetching events to get event images for markets (requesting ${requestedLimit === null ? 'ALL' : requestedLimit} markets, fetching up to ${eventsLimit} events)...`);
    const eventsUrl = `https://gamma-api.polymarket.com/events?active=${active}&closed=${closed}&limit=${eventsLimit}`;
    
    const eventsResponse = await fetch(eventsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      
      // Debug: Log sample event structure to understand image fields
      if (events.length > 0) {
        const sampleEvent = events[0];
        const imageFields = Object.keys(sampleEvent).filter(key => 
          key.toLowerCase().includes('image') || 
          key.toLowerCase().includes('icon') || 
          key.toLowerCase().includes('logo') ||
          key.toLowerCase().includes('photo') ||
          key.toLowerCase().includes('picture') ||
          key.toLowerCase().includes('thumbnail') ||
          key.toLowerCase().includes('cover')
        );
        console.log(`[API] Sample event image fields:`, imageFields);
        if (sampleEvent.markets && sampleEvent.markets.length > 1) {
          console.log(`[API] Sample multimarket event has ${sampleEvent.markets.length} markets. Event keys:`, Object.keys(sampleEvent));
        }
      }
      
      // Extract all markets from events (no category filtering here)
      const markets = events.flatMap((event: any) => {
        if (event.markets && Array.isArray(event.markets)) {
          // Get event-level image (events often have logos like NYC seal)
          // Check multiple possible field names for event images
          const eventImage = event.imageUrl || 
                            event.image || 
                            event.icon || 
                            event.logo || 
                            event.image_url ||
                            event.cover_image ||
                            event.thumbnail ||
                            event.photo ||
                            event.picture ||
                            undefined;
          
          // Debug: Log event image extraction for multimarkets (events with multiple markets)
          if (event.markets.length > 1 && eventImage) {
            console.log(`[API] Event "${event.title || event.name || event.id}" has ${event.markets.length} markets and image:`, eventImage);
          }
          
          return event.markets.map((market: any) => {
            // Improved image fallback chain: Check all possible market image fields
            const marketImage = market.imageUrl || 
                               market.image || 
                               market.icon ||
                               market.image_url ||
                               market.cover_image ||
                               market.thumbnail ||
                               market.photo ||
                               market.picture ||
                               undefined;
            
            // Use market-specific image first, only fall back to event image if market doesn't have one
            // Each market should have its own image (e.g., candidate headshot, team logo)
            // Event image is only used as a fallback when market doesn't have its own image
            const finalImageUrl = marketImage || eventImage || undefined;
            
            // Debug: Log when we assign event image to a market
            if (eventImage && !marketImage && event.markets.length > 1) {
              console.log(`[API] Assigning event image to market "${market.question || market.id}" (no market image available):`, eventImage);
            }
            
            // Extract Series information (Events can belong to Series)
            // Series is an array, take the first one if available
            const series = Array.isArray(event.series) && event.series.length > 0 ? event.series[0] : null;
            const seriesId = series?.id?.toString() || event.seriesId?.toString() || event.series_id?.toString() || null;
            const seriesTitle = series?.title || series?.name || null;
            const seriesImageUrl = series?.image || series?.imageUrl || series?.icon || null;
            const seriesSlug = series?.slug || event.seriesSlug || null;
            
            return {
              ...market,
              // Use improved image fallback chain (market image first, then event image, then series image)
              imageUrl: finalImageUrl,
              // Store event information for grouping
              // IMPORTANT: eventId must be a numeric ID (string), not slug or title
              // The comments API requires a numeric parent_entity_id
              eventId: event.id ? event.id.toString() : undefined,
              eventImageUrl: eventImage,
              eventTitle: event.title || event.name,
              // Store series information for Series-level grouping
              seriesId: seriesId || undefined,
              seriesTitle: seriesTitle || undefined,
              seriesImageUrl: seriesImageUrl || undefined,
              seriesSlug: seriesSlug || undefined,
            };
          });
        }
        return [];
      });
      
      // Only slice if we have a limit and more markets than requested
      const finalMarkets = requestedLimit !== null && markets.length > requestedLimit
        ? markets.slice(0, requestedLimit)
        : markets;
      
      console.log(`[API] ✅ Fetched ${events.length} events, extracted ${markets.length} markets (returning ${finalMarkets.length} with event images)`);
      return NextResponse.json(finalMarkets);
    } else {
      console.warn('[API] Events endpoint failed, falling back to markets endpoint');
      
      // Fallback: Use markets endpoint (no category filter or events failed)
      // Use a very large limit if no limit specified
      const marketsLimit = limit === null ? 10000 : limit;
      let gammaApiUrl = `https://gamma-api.polymarket.com/markets?active=${active}&closed=${closed}&limit=${marketsLimit}`;
      if (tag) {
        gammaApiUrl += `&tag=${encodeURIComponent(tag)}`;
      }
      
      console.log('[API] Proxying Gamma API markets request:', gammaApiUrl);
      
      const response = await fetch(gammaApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging (increased for better reliability)
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorData: any = { error: `Gamma API error (${response.status}): ${response.statusText}` };
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData.details = errorText;
        }
        
        console.error(`[API] Gamma API error:`, errorData);
        
        return NextResponse.json(errorData, { status: response.status });
      }

      const data = await response.json();
      console.log(`[API] ✅ Successfully fetched ${Array.isArray(data) ? data.length : 0} markets from Gamma API`);
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('[API] Error proxying markets request:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - Gamma API took too long to respond. Using subgraph fallback.', details: error.message },
        { status: 504 }
      );
    }
    
    // If it's a network error (connection refused, DNS failure, etc.)
    if (error.message?.includes('fetch') || error.message?.includes('CORS') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return NextResponse.json(
        { error: 'Network error - could not reach Gamma API. This may be temporary - using subgraph fallback.', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets from Gamma API. Using subgraph fallback.', details: error.toString() },
      { status: 500 }
    );
  }
}

