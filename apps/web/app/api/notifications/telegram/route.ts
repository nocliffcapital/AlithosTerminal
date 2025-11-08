import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';
import TelegramBot from 'node-telegram-bot-api';

const telegramSchema = z.object({
  username: z.string().regex(/^@[a-zA-Z0-9_]{5,32}$/, {
    message: 'Invalid Telegram username format. Must start with @ and be 5-32 characters (alphanumeric and underscores only)',
  }),
  message: z.string().min(1),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
});

/**
 * POST /api/notifications/telegram
 * Send Telegram notification via Bot API
 * 
 * Requires TELEGRAM_BOT_TOKEN environment variable
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = telegramSchema.parse(body);

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[Telegram API] TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json(
        { 
          error: 'Telegram bot not configured',
          details: 'Please set TELEGRAM_BOT_TOKEN in your environment variables (.env.local)',
          hint: 'Get your bot token from @BotFather on Telegram',
        },
        { status: 500 }
      );
    }

    // Initialize Telegram bot
    const bot = new TelegramBot(botToken, { polling: false });

    // Send message to username
    // Note: Telegram Bot API can send messages to usernames directly
    try {
      const result = await bot.sendMessage(validated.username, validated.message, {
        parse_mode: validated.parseMode || 'HTML',
      });

      return NextResponse.json({
        success: true,
        messageId: result.message_id,
        message: 'Telegram notification sent successfully',
      });
    } catch (telegramError: any) {
      // Handle Telegram API errors
      let errorMessage = 'Failed to send Telegram message';
      
      if (telegramError.response) {
        const errorCode = telegramError.response.body?.error_code;
        const description = telegramError.response.body?.description || '';
        
        if (errorCode === 400) {
          errorMessage = 'Invalid username or message format';
        } else if (errorCode === 403) {
          errorMessage = 'Bot is blocked by user or user has not started a conversation with the bot';
        } else if (errorCode === 404) {
          errorMessage = 'User not found. Make sure the username is correct and the user exists';
        } else {
          errorMessage = description || `Telegram API error: ${errorCode}`;
        }
      } else if (telegramError.message) {
        errorMessage = telegramError.message;
      }

      console.error('[Telegram API] Error sending message:', {
        username: validated.username,
        error: errorMessage,
        details: telegramError,
      });

      return NextResponse.json(
        { 
          error: errorMessage,
          details: telegramError.response?.body || telegramError.message,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[POST /api/notifications/telegram] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid Telegram data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send Telegram notification' },
      { status: 500 }
    );
  }
}

