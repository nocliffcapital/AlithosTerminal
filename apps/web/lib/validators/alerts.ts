import { z } from 'zod';

/**
 * Alert condition validation schema
 */
export const alertConditionSchema = z.object({
  type: z.enum(['price', 'volume', 'depth', 'flow', 'spread']),
  operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  value: z.number().min(0),
});

/**
 * Alert action validation schema
 */
export const alertActionSchema = z.object({
  type: z.enum(['notify', 'order', 'webhook']),
  config: z.object({
    message: z.string().optional(),
    orderParams: z
      .object({
        marketId: z.string().min(1),
        outcome: z.enum(['YES', 'NO']),
        amount: z.number().positive(),
        type: z.enum(['buy', 'sell']),
      })
      .optional(),
    webhookUrl: z.string().url().optional(),
  }),
});

/**
 * Create alert validation schema
 */
export const createAlertSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Alert name is required').max(100, 'Alert name too long'),
  marketId: z.string().optional(),
  conditions: z
    .array(alertConditionSchema)
    .min(1, 'At least one condition is required')
    .max(10, 'Too many conditions'),
  actions: z
    .array(alertActionSchema)
    .min(1, 'At least one action is required')
    .max(5, 'Too many actions'),
  isActive: z.boolean().optional().default(true),
  cooldownPeriodMinutes: z.number().int().min(0).optional(),
});

/**
 * Update alert validation schema
 */
export const updateAlertSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1).max(100).optional(),
  marketId: z.string().optional(),
  conditions: z.array(alertConditionSchema).min(1).max(10).optional(),
  actions: z.array(alertActionSchema).min(1).max(5).optional(),
  isActive: z.boolean().optional(),
  cooldownPeriodMinutes: z.number().int().min(0).optional(),
});

/**
 * Get alerts query validation schema
 */
export const getAlertsQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  active: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

