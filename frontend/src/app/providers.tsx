import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { TransactionOverlayProvider } from '../components/TransactionOverlay';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status && [401, 403, 404].includes(status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
  mutationCache: new MutationCache({
    onError: (error: any) => {
      console.error('[Global Mutation Error]:', error);
      toast.error(error.response?.data?.message || error.message || 'An unexpected error occurred', {
        id: 'global-mutation-error',
      });
    }
  })
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TransactionOverlayProvider>
        <Toaster position="top-right" expand={true} richColors closeButton />
        {children}
      </TransactionOverlayProvider>
    </QueryClientProvider>
  );
}
