import { useQuery } from "@tanstack/react-query";
import type { WeatherWarningSignal } from "../types";

const EMPTY_WARNING_SIGNAL: WeatherWarningSignal = {
  hasActiveWarning: false,
  hasWarningWithin2Hours: false,
  hasWarningLaterToday: false,
  activeWarningSeverity: null,
  nextWarningOnset: null,
  nextWarningSeverity: null,
  fetchedAt: null,
};

type MockWarningScenario = "none" | "active" | "soon" | "later";

function getClientMockWarningSignal(scenario: MockWarningScenario): WeatherWarningSignal {
  const now = new Date();

  if (scenario === "active") {
    return {
      hasActiveWarning: true,
      hasWarningWithin2Hours: false,
      hasWarningLaterToday: false,
      activeWarningSeverity: "moderate",
      nextWarningOnset: null,
      nextWarningSeverity: null,
      fetchedAt: now.toISOString(),
    };
  }

  if (scenario === "soon") {
    return {
      hasActiveWarning: false,
      hasWarningWithin2Hours: true,
      hasWarningLaterToday: false,
      activeWarningSeverity: null,
      nextWarningOnset: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      nextWarningSeverity: "moderate",
      fetchedAt: now.toISOString(),
    };
  }

  if (scenario === "later") {
    return {
      hasActiveWarning: false,
      hasWarningWithin2Hours: false,
      hasWarningLaterToday: true,
      activeWarningSeverity: null,
      nextWarningOnset: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      nextWarningSeverity: "moderate",
      fetchedAt: now.toISOString(),
    };
  }

  return {
    ...EMPTY_WARNING_SIGNAL,
    fetchedAt: now.toISOString(),
  };
}

/**
 * Fetches weather warnings from the AEMET proxy endpoint.
 */
async function fetchWeatherWarnings(querySuffix = ""): Promise<WeatherWarningSignal> {
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
 * @returns Predictive warning signal with active/soon/later flags.
 */
export function useWeatherWarnings(): WeatherWarningSignal {
  const isBrowser = typeof window !== "undefined";

  const { data } = useQuery({
    queryKey: ["weatherWarnings"],
    queryFn: async () => {
      let querySuffix = "";

      if (isBrowser) {
        // In mock mode, synthesize warnings client-side so behavior is testable
        // even when local dev doesn't expose /api routes.
        const urlParams = new URLSearchParams(window.location.search);
        const mockParam = urlParams.get("mock");
        if (mockParam === "true") {
          const warningParam = urlParams.get("warning");
          const warningScenario = urlParams.get("warningScenario");

          // Ensure mock scenarios work in plain Vite dev, where /api routes may not exist.
          if (
            warningScenario === "none" ||
            warningScenario === "active" ||
            warningScenario === "soon" ||
            warningScenario === "later"
          ) {
            return getClientMockWarningSignal(warningScenario);
          }

          if (warningParam === "true") {
            return getClientMockWarningSignal("active");
          }
          if (warningParam === "false") {
            return getClientMockWarningSignal("none");
          }

          // Backward compatibility default for mock mode without explicit warning controls.
          return getClientMockWarningSignal("none");
        }
      }

      return fetchWeatherWarnings(querySuffix);
    },
    // Cache for 5 minutes client-side (matches server cache)
    staleTime: 5 * 60 * 1000,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Refresh every 2 minutes while the page is open.
    refetchInterval: 2 * 60 * 1000,
    // Warning signal is supplementary; no need for repeated retries.
    retry: false,
    // Only run in browser
    enabled: isBrowser,
  });

  return data ?? EMPTY_WARNING_SIGNAL;
}
