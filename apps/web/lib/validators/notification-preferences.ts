import { z } from 'zod';

/**
 * Notification preferences validation schema
 */
export const notificationPreferencesSchema = z.object({
  browser: z.boolean().default(true),
  email: z.boolean().default(false),
  webhook: z.boolean().default(false),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  telegram: z.boolean().default(false),
  telegramUsername: z.string().optional().or(z.literal('')),
}).refine(
  (data) => {
    // If webhook is enabled, webhookUrl must be provided
    if (data.webhook && !data.webhookUrl) {
      return false;
    }
    return true;
  },
  {
    message: 'Webhook URL is required when webhook notifications are enabled',
    path: ['webhookUrl'],
  }
).refine(
  (data) => {
    // If telegram is enabled, telegramUsername must be provided
    if (data.telegram && !data.telegramUsername) {
      return false;
    }
    return true;
  },
  {
    message: 'Telegram username is required when Telegram notifications are enabled',
    path: ['telegramUsername'],
  }
).refine(
  (data) => {
    // Validate Telegram username format if provided
    if (data.telegramUsername && data.telegramUsername !== '') {
      const telegramUsernameRegex = /^@[a-zA-Z0-9_]{5,32}$/;
      return telegramUsernameRegex.test(data.telegramUsername);
    }
    return true;
  },
  {
    message: 'Invalid Telegram username format. Must start with @ and be 5-32 characters (alphanumeric and underscores only)',
    path: ['telegramUsername'],
  }
);

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

