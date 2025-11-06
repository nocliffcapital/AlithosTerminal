import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Helper to load DATABASE_URL from .env.local if not set
function loadDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try {
      // Try multiple paths to find .env.local
      // In Next.js API routes, process.cwd() might be different
      const cwd = process.cwd();
      const possiblePaths = [
        join(cwd, 'apps', 'web', '.env.local'),
        join(cwd, '.env.local'),
        // If we're in apps/web/lib, go up to apps/web
        cwd.includes('apps/web') ? join(cwd, '.env.local') : join(cwd, 'apps', 'web', '.env.local'),
      ];
      
      for (const envPath of possiblePaths) {
        try {
          const envFile = readFileSync(envPath, 'utf8');
          // Try multiple patterns to match DATABASE_URL
          const patterns = [
            /DATABASE_URL=['"]([^'"]+)['"]/,
            /DATABASE_URL=([^\s#]+)/,
          ];
          
          for (const pattern of patterns) {
            const match = envFile.match(pattern);
            if (match) {
              process.env.DATABASE_URL = match[1].trim();
              console.log(`✓ Loaded DATABASE_URL from ${envPath}`);
              return;
            }
          }
        } catch {
          // Try next path
          continue;
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not load .env.local:', error);
    }
  }
}

// Load DATABASE_URL before initializing Prisma
loadDatabaseUrl();

// Verify DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Prisma operations will fail.');
  console.warn('Make sure .env.local contains DATABASE_URL and restart the dev server.');
}

// Initialize Prisma Client lazily to avoid crashes during module load
function getPrismaClientInstance(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // Ensure DATABASE_URL is loaded before creating client
    loadDatabaseUrl();
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Please check .env.local and restart the server.');
    }
    
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
}

// Export prisma - initialize on first access
export const prisma = getPrismaClientInstance();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export getPrismaClient for backward compatibility
export function getPrismaClient() {
  return getPrismaClientInstance();
}

