import { useQuery } from "@tanstack/react-query";
import type { RetiroStatus } from "../types";
import { fetchRetiroStatus, getMockData } from "../utils/madridApi";

interface UseRetiroStatusResult {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refetch: () => void;
}

export function useRetiroStatus(initialData: RetiroStatus | null = null): UseRetiroStatusResult {
  const isBrowser = typeof window !== 'undefined';
  const isOffline = isBrowser && !navigator.onLine;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['retiroStatus'],
    queryFn: async () => {
        // Check for mock mode
        if (isBrowser) {
          const urlParams = new URLSearchParams(window.location.search);
          const mockParam = urlParams.get("mock");
          const codeParam = urlParams.get("code");
          
          if (mockParam === "true" || codeParam) {
            const mockCode = codeParam ? parseInt(codeParam, 10) : undefined;
            await new Promise(resolve => setTimeout(resolve, 500));
            return getMockData(mockCode);
          }
        }
        
        return fetchRetiroStatus();
    },
    initialData: initialData || undefined,
    // If we have initialData, we consider it fresh for 60s so we don't refetch immediately on mount
    staleTime: 60 * 1000, 
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  return { 
    data: data || null, 
    loading: isLoading, 
    error: error instanceof Error ? error.message : (error ? String(error) : null),
    isOffline,
    refetch 
  };
}
