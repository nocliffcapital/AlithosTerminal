import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const layout = await prisma.layout.findUnique({
      where: { id },
    });

    if (!layout) {
      return NextResponse.json({ error: 'Layout not found' }, { status: 404 });
    }

    return NextResponse.json({ layout });
  } catch (error) {
    console.error('Layout fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, config, isDefault, workspaceId } = body;

    const existing = await prisma.layout.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Layout not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault && workspaceId) {
      await prisma.layout.updateMany({
        where: { workspaceId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const layout = await prisma.layout.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(config && { config }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({ layout });
  } catch (error) {
    console.error('Layout update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.layout.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Layout delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
