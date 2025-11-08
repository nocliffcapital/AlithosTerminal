import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Check if DATABASE_URL is set
    const dbUrlSet = !!process.env.DATABASE_URL;
    
    // Try a simple query
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      success: true,
      databaseUrlSet: dbUrlSet,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      userCount,
      message: 'Database connection successful',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        databaseUrlSet: !!process.env.DATABASE_URL,
        databaseUrlLength: process.env.DATABASE_URL?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

