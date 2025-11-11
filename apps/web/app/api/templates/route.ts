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

// GET: Fetch all templates for a user (or public templates)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const includePublic = searchParams.get('includePublic') === 'true';

    ensureDatabaseUrl();

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    const prisma = getPrismaClient();

    // Build where clause more safely
    const where: any = {};
    if (userId) {
      if (includePublic) {
        where.OR = [
          { userId },
          { isPublic: true },
          { isDefault: true }, // Always include default templates
        ];
      } else {
        where.OR = [
          { userId },
          { isDefault: true }, // Always include default templates
        ];
      }
    } else if (includePublic) {
      where.OR = [
        { isPublic: true },
        { isDefault: true }, // Always include default templates
      ];
    } else {
      // If no userId and includePublic is false, still return default templates
      where.isDefault = true;
    }

    try {
      const templates = await prisma.template.findMany({
        where,
        orderBy: [
          { isDefault: 'desc' } as any, // Default templates first
          { createdAt: 'desc' },
        ],
      });

      return NextResponse.json({ templates });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // If query fails, try a simpler query as fallback
      try {
        const templates = await prisma.template.findMany({
          where: { isDefault: true } as any,
          orderBy: { createdAt: 'desc' },
        });
        console.warn('Fallback query succeeded, returning default templates only');
        return NextResponse.json({ templates });
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw dbError; // Throw original error
      }
    }
  } catch (error) {
    console.error('Templates fetch error:', error);
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

// POST: Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, description, config, isPublic, isDefault } = body;

    if (!userId || !name || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prevent users from creating default templates - only system can do that
    if (isDefault === true) {
      return NextResponse.json(
        { error: 'Cannot create default templates via this endpoint' },
        { status: 403 }
      );
    }

    ensureDatabaseUrl();

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    const prisma = getPrismaClient();

    const template = await prisma.template.create({
      data: {
        userId,
        name,
        description: description || null,
        config: config as Prisma.InputJsonValue,
        isPublic: isPublic ?? false,
        isDefault: false, // Users cannot create default templates
      } as any,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template creation error:', error);
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

