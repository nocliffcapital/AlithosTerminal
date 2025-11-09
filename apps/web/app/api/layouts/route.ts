import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const layouts = await prisma.layout.findMany({
      where: { workspaceId },
      orderBy: { isDefault: 'desc' },
    });

    return NextResponse.json({ layouts });
  } catch (error) {
    console.error('Layouts fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, userId, name, config, isDefault } = body;

    if (!workspaceId || !name || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get userId from workspace if not provided
    let actualUserId = userId;
    if (!actualUserId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { userId: true },
      });
      if (!workspace) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      actualUserId = workspace.userId;
    }

    // Check if a default layout already exists for this workspace
    const existingDefault = await prisma.layout.findFirst({
      where: { workspaceId, isDefault: true },
    });

    let layout;
    
    // If a default layout exists and this is being set as default, update it instead of creating new
    if (existingDefault && isDefault) {
      layout = await prisma.layout.update({
        where: { id: existingDefault.id },
        data: {
          name,
          config: config as Prisma.InputJsonValue,
          isDefault: true,
        },
      });
    } else {
      // If this is set as default and there's an existing default, unset it first
      if (isDefault && existingDefault) {
        await prisma.layout.updateMany({
          where: { workspaceId, isDefault: true },
          data: { isDefault: false },
        });
      }
      
      layout = await prisma.layout.create({
        data: {
          workspaceId,
          userId: actualUserId,
          name,
          config: config as Prisma.InputJsonValue,
          isDefault: isDefault ?? false,
        },
      });
    }

    return NextResponse.json({ layout });
  } catch (error) {
    console.error('Layout creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

