import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

const updateMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

/**
 * GET /api/teams/[id]/members
 * Fetch team members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.id;

    // Check if user is team member
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            walletAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[GET /api/teams/[id]/members] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/[id]/members
 * Add a member to the team
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.id;
    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Check if user is team owner or admin
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if member already exists
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: validatedData.userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'Member already exists' }, { status: 400 });
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: validatedData.userId,
        role: validatedData.role,
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

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[POST /api/teams/[id]/members] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/teams/[id]/members/[memberId]
 * Update a team member's role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.id;
    const memberId = params.memberId;
    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // Check if user is team owner or admin
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only owner can change roles to OWNER
    if (validatedData.role === 'OWNER' && teamMember.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owner can assign OWNER role' }, { status: 403 });
    }

    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: validatedData.role },
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

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[PATCH /api/teams/[id]/members/[memberId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]/members/[memberId]
 * Remove a member from the team
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.id;
    const memberId = params.memberId;

    // Check if user is team owner or admin
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if member exists
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing owner
    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 });
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/teams/[id]/members/[memberId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

