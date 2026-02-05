import { useQuery } from "@tanstack/react-query";

interface WeatherWarningsResult {
  hasActiveWarning: boolean;
}

/**
 * Fetches weather warnings from the AEMET proxy endpoint.
 */
async function fetchWeatherWarnings(querySuffix = ""): Promise<WeatherWarningsResult> {
  const response = await fetch(`/api/aemet-warnings${querySuffix}`);
  
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
      let querySuffix = "";

      if (isBrowser) {
        // Route mock controls through the API so client/server logic stays in one place.
        const urlParams = new URLSearchParams(window.location.search);
        const mockParam = urlParams.get("mock");
        if (mockParam === "true") {
          const warningParam = urlParams.get("warning");
          const query = new URLSearchParams({ mock: "true" });
          if (warningParam === "true" || warningParam === "false") {
            query.set("warning", warningParam);
          }
          querySuffix = `?${query.toString()}`;
        }
      }

      return fetchWeatherWarnings(querySuffix);
    },
    // Cache for 15 minutes client-side (matches server cache)
    staleTime: 15 * 60 * 1000,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Disable background refetching
    refetchInterval: false,
    // Warning signal is supplementary; no need for repeated retries.
    retry: false,
    // Only run in browser
    enabled: isBrowser,
  });

  return {
    hasActiveWarning: data?.hasActiveWarning ?? false,
  };
}
