import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Ensure DATABASE_URL is loaded
    ensureDatabaseUrl();

    // Check DATABASE_URL
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    const workspaces = await prisma.workspace.findMany({
      where: { userId },
      include: {
        layouts: {
          orderBy: [
            { createdAt: 'desc' },
          ],
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Workspaces fetch error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      // Log Prisma-specific error details
      if ('code' in error) {
        console.error('Prisma error code:', (error as any).code);
      }
      if ('meta' in error) {
        console.error('Prisma error meta:', (error as any).meta);
      }
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error.message,
          code: 'code' in error ? (error as any).code : undefined,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, type, templateId } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        userId,
        name,
        type: type ?? 'CUSTOM',
      },
    });

    // If templateId is provided, create layout from template
    if (templateId) {
      try {
        const template = await prisma.template.findUnique({
          where: { id: templateId },
        });

        if (template && template.config) {
          // Create layout from template config
          await prisma.layout.create({
            data: {
              workspaceId: workspace.id,
              userId,
              name: 'Default Layout',
              config: template.config as Prisma.InputJsonValue,
              isDefault: true,
            },
          });
        }
      } catch (templateError) {
        console.error('Failed to create layout from template:', templateError);
        // Continue even if template loading fails
      }
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Workspace creation error:', error);
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

