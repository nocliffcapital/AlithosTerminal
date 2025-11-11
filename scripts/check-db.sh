#!/bin/bash

# Database Connection Check Script
echo "🔍 Checking database connection..."
echo ""

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"

# Load DATABASE_URL from .env.local
if [ -f "$WEB_DIR/.env.local" ]; then
  export DATABASE_URL=$(grep -E "^DATABASE_URL" "$WEB_DIR/.env.local" | cut -d'=' -f2- | tr -d '"')
  echo "✅ DATABASE_URL loaded from .env.local"
else
  echo "❌ .env.local not found at $WEB_DIR/.env.local"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo ""
echo "📊 Database URL: ${DATABASE_URL:0:50}..."
echo ""

# Try to connect
echo "🔌 Testing database connection..."
cd "$PROJECT_ROOT" && npx prisma db execute --schema=./prisma/schema.prisma --stdin <<< "SELECT 1;" 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database connection successful!"
else
  echo ""
  echo "❌ Database connection failed"
  echo ""
  echo "💡 Troubleshooting steps:"
  echo "   1. If using Neon, check your dashboard - the database may be paused"
  echo "   2. Wake the database from the Neon dashboard if it's paused"
  echo "   3. Verify DATABASE_URL is correct in .env.local"
  echo "   4. Check your network connection"
  echo ""
  echo "   For Neon databases:"
  echo "   - Visit https://console.neon.tech"
  echo "   - Find your project and wake the database if paused"
  echo ""
fi

