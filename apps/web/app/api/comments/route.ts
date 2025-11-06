import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { polymarketClient } from '@/lib/api/polymarket';

// GET /api/comments?marketId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');

    if (!marketId) {
      return NextResponse.json(
        { error: 'marketId is required' },
        { status: 400 }
      );
    }

    // Fetch comments from Polymarket Gamma API
    try {
      // First, fetch the market to get its numeric ID (required by comments API)
      const market = await polymarketClient.getMarket(marketId);
      if (!market) {
        return NextResponse.json(
          { error: 'Market not found' },
          { status: 404 }
        );
      }

      // Get the numeric ID from the market (Polymarket API uses numeric IDs for comments)
      // The market.id might be a string representation of the numeric ID
      const numericMarketId = parseInt(market.id, 10);
      if (isNaN(numericMarketId)) {
        console.error('[Comments API] Market ID is not numeric:', market.id);
        return NextResponse.json(
          { error: 'Invalid market ID format' },
          { status: 400 }
        );
      }

      // Fetch comments using the numeric market ID
      const polymarketComments = await polymarketClient.getComments(numericMarketId.toString(), {
        limit: 100,
        offset: 0,
        order: 'createdAt',
        ascending: false,
      });

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

      return NextResponse.json(transformedComments);
    } catch (apiError: any) {
      console.error('[Comments API] Polymarket API error:', {
        message: apiError.message,
        name: apiError.name,
        stack: apiError.stack,
      });
      
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

