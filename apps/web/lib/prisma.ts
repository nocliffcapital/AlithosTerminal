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

// Export prisma - initialize lazily on first access
// Use a getter function to ensure truly lazy initialization (only when actually accessed)
let prismaInstance: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = getPrismaClientInstance();
    // Store in global for hot reload support
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance;
    }
  }
  return prismaInstance;
}

// Export prisma as a Proxy to maintain the same API while ensuring lazy initialization
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getPrisma();
    const value = (instance as any)[prop];
    // If it's a function, bind it to the instance
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// Export getPrismaClient for backward compatibility
export function getPrismaClient() {
  return getPrismaClientInstance();
}

