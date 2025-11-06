import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

// Helper to load DATABASE_URL if not set
function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    // Try .env.local first, then .env
    const envFiles = ['.env.local', '.env'];
    for (const envFile of envFiles) {
      try {
        const envPath = join(process.cwd(), envFile);
        const envFileContent = readFileSync(envPath, 'utf8');
        // Try multiple patterns: with quotes, without quotes, with or without spaces
        const patterns = [
          /DATABASE_URL=['"]([^'"]+)['"]/,
          /DATABASE_URL=([^\s#]+)/,
        ];
        for (const pattern of patterns) {
          const match = envFileContent.match(pattern);
          if (match) {
            process.env.DATABASE_URL = match[1].trim();
            console.log(`Loaded DATABASE_URL from ${envFile}`);
            return;
          }
        }
      } catch (error) {
        // File doesn't exist or can't be read, try next file
        continue;
      }
    }
    console.warn('DATABASE_URL not found in .env.local or .env files');
  }
}

// Initialize Prisma Client with lazy initialization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

async function testDatabaseConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    // Try a simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyId, email, walletAddress } = body;

    if (!privyId) {
      return NextResponse.json({ error: 'Missing privyId' }, { status: 400 });
    }

    // Ensure DATABASE_URL is loaded
    ensureDatabaseUrl();

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set in environment variables');
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE')).join(', '));
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL environment variable is missing. Please restart the dev server after setting .env.local' },
        { status: 500 }
      );
    }

    console.log('DATABASE_URL is set, attempting database operation...');

    // Get Prisma client (will initialize with DATABASE_URL)
    const prisma = getPrismaClient();

    // Test database connection first
    const isConnected = await testDatabaseConnection(prisma);
    if (!isConnected) {
      return NextResponse.json(
        { 
          error: 'Database connection failed', 
          details: 'Unable to connect to the database. Please check your DATABASE_URL and ensure the database server is running. You may need to run `npx prisma migrate dev` to set up the database schema.'
        },
        { status: 500 }
      );
    }

    // Create or update user
    console.log('Attempting to upsert user with privyId:', privyId);
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {
        email: email ?? undefined,
        walletAddress: walletAddress ?? undefined,
      },
      create: {
        privyId,
        email: email ?? undefined,
        walletAddress: walletAddress ?? undefined,
      },
    });

    console.log('User upserted successfully:', user.id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Auth callback error:', error);
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Provide more specific error messages for common Prisma errors
    let errorDetails = 'An unexpected error occurred';

    if (error instanceof Error) {
      // Check for common Prisma/database errors
      if (error.message.includes('P1001') || error.message.includes('Can\'t reach database server')) {
        errorDetails = 'Cannot connect to the database server. Please check your DATABASE_URL and ensure the database is running.';
      } else if (error.message.includes('P1003') || error.message.includes('does not exist')) {
        errorDetails = 'Database does not exist. Please create the database or check your DATABASE_URL.';
      } else if (error.message.includes('P2002') || error.message.includes('Unique constraint')) {
        errorDetails = 'A user with this ID already exists.';
      } else if (error.message.includes('P2025') || error.message.includes('Record to update not found')) {
        errorDetails = 'User record not found.';
      } else if (error.message.includes('does not exist') || error.message.includes('relation') || error.message.includes('table')) {
        errorDetails = 'Database schema not found. Please run `npx prisma migrate dev` to set up the database tables.';
      } else if (error.message.includes('authentication') || error.message.includes('password')) {
        errorDetails = 'Database authentication failed. Please check your DATABASE_URL credentials.';
      } else {
        errorDetails = error.message;
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorDetails,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {})
      },
      { status: 500 }
    );
  }
}

