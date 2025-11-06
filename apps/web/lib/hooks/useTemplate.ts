'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export function useTemplates(includePublic: boolean = false) {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['templates', dbUser?.id, includePublic],
    queryFn: async () => {
      if (!dbUser?.id && !includePublic) return [];
      
      const params = new URLSearchParams();
      if (dbUser?.id) {
        params.append('userId', dbUser.id);
      }
      if (includePublic) {
        params.append('includePublic', 'true');
      }
      
      const response = await fetch(`/api/templates?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to fetch templates: ${response.status}`);
      }
      const data = await response.json();
      return data.templates || [];
    },
    enabled: isAuthenticated || includePublic,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTemplate() {
  const { dbUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, config, isPublic }: { name: string; description?: string; config: any; isPublic?: boolean }) => {
      if (!dbUser?.id || !isAuthenticated) {
        throw new Error('User not authenticated');
      }
      
      console.log('Creating template with:', {
        userId: dbUser.id,
        name,
        description,
        config,
        isPublic,
      });

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUser.id, name, description, config, isPublic }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Template creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(errorData.details || errorData.error || `Failed to create template: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Template created successfully:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', dbUser?.id] });
    },
  });
}

