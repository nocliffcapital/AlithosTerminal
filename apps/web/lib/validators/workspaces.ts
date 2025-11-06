import { z } from 'zod';

/**
 * Workspace type enum
 */
export const workspaceTypeSchema = z.enum(['SCALPING', 'EVENT_DAY', 'ARB_DESK', 'RESEARCH', 'CUSTOM']);

/**
 * Create workspace validation schema
 */
export const createWorkspaceSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Workspace name is required').max(100, 'Workspace name too long'),
  type: workspaceTypeSchema.optional(),
  templateId: z.string().optional(),
});

/**
 * Update workspace validation schema
 */
export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: workspaceTypeSchema.optional(),
  locked: z.boolean().optional(),
});

/**
 * Get workspaces query validation schema
 */
export const getWorkspacesQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

