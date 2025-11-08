// Telegram notification client
// Uses Telegram Bot API to send messages to users via their Telegram username

export interface TelegramOptions {
  username: string; // Telegram username (e.g., @username)
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface TelegramResult {
  success: boolean;
  error?: string;
  messageId?: number;
}

/**
 * Send Telegram message via Bot API
 * This function calls the API route which handles the actual Telegram Bot API integration
 */
export async function sendTelegramMessage(options: TelegramOptions): Promise<TelegramResult> {
  try {
    const response = await fetch('/api/notifications/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: options.username,
        message: options.message,
        parseMode: options.parseMode || 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test Telegram connection by sending a test message
 */
export async function testTelegramConnection(username: string): Promise<TelegramResult> {
  return sendTelegramMessage({
    username,
    message: '✅ <b>Test message from Alithos Terminal</b>\n\nYour Telegram notifications are working correctly!',
    parseMode: 'HTML',
  });
}

