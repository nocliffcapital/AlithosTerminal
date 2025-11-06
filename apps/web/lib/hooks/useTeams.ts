'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export interface TeamMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    walletAddress: string | null;
  };
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: TeamMember[];
  workspace: {
    id: string;
    name: string;
  };
}

/**
 * Hook to fetch user's teams
 */
export function useTeams() {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['teams', dbUser?.id],
    queryFn: async () => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/teams');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch teams: ${response.status}`);
      }

      const data = await response.json();
      return (data.teams || []) as Team[];
    },
    enabled: isAuthenticated && !!dbUser?.id,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

/**
 * Hook to fetch a single team
 */
export function useTeam(teamId: string | null) {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['team', teamId, dbUser?.id],
    queryFn: async () => {
      if (!teamId || !dbUser?.id) {
        throw new Error('Team ID and user ID are required');
      }

      const response = await fetch(`/api/teams/${teamId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch team: ${response.status}`);
      }

      const data = await response.json();
      return data.team as Team;
    },
    enabled: isAuthenticated && !!dbUser?.id && !!teamId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (data: { workspaceId: string; name: string }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create team: ${response.status}`);
      }

      const result = await response.json();
      return result.team as Team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
    },
  });
}

/**
 * Hook to update a team
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ teamId, data }: { teamId: string; data: { name?: string } }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update team: ${response.status}`);
      }

      const result = await response.json();
      return result.team as Team;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
    },
  });
}

/**
 * Hook to delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete team: ${response.status}`);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
    },
  });
}

/**
 * Hook to add a team member
 */
export function useAddTeamMember() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: role || 'MEMBER' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add member: ${response.status}`);
      }

      const result = await response.json();
      return result.member as TeamMember;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
    },
  });
}

/**
 * Hook to update a team member's role
 */
export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ teamId, memberId, role }: { teamId: string; memberId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update member: ${response.status}`);
      }

      const result = await response.json();
      return result.member as TeamMember;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
    },
  });
}

/**
 * Hook to remove a team member
 */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove member: ${response.status}`);
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams', dbUser?.id] });
    },
  });
}

