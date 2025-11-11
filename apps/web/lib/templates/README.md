# Default Templates System

This system provides default workspace templates that are automatically available to all users.

## Overview

Default templates are system-provided workspace layouts that users can select when creating a new workspace. They are marked with `isDefault: true` in the database and have no `userId` (they're system templates).

## Features

- **5 Default Templates**: One for each workspace type (SCALPING, EVENT_DAY, ARB_DESK, RESEARCH, CUSTOM)
- **Automatic Inclusion**: Default templates are always included when fetching templates
- **System-Only Creation**: Only the system can create default templates (users cannot)

## Templates

1. **Scalping Workspace** - Optimized for fast trading
   - Watchlist, Tape, Order Book, Quick Ticket, Depth, Positions

2. **Event Day Workspace** - Perfect for event-driven trading
   - Market Discovery, News, Market Research, Chart, Quick Ticket

3. **Arbitrage Desk** - Designed for arbitrage opportunities
   - Correlation Matrix, Exposure Tree, Activity Scanner, Positions, Watchlist

4. **Research Workspace** - Focused on market research
   - Market Discovery, Market Info, Market Research, News, Chart, Journal

5. **Starter Workspace** - A simple starter template
   - Watchlist, Tape, Quick Ticket

## Setup

### 1. Run the Migration

First, apply the database migration to add the `isDefault` field:

```bash
cd apps/web
npx prisma migrate dev --schema=../../prisma/schema.prisma
```

### 2. Seed Default Templates

You have two options to seed the default templates:

#### Option A: Using the API Endpoint

```bash
curl -X POST http://localhost:3000/api/templates/seed
```

#### Option B: Using the Seed Script

```bash
cd apps/web
npx tsx scripts/seed-default-templates.ts
```

## Usage

### For Users

Default templates automatically appear when:
- Creating a new workspace
- Viewing available templates
- They are sorted first in the template list

### For Developers

#### Adding New Default Templates

1. Edit `apps/web/lib/templates/default-templates.ts`
2. Add your template to the `DEFAULT_TEMPLATES` array
3. Run the seed script or API endpoint to update the database

#### Modifying Existing Templates

1. Edit the template in `default-templates.ts`
2. Run the seed script - it will update existing templates automatically

## API Endpoints

### GET /api/templates

Fetches templates for a user. Default templates are always included.

Query parameters:
- `userId` (optional): User ID to fetch user-specific templates
- `includePublic` (optional): Include public templates

Default templates are always included regardless of these parameters.

### POST /api/templates

Creates a new user template. Users cannot create default templates.

### POST /api/templates/seed

Seeds default templates into the database. Updates existing templates if they already exist.

## Database Schema

The `Template` model has been updated:

```prisma
model Template {
  id          String   @id @default(cuid())
  userId      String?  // Nullable for default/system templates
  name        String
  description String?
  config      Json     // Workspace layout config
  isPublic    Boolean  @default(false)
  isDefault   Boolean  @default(false) // System-provided default templates
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Notes

- Default templates have `userId: null`
- Default templates have `isDefault: true`
- Users cannot create templates with `isDefault: true`
- Default templates are always sorted first in query results

