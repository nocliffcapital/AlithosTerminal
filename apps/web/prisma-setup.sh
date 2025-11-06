#!/bin/bash

# Alithos Terminal Prisma Setup Script
# This script helps set up the Prisma database

echo "🚀 Alithos Terminal Prisma Setup"
echo "========================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in environment variables"
  echo "📝 Please set DATABASE_URL in your .env.local file"
  echo ""
  echo "Example:"
  echo 'DATABASE_URL="postgresql://user:password@localhost:5432/alithos_terminal?schema=public"'
  echo ""
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
  echo "❌ npx not found. Please install Node.js and npm"
  exit 1
fi

echo "📦 Generating Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
  echo "✅ Prisma Client generated successfully"
else
  echo "❌ Failed to generate Prisma Client"
  exit 1
fi

echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
  echo "✅ Database migrations completed successfully"
else
  echo "❌ Failed to run migrations"
  echo ""
  echo "💡 Troubleshooting:"
  echo "   1. Check that PostgreSQL is running"
  echo "   2. Verify DATABASE_URL is correct"
  echo "   3. Ensure the database exists"
  echo ""
  exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 To view your database:"
echo "   npx prisma studio"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""

