import { z } from 'zod';

/**
 * Common validation schemas used across multiple endpoints
 */

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(1000)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0)),
});

/**
 * Date range query parameters
 */
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
});

/**
 * Market ID validation
 */
export const marketIdSchema = z.string().min(1, 'Market ID is required');

/**
 * User ID validation
 */
export const userIdSchema = z.string().min(1, 'User ID is required');

/**
 * Ethereum address validation
 */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform((val) => val.toLowerCase());

/**
 * ID parameter validation (for route params)
 */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Validation helper function
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod error for API response
 */
export function formatZodError(error: z.ZodError): { message: string; details: Record<string, string[]> } {
  const details: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  });

  return {
    message: 'Validation error',
    details,
  };
}

