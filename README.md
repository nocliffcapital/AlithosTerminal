# Alithos Terminal

Bloomberg-style terminal for Polymarket prediction markets.

## Architecture

- **Frontend**: Next.js 14+ (App Router) with React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (Prisma)
- **Auth**: Privy (wallet + email/password)
- **State**: Zustand
- **Layout**: React Grid Layout

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

1. Copy `.env.local` in `apps/web/` directory
2. Fill in required values (see [SETUP.md](./SETUP.md) for details):
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXT_PUBLIC_PRIVY_APP_ID` - Get from [Privy Dashboard](https://dashboard.privy.io)

**For detailed guide on what you need and where to get it, see [QUICK_START.md](./QUICK_START.md)**

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb alithos_terminal

# Or using SQL:
# psql -c "CREATE DATABASE alithos_terminal;"
```

### 4. Run Prisma Setup

```bash
cd apps/web
npx prisma generate
npx prisma migrate dev --name init

# Or use the setup script (can be run from any directory):
./scripts/prisma-setup.sh
# or from project root:
scripts/prisma-setup.sh
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Detailed Setup

See [SETUP.md](./SETUP.md) for complete setup instructions.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Prisma Studio (database GUI)
cd apps/web && npx prisma studio
```

## Project Structure

```
/AlithosTerminal
  /apps
    /web (Next.js frontend)
      /app (Next.js App Router)
      /components (React components)
      /lib (utilities, API clients, hooks)
      /stores (Zustand state management)
      .env.local (environment variables)
  /packages
    /shared (shared types, utils)
    /api-client (generated API types)
  /prisma
    schema.prisma (database schema)
```

## Documentation

Additional documentation is available in the [docs](./docs/) directory:
- Implementation status and feature tracking
- Bug fixes and testing summaries
- Deployment guides
- Troubleshooting guides

## Features

✅ **Core Cards** (11 implemented):
- Watchlist, Tape, Quick Ticket, Depth, Scenario Builder
- Exposure Tree, Activity Scanner, Resolution Criteria
- Chart, Correlation Matrix, Alerts

✅ **Trading**:
- Web3 contract integration
- Buy/sell execution
- USDC approval flow

✅ **Layout System**:
- Drag-and-drop card layout
- Workspace management
- Theme customization

✅ **Alerts & Automation**:
- Multi-signal alerts
- Browser notifications
- Email notifications
- Webhook support
- Telegram notifications

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy authentication

Optional:
- `NEXT_PUBLIC_POLYMARKET_API_KEY` - Polymarket API key (see [POLYMARKET_API_SETUP.md](./POLYMARKET_API_SETUP.md))
- `NEXT_PUBLIC_POLYMARKET_API_URL` - Polymarket API endpoint (defaults to https://claystack-api.com/v1)
- `NEXT_PUBLIC_POLYMARKET_WS_URL` - Polymarket WebSocket URL (defaults to wss://api.claystack.com/polymarket/ws)
- `NEXT_PUBLIC_ALCHEMY_API_URL` - Alchemy API (for on-chain data)
- `NEXT_PUBLIC_MORALIS_API_URL` - Moralis API (alternative)
- `GROK_API_KEY` - Grok API (xAI) key for AI market research (see [SETUP.md](./SETUP.md))
- `OPENAI_API_KEY` - OpenAI API key for multi-agent analysis (see [SETUP.md](./SETUP.md))
- `TELEGRAM_BOT_TOKEN` - Telegram bot token for Telegram notifications (see [SETUP.md](./SETUP.md))

See `.env.local` template in `apps/web/` for all variables.

## Support

For setup help, see [SETUP.md](./SETUP.md)  
For implementation details and historical documentation, see the [docs](./docs/) directory

