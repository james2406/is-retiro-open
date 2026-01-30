import { useState, useEffect, useCallback, useRef } from "react";
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
  
  // Use a ref to access the latest data inside fetchStatus without adding it as a dependency
  // This prevents the infinite loop: fetchStatus -> updates data -> fetchStatus changes -> useEffect calls fetchStatus
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setError("offline");
      setLoading(false);
      return;
    }

    setIsOffline(false);
    
    // Only show loading state if we don't have data yet
    if (!dataRef.current) {
      setLoading(true);
    }
    
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
  }, []); // Depend on data to properly decide if we need to set loading=true

  useEffect(() => {
    // Only fetch if we don't have initial data, OR if we want to refresh
    // For hydration, we might want to skip the immediate fetch if we trust the server data
    // But since the status changes, re-fetching immediately is safer to ensure freshness
    fetchStatus();

    const handleOnline = () => {
      setIsOffline(false);
      fetchStatus();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return { data, loading, error, isOffline, refetch: fetchStatus };
}
