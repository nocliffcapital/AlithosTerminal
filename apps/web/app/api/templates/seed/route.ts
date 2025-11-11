/**
 * API endpoint to seed default templates
 * POST /api/templates/seed
 * 
 * This endpoint initializes default templates in the database.
 * Should be called during deployment or setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '@/lib/templates/default-templates';

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

// POST: Seed default templates
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, we'll allow it but you might want to restrict this in production
    
    ensureDatabaseUrl();

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL is missing' },
        { status: 500 }
      );
    }

    const prisma = getPrismaClient();

    console.log('Starting to seed default templates...');

    // Check if default templates already exist
    const existingDefaults = await prisma.template.findMany({
      where: { isDefault: true },
    });

    const results = {
      created: [] as string[],
      updated: [] as string[],
      skipped: [] as string[],
    };

    for (const template of DEFAULT_TEMPLATES) {
      const existing = existingDefaults.find(
        (t) => t.name === template.name
      );

      if (existing) {
        // Update existing template
        await prisma.template.update({
          where: { id: existing.id },
          data: {
            name: template.name,
            description: template.description,
            config: template.config as any,
            isDefault: true,
            userId: null, // Default templates have no userId
          },
        });
        results.updated.push(template.name);
        console.log(`✓ Updated template: ${template.name}`);
      } else {
        // Create new template
        await prisma.template.create({
          data: {
            name: template.name,
            description: template.description,
            config: template.config as any,
            isDefault: true,
            userId: null, // Default templates have no userId
          },
        });
        results.created.push(template.name);
        console.log(`✓ Created template: ${template.name}`);
      }
    }

    // Verify the templates
    const allDefaults = await prisma.template.findMany({
      where: { isDefault: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Default templates seeded successfully',
      results,
      totalDefaultTemplates: allDefaults.length,
      templates: allDefaults.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
    });
  } catch (error) {
    console.error('Error seeding default templates:', error);
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

