/**
 * Seed script to initialize default templates in the database
 * Run with: npx tsx apps/web/scripts/seed-default-templates.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_TEMPLATES } from '../lib/templates/default-templates';

// Helper to ensure DATABASE_URL is loaded
function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try {
      // Look for .env.local in apps/web/ directory (where it's located)
      // This script is in apps/web/scripts/, so go up one level to apps/web/
      const envPath = join(__dirname, '..', '.env.local');
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

async function seedDefaultTemplates() {
  ensureDatabaseUrl();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please set it in .env.local');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    console.log('Starting to seed default templates...');

    // Check if default templates already exist
    const existingDefaults = await prisma.template.findMany({
      where: { isDefault: true },
    });

    if (existingDefaults.length > 0) {
      console.log(`Found ${existingDefaults.length} existing default templates.`);
      console.log('Options:');
      console.log('1. Skip seeding (templates already exist)');
      console.log('2. Delete existing and recreate');
      console.log('3. Update existing templates');
      
      // For automated scripts, we'll update existing templates
      console.log('Updating existing default templates...');
      
      for (const template of DEFAULT_TEMPLATES) {
        const existing = existingDefaults.find(
          (t) => t.name === template.name
        );

        if (existing) {
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
          console.log(`✓ Updated template: ${template.name}`);
        } else {
          await prisma.template.create({
            data: {
              name: template.name,
              description: template.description,
              config: template.config as any,
              isDefault: true,
              userId: null, // Default templates have no userId
            },
          });
          console.log(`✓ Created template: ${template.name}`);
        }
      }
    } else {
      // Create all default templates
      for (const template of DEFAULT_TEMPLATES) {
        await prisma.template.create({
          data: {
            name: template.name,
            description: template.description,
            config: template.config as any,
            isDefault: true,
            userId: null, // Default templates have no userId
          },
        });
        console.log(`✓ Created template: ${template.name}`);
      }
    }

    console.log('\n✅ Successfully seeded default templates!');
    
    // Verify the templates
    const allDefaults = await prisma.template.findMany({
      where: { isDefault: true },
    });
    console.log(`\nTotal default templates in database: ${allDefaults.length}`);
    allDefaults.forEach((t) => {
      console.log(`  - ${t.name}: ${t.description || 'No description'}`);
    });
  } catch (error) {
    console.error('Error seeding default templates:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDefaultTemplates()
  .then(() => {
    console.log('\n✨ Seed script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });

