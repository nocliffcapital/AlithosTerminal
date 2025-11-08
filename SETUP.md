# Alithos Terminal Setup Guide

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Privy account (for authentication)
- Optional: Alchemy or Moralis account (for on-chain data)

## Step 1: Install Dependencies

```bash
cd /Users/nationalbank/Coding/AlithosTerminal
npm install
```

## Step 2: Set Up Environment Variables

1. Copy the `.env.local` file template (already created in `apps/web/.env.local`)
2. Fill in the required values:

### Required Variables

#### Database
```env
DATABASE_URL="postgresql://user:password@localhost:5432/alithos_terminal?schema=public"
```
Replace with your PostgreSQL connection string.

#### Privy Authentication
```env
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
```
Get your App ID from [Privy Dashboard](https://dashboard.privy.io)

### Optional Variables

#### Polymarket API
```env
NEXT_PUBLIC_POLYMARKET_API_KEY="your-polymarket-api-key"
NEXT_PUBLIC_POLYMARKET_API_URL="https://claystack-api.com/v1"
NEXT_PUBLIC_POLYMARKET_WS_URL="wss://api.claystack.com/polymarket/ws"
```
See [POLYMARKET_API_SETUP.md](./POLYMARKET_API_SETUP.md) for detailed setup instructions.

#### On-Chain Data (choose one)
- **Alchemy** (recommended):
  ```env
  NEXT_PUBLIC_ALCHEMY_API_URL="https://polygon-mainnet.g.alchemy.com/v2/your-api-key"
  ```
  Get API key from [Alchemy](https://www.alchemy.com/)

- **Moralis** (alternative):
  ```env
  NEXT_PUBLIC_MORALIS_API_URL="https://deep-index.moralis.io/api/v2"
  NEXT_PUBLIC_MORALIS_API_KEY="your-moralis-api-key"
  ```
  Get API key from [Moralis](https://moralis.io/)

#### AI Market Research
- **Grok API** (xAI) - For AI-powered market research:
  ```env
  GROK_API_KEY="your-grok-api-key"
  ```
  Get API key from [xAI Console](https://console.x.ai)

- **OpenAI API** - For multi-agent analysis:
  ```env
  OPENAI_API_KEY="your-openai-api-key"
  ```
  Get API key from [OpenAI Platform](https://platform.openai.com)

#### Telegram Notifications
- **Telegram Bot** - For Telegram notifications:
  ```env
  TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
  ```
  To set up a Telegram bot:
  1. Open Telegram and search for [@BotFather](https://t.me/botfather)
  2. Start a conversation with BotFather
  3. Send `/newbot` command
  4. Follow the prompts to create your bot and get the bot token
  5. Add the token to your `.env.local` file
  6. Users can then provide their Telegram username in Settings → Notification Preferences
  7. **Important**: Users must start a conversation with the bot (e.g., @alithos_bot) before receiving notifications

## Step 3: Set Up PostgreSQL Database

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE alithos_terminal;
   ```

2. Or using psql command line:
   ```bash
   createdb alithos_terminal
   ```

3. Update `DATABASE_URL` in `.env.local` with your database credentials

## Step 4: Set Up Prisma

1. Generate Prisma Client:
   ```bash
   cd apps/web
   npx prisma generate
   ```

2. Run migrations to create database tables:
   ```bash
   npx prisma migrate dev --name init
   ```

3. (Optional) Open Prisma Studio to view/manage data:
   ```bash
   npx prisma studio
   ```

## Step 5: Start Development Server

```bash
# From root directory
npm run dev

# Or from apps/web directory
cd apps/web
npm run dev
```

The application will be available at `http://localhost:3000`

## Step 6: Initial Setup in Application

1. Open `http://localhost:3000`
2. Sign in with Privy (wallet or email)
3. Create your first workspace
4. Add cards to your workspace
5. Start trading!

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check connection string format in `.env.local`
- Ensure database exists: `psql -l` to list databases

### Prisma Issues
- Reset database (WARNING: deletes all data):
  ```bash
  npx prisma migrate reset
  ```
- Re-generate Prisma Client:
  ```bash
  npx prisma generate
  ```

### API Issues
- Check API keys are correct in `.env.local`
- Verify API endpoints are accessible
- Check browser console for error messages

### Privy Authentication Issues
- Verify `NEXT_PUBLIC_PRIVY_APP_ID` is correct
- Check Privy dashboard for app configuration
- Ensure wallet is connected (for Web3 features)

## Production Deployment

### Environment Variables for Production
- Set all environment variables in your hosting provider (Vercel, Railway, etc.)
- Ensure `DATABASE_URL` points to production database
- Use production API keys (separate from development)

### Database Migration
```bash
npx prisma migrate deploy
```

### Build for Production
```bash
cd apps/web
npm run build
npm start
```

## Next Steps

- [ ] Configure Privy App ID
- [ ] Set up PostgreSQL database
- [ ] Run Prisma migrations
- [ ] Add Polymarket API keys (if available)
- [ ] Add Alchemy/Moralis API keys (for on-chain data)
- [ ] Test authentication flow
- [ ] Test workspace creation
- [ ] Test card creation and layout
- [ ] Test trading (on testnet first!)

## Support

For issues or questions:
1. Check the `IMPLEMENTATION_STATUS.md` file
2. Review error messages in browser console
3. Check database logs if connection issues occur
4. Verify all environment variables are set correctly

