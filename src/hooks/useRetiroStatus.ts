import { useState, useEffect } from "react";
import type { RetiroStatus } from "../types";
import { fetchRetiroStatus, getMockData } from "../utils/madridApi";

interface UseRetiroStatusResult {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refetch: () => Promise<void>;
}

export function useRetiroStatus(initialData: RetiroStatus | null = null): UseRetiroStatusResult {
  const [data, setData] = useState<RetiroStatus | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // We define the fetch logic outside to return it as 'refetch',
  // but we control the effect loop manually to avoid dependency cycles.
  const loadStatus = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setError("offline");
      setLoading(false);
      return;
    }

    setIsOffline(false);
    // Only set loading if we don't have data yet
    if (!data && !initialData) setLoading(true);
    setError(null);

    try {
      // Check for mock mode in URL
      let mockParam: string | null = null;
      let codeParam: string | null = null;

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        mockParam = urlParams.get("mock");
        codeParam = urlParams.get("code");
      }

      if (mockParam === "true" || codeParam) {
        const mockCode = codeParam ? parseInt(codeParam, 10) : undefined;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setData(getMockData(mockCode));
        return;
      }

      // Use shared fetcher
      const result = await fetchRetiroStatus();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let interval: NodeJS.Timeout;

    const runLoad = async () => {
      if (!isMounted) return;
      await loadStatus();
    };

    // If we have initial data, we might skip the immediate first fetch 
    // or fetch in background. Here we fetch immediately to ensure freshness 
    // but without clearing existing data/showing loading spinner (handled in loadStatus).
    runLoad();

    const handleOnline = () => {
      if (isMounted) {
        setIsOffline(false);
        runLoad();
      }
    };
    const handleOffline = () => {
      if (isMounted) setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh every 60 seconds
    interval = setInterval(runLoad, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array: runs once on mount

  return { data, loading, error, isOffline, refetch: loadStatus };
}
