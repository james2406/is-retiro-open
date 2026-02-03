import { useQuery } from "@tanstack/react-query";

interface WeatherWarningsResult {
  hasActiveWarning: boolean;
}

/**
 * Fetches weather warnings from the AEMET proxy endpoint.
 */
async function fetchWeatherWarnings(): Promise<WeatherWarningsResult> {
  const response = await fetch("/api/aemet-warnings");
  
  if (!response.ok) {
    throw new Error(`Failed to fetch weather warnings: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Custom hook to fetch weather warnings from AEMET via proxy.
 * Used to show verification prompts when weather warnings are active.
 * 
 * @returns Object containing hasActiveWarning boolean (defaults to false on error)
 */
export function useWeatherWarnings(): { hasActiveWarning: boolean } {
  const isBrowser = typeof window !== "undefined";

  const { data } = useQuery({
    queryKey: ["weatherWarnings"],
    queryFn: async () => {
      // Check for mock mode
      if (isBrowser) {
        const urlParams = new URLSearchParams(window.location.search);
        const mockParam = urlParams.get("mock");
        const warningParam = urlParams.get("warning");

        if (mockParam === "true" && warningParam) {
          // Simulate network delay for consistency with other mock data
          await new Promise((resolve) => setTimeout(resolve, 300));
          return { hasActiveWarning: warningParam === "true" };
        }
      }

      return fetchWeatherWarnings();
    },
    // Cache for 15 minutes client-side (matches server cache)
    staleTime: 15 * 60 * 1000,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Disable background refetching
    refetchInterval: false,
    // Only run in browser
    enabled: isBrowser,
  });

  return {
    hasActiveWarning: data?.hasActiveWarning ?? false,
  };
}
