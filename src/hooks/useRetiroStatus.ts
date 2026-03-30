import { useRef, useState, useEffect } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { RetiroStatus } from "../types";
import { fetchRetiroStatus, getMockData } from "../utils/madridApi";

interface UseRetiroStatusResult {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  lastChangedAt: string | null;
  refetch: UseQueryResult<RetiroStatus, Error>["refetch"];
}

/** Fields that indicate a meaningful status change from Madrid. */
function statusFingerprint(d: RetiroStatus): string {
  return JSON.stringify([d.code, d.source_updated_at, d.incidents, d.observations]);
}

/**
 * Custom hook to fetch and manage the status of El Retiro park.
 * Uses TanStack Query for caching, background updates, and offline support.
 *
 * Tracks `lastChangedAt` — the timestamp when we last detected a change in
 * the underlying Madrid data. Initialised from `builtAt` (builds only trigger
 * on data changes) and updated on client-side refetches when the data differs.
 */
export function useRetiroStatus(
  initialData: RetiroStatus | null = null,
  builtAt?: string,
): UseRetiroStatusResult {
  const isBrowser = typeof window !== 'undefined';
  const isOffline = isBrowser && !navigator.onLine;

  const [lastChangedAt, setLastChangedAt] = useState<string | null>(
    builtAt ?? initialData?.updated_at ?? null,
  );
  const prevFingerprint = useRef<string | null>(
    initialData ? statusFingerprint(initialData) : null,
  );

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
    initialDataUpdatedAt: initialData?.updated_at ? new Date(initialData.updated_at).getTime() : undefined,
    // If the data is older than 60s, it will be considered stale immediately and refetch in background
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Detect data changes across refetches and update lastChangedAt
  useEffect(() => {
    if (!data) return;
    const fp = statusFingerprint(data);
    if (prevFingerprint.current === null) {
      // First fetch (no initial data) — seed fingerprint and ensure lastChangedAt is set
      prevFingerprint.current = fp;
      setLastChangedAt((current) => current ?? data.updated_at);
      return;
    }
    if (fp !== prevFingerprint.current) {
      setLastChangedAt(new Date().toISOString());
    }
    prevFingerprint.current = fp;
  }, [data]);

  return {
    data: data || null,
    loading: isLoading,
    error: error instanceof Error ? error.message : (error ? String(error) : null),
    isOffline,
    lastChangedAt,
    refetch
  };
}
