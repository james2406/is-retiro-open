import { useState, useEffect, useCallback } from "react";
import type { RetiroStatus } from "../types";

interface UseRetiroStatusResult {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refetch: () => Promise<void>;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const REQUEST_TIMEOUT = 8000;

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS[attempt])
      );
    }
  }
  throw new Error("Max retries exceeded");
}

export function useRetiroStatus(): UseRetiroStatusResult {
  const [data, setData] = useState<RetiroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchStatus = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      setError("offline");
      setLoading(false);
      return;
    }

    setIsOffline(false);
    setLoading(true);
    setError(null);

    try {
      // Check for mock mode in URL
      const urlParams = new URLSearchParams(window.location.search);
      const mockParam = urlParams.get("mock");
      const codeParam = urlParams.get("code");

      let apiUrl = "/api/status";
      if (mockParam === "true") {
        apiUrl += "?mock=true";
      } else if (codeParam) {
        apiUrl += `?code=${codeParam}`;
      }

      const response = await fetchWithRetry(apiUrl);
      const result: RetiroStatus = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
