import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as apiClient } from '../../../services/api-client';

export interface Note {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  createdById: string;
  createdByRole: string;
  createdByName: string;
  lineId?: string;
  isPinned: boolean;
  isArchived: boolean;
  attachments?: any[];
  tags?: string[];
  createdAt: string;
}

export const useNotes = (filters: any = {}) => {
  return useQuery({
    queryKey: ['notes', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/notes', { params: filters });
      return data as Note[];
    },
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: any) => {
      const { data } = await apiClient.post('/notes', note);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...note }: any) => {
      const { data } = await apiClient.patch(`/notes/${id}`, note);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
};
