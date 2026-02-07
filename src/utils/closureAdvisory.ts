import type { StatusCode, WeatherWarningSignal } from "../types";

export type ClosureAdvisoryState =
  | "none"
  | "likely_closed_now"
  | "warning_soon"
  | "closing_later_today";

export interface ClosureAdvisory {
  state: ClosureAdvisoryState;
  nextWarningOnset: string | null;
}

/**
 * Conservative decision model:
 * - Keep official park status as the primary source of truth for open/closed text.
 * - Add predictive closure advisories from AEMET when status is still open/restricted.
 * - Upcoming warnings (within 2h and later today) are advisory-only.
 */
export function resolveClosureAdvisory(
  code: StatusCode | null | undefined,
  weather: WeatherWarningSignal | null | undefined
): ClosureAdvisory {
  if (!code || !weather) {
    return { state: "none", nextWarningOnset: null };
  }

  // Park already marked as closed by Madrid source.
  if (code >= 5) {
    return { state: "none", nextWarningOnset: null };
  }

  if (weather.hasActiveWarning) {
    return {
      state: "likely_closed_now",
      nextWarningOnset: weather.nextWarningOnset,
    };
  }

  if (weather.hasWarningWithin2Hours) {
    return {
      state: "warning_soon",
      nextWarningOnset: weather.nextWarningOnset,
    };
  }

  if (weather.hasWarningLaterToday) {
    return {
      state: "closing_later_today",
      nextWarningOnset: weather.nextWarningOnset,
    };
  }

  return { state: "none", nextWarningOnset: null };
}
