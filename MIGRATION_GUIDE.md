# Database Migration Guide

## What Happens During a Prisma Migration

When you run `npx prisma migrate dev` or `npx prisma migrate deploy`, Prisma:

1. **Generates Migration Files**: Creates SQL files in `prisma/migrations/` that contain the exact SQL statements needed to update your database schema
2. **Applies Changes to Database**: Executes the SQL statements against your database
3. **Updates Prisma Client**: Regenerates the Prisma Client with new types based on your schema
4. **Tracks Migration History**: Records which migrations have been applied in a `_prisma_migrations` table

## Example: Adding Notification Preferences

If we wanted to add notification preferences, here's what would happen:

### Step 1: Update Schema

```prisma
model User {
  // ... existing fields ...
  
  // NEW: Add notification preferences
  notificationPreferences Json? // { browser: true, email: false, webhook: false, webhookUrl?: string }
}
```

### Step 2: Create Migration

```bash
npx prisma migrate dev --name add_notification_preferences
```

This would generate a migration file like:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;
```

### Step 3: Migration Applied

- ✅ Existing users: `notificationPreferences` will be `NULL` (safe - no data loss)
- ✅ New users: Can set notification preferences
- ✅ Prisma Client: Automatically includes `notificationPreferences` field with proper typing
- ✅ TypeScript: Types update automatically

## What Happens to Existing Data?

### Safe Operations (No Data Loss)

✅ **Adding new columns with defaults**:
```prisma
model User {
  notificationPreferences Json? @default(null)
}
```
- Existing rows get `NULL` for new column
- No data is lost
- Can be updated later

✅ **Adding optional fields**:
```prisma
model User {
  email String? // Optional field
}
```
- Existing rows get `NULL`
- Safe to add anytime

✅ **Adding new tables**:
```prisma
model NotificationPreferences {
  id String @id @default(cuid())
  userId String
  // ...
}
```
- Creates new table
- Doesn't affect existing tables
- Safe

### Potentially Destructive Operations

⚠️ **Removing columns**:
```prisma
// REMOVING this field:
// walletAddress String?
```
- Data in that column is **permanently deleted**
- Prisma will warn you before doing this

⚠️ **Changing column types**:
```prisma
// CHANGING from:
email String?
// TO:
email Int
```
- May cause data loss if existing data doesn't match new type
- Prisma will warn you

⚠️ **Making required fields optional** (usually safe):
```prisma
// CHANGING from:
email String
// TO:
email String?
```
- Usually safe, but may break existing code that assumes email is always present

## Best Practices

### 1. Always Backup First (Production)

```bash
# Backup your database before migration
pg_dump $DATABASE_URL > backup.sql
```

### 2. Test in Development First

```bash
# Run migrations in development
npx prisma migrate dev

# Test your application thoroughly
npm run dev
```

### 3. Use Migration Scripts (Production)

```bash
# For production deployments
npx prisma migrate deploy
```

This applies pending migrations without:
- Creating new migration files
- Resetting the database
- Running seed scripts

### 4. Handle Nullable Fields Gracefully

When adding new fields, always make them optional initially:

```prisma
model User {
  // Good: Optional field with default
  notificationPreferences Json? @default(null)
  
  // Bad: Required field (will fail if existing users exist)
  // notificationPreferences Json
}
```

### 5. Use Defaults for Required Fields

If you need a required field, provide a default:

```prisma
model User {
  // Good: Required field with default
  notificationPreferences Json @default("{}")
}
```

## Migration Commands

### Development

```bash
# Create and apply migration
npx prisma migrate dev --name migration_name

# Reset database (⚠️ DELETES ALL DATA)
npx prisma migrate reset

# Generate Prisma Client only (after manual schema changes)
npx prisma generate
```

### Production

```bash
# Apply pending migrations (safe for production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Example Migration: Adding Notification Preferences

Here's a complete example of adding notification preferences safely:

### 1. Update Schema

```prisma
model User {
  id            String    @id @default(cuid())
  privyId       String    @unique
  email         String?
  walletAddress String?
  
  // NEW: Notification preferences
  notificationPreferences Json? // { browser: true, email: false, webhook: false, webhookUrl?: string }
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // ... relations ...
}
```

### 2. Create Migration

```bash
npx prisma migrate dev --name add_notification_preferences
```

### 3. Migration File Generated

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;
```

### 4. Update Code

```typescript
// apps/web/lib/api/user-preferences.ts
export interface NotificationPreferences {
  browser: boolean;
  email: boolean;
  webhook: boolean;
  webhookUrl?: string;
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
) {
  const prisma = getPrismaClient();
  return prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: preferences },
  });
}
```

### 5. Handle Existing Users

```typescript
// When fetching user, provide defaults
const user = await prisma.user.findUnique({ where: { id } });

const preferences: NotificationPreferences = 
  (user?.notificationPreferences as NotificationPreferences) || {
    browser: true,
    email: false,
    webhook: false,
  };
```

## Migration Safety Checklist

Before running a migration in production:

- [ ] ✅ Backup database
- [ ] ✅ Test migration in development/staging
- [ ] ✅ Verify no data loss will occur
- [ ] ✅ Check for breaking changes in code
- [ ] ✅ Update TypeScript types if needed
- [ ] ✅ Test application after migration
- [ ] ✅ Have rollback plan ready

## Rollback Strategy

If something goes wrong:

### Option 1: Manual SQL Rollback

```sql
-- Example: Remove the column we just added
ALTER TABLE "User" DROP COLUMN "notificationPreferences";
```

### Option 2: Create Reverse Migration

```bash
# Create a new migration that reverses the change
npx prisma migrate dev --name remove_notification_preferences
```

### Option 3: Restore from Backup

```bash
# Restore database from backup
psql $DATABASE_URL < backup.sql
```

## Current Migration History

Your database has these migrations:

1. `20251102123348_init` - Initial schema (User, Workspace, Layout, Alert, etc.)
2. `20251102133550_add_templates` - Added Template model
3. `20251102233238_add_workspace_locked` - Added `locked` field to Workspace

All migrations are **safe** - they only add new features, don't remove existing data.

## Summary

✅ **Migrations are generally safe** when:
- Adding new tables
- Adding new optional columns
- Adding indexes
- Making fields nullable

⚠️ **Be careful when**:
- Removing columns (data loss)
- Changing column types (may cause data loss)
- Making optional fields required (may fail on existing data)

🎯 **Best Practice**: Always test migrations in development first, and backup production databases before migrating.

