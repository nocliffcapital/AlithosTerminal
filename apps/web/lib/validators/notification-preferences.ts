import { z } from 'zod';

/**
 * Notification preferences validation schema
 */
export const notificationPreferencesSchema = z.object({
  browser: z.boolean().default(true),
  email: z.boolean().default(false),
  webhook: z.boolean().default(false),
  webhookUrl: z.string().url().optional().or(z.literal('')),
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
);

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

