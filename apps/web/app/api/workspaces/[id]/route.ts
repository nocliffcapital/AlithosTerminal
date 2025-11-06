import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

// Helper to ensure DATABASE_URL is loaded
function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try {
      const envPath = join(process.cwd(), '.env.local');
      const envFile = readFileSync(envPath, 'utf8');
      const match = envFile.match(/DATABASE_URL=['"]([^'"]+)['"]/);
      if (match) {
        process.env.DATABASE_URL = match[1];
      }
    } catch (error) {
      console.error('Failed to load .env.local:', error);
    }
  }
}

// Initialize Prisma Client with lazy initialization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient() {
  ensureDatabaseUrl();
  
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Please check .env.local and restart the server.');
    }
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
}

// Update workspace
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { name, type, locked } = body;
    const { id } = await params;

    // Ensure DATABASE_URL is loaded
    ensureDatabaseUrl();

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Build update data object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (locked !== undefined) updateData.locked = locked;

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Workspace update error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error.message,
          ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

// Delete workspace
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Ensure DATABASE_URL is loaded
    ensureDatabaseUrl();

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Delete workspace (cascades will handle layouts)
    await prisma.workspace.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workspace deletion error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error.message,
          ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

