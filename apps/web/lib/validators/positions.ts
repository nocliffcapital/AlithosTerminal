import { z } from 'zod';

/**
 * Ethereum address validation
 */
const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform((val) => val.toLowerCase());

/**
 * Get positions query validation schema
 */
export const getPositionsQuerySchema = z.object({
  userAddress: z
    .string()
    .min(1, 'User address is required')
    .pipe(ethereumAddressSchema)
    .or(z.string().min(1).pipe(ethereumAddressSchema)),
  userId: z.string().optional(),
  includeMarket: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
});

