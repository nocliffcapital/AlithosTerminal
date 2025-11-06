// Notification preferences types

export interface NotificationPreferences {
  browser: boolean;
  email: boolean;
  webhook: boolean;
  webhookUrl?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  browser: true,
  email: false,
  webhook: false,
  webhookUrl: undefined,
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

