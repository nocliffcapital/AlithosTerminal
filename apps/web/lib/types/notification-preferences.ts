// Notification preferences types

export interface NotificationPreferences {
  browser: boolean;
  email: boolean;
  webhook: boolean;
  webhookUrl?: string;
  telegram: boolean;
  telegramUsername?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  browser: true,
  email: false,
  webhook: false,
  webhookUrl: undefined,
  telegram: false,
  telegramUsername: undefined,
};

/**
 * Parse notification preferences from database JSON
 */
export function parseNotificationPreferences(
  preferences: any
): NotificationPreferences {
  if (!preferences || typeof preferences !== 'object') {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return {
    browser: preferences.browser ?? DEFAULT_NOTIFICATION_PREFERENCES.browser,
    email: preferences.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email,
    webhook: preferences.webhook ?? DEFAULT_NOTIFICATION_PREFERENCES.webhook,
    webhookUrl: preferences.webhookUrl ?? DEFAULT_NOTIFICATION_PREFERENCES.webhookUrl,
    telegram: preferences.telegram ?? DEFAULT_NOTIFICATION_PREFERENCES.telegram,
    telegramUsername: preferences.telegramUsername ?? DEFAULT_NOTIFICATION_PREFERENCES.telegramUsername,
  };
}

/**
 * Validate notification preferences
 */
export function validateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): { valid: boolean; error?: string } {
  if (preferences.webhook === true && !preferences.webhookUrl) {
    return {
      valid: false,
      error: 'Webhook URL is required when webhook notifications are enabled',
    };
  }

  if (preferences.webhookUrl && !isValidUrl(preferences.webhookUrl)) {
    return {
      valid: false,
      error: 'Invalid webhook URL format',
    };
  }

  if (preferences.telegram === true && !preferences.telegramUsername) {
    return {
      valid: false,
      error: 'Telegram username is required when Telegram notifications are enabled',
    };
  }

  if (preferences.telegramUsername && !isValidTelegramUsername(preferences.telegramUsername)) {
    return {
      valid: false,
      error: 'Invalid Telegram username format. Must start with @ and be 5-32 characters (alphanumeric and underscores only)',
    };
  }

  return { valid: true };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidTelegramUsername(username: string): boolean {
  // Telegram username format: @username, 5-32 chars, alphanumeric and underscores only
  const telegramUsernameRegex = /^@[a-zA-Z0-9_]{5,32}$/;
  return telegramUsernameRegex.test(username);
}

