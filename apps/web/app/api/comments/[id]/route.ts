import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

// DELETE /api/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const commentId = params.id;

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    // Find comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user owns the comment
    if (comment.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own comments' },
        { status: 403 }
      );
    }

    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Comments API] Error deleting comment:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });

    // Check for Prisma-specific errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Comment not found', details: 'The comment may have already been deleted' },
        { status: 404 }
      );
    }

    // Check if it's a table not found error
    if (error.message?.includes('does not exist') || 
        error.message?.includes('Unknown table') || 
        error.code === 'P2021' ||
        error.message?.includes('model Comment')) {
      return NextResponse.json(
        { 
          error: 'Comments table not found', 
          details: 'Database migration required. Run: npx prisma migrate dev',
          hint: 'If migration was already run, restart the Next.js dev server to reload Prisma client.'
        },
        { status: 500 }
      );
    }

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
        error: 'Failed to delete comment', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}

