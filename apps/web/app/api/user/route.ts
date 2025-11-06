import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getPrismaClient } from '@/lib/prisma';

/**
 * GET /api/user
 * Get current user information (email, walletAddress, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: dbUser });
  } catch (error) {
    console.error('[GET /api/user] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user information' },
      { status: 500 }
    );
  }
}

