import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getPrismaClient } from '@/lib/prisma';
import { z } from 'zod';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
});

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

/**
 * PUT /api/user
 * Update current user information (email, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    const prisma = getPrismaClient();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(validated.email !== undefined && { email: validated.email }),
      },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('[PUT /api/user] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid user data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update user information' },
      { status: 500 }
    );
  }
}

