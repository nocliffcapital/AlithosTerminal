# Database Connection Troubleshooting

## Issue: Can't reach database server

If you're getting a connection error to your database server, follow these troubleshooting steps.

### Common Causes & Solutions

#### 1. Database is Sleeping (Neon-specific)
Neon databases automatically sleep after inactivity. They wake up on the first connection, but this can take 2-5 seconds.

**Solution**: 
- Wait a few seconds and try again
- The first connection attempt after sleep will wake the database
- Subsequent connections should be fast

#### 2. Connection String Format
Your current connection string might include `channel_binding=require` which some clients don't support.

**Try this connection string format instead:**
```
postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require
```

(Remove `&channel_binding=require` if present)

Or use a direct connection (non-pooler):
```
postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require
```

#### 3. Dev Server Not Restarted
Next.js needs to be restarted after changing `.env.local`.

**Solution**:
1. Stop the dev server (Ctrl+C)
2. Update `.env.local` if needed
3. Restart: `npm run dev`

#### 4. Test Connection Directly

You can test the connection using `psql`:
```bash
psql 'postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require'
```

Or test with Prisma:
```bash
cd apps/web
npx prisma db pull
```

#### 5. Check Neon Dashboard
1. Go to https://console.neon.tech
2. Check if your database is active
3. Verify the connection string matches your `.env.local` file

## Quick Fix

Make sure your `.env.local` DATABASE_URL is properly formatted:
```
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require"
```

Replace `USERNAME`, `PASSWORD`, `HOST`, and `DATABASE` with your actual database credentials.

Then restart your dev server.

