import type { StatusCode } from "../types";
import type { ClosureAdvisoryState } from "./closureAdvisory";

export type PrimaryStatusMode = "official" | "predicted_closed" | "closing";

export interface PrimaryStatusResolution {
  mode: PrimaryStatusMode;
  themeCode: StatusCode;
}

/**
 * Determines the main status displayed to users.
 *
 * Rules:
 * - Official closed (code 5/6) always wins.
 * - Active AEMET warning upgrades main status to predicted closed.
 * - Warning within 2h upgrades main status to closing.
 * - Later-today warning keeps official status, with advisory messaging only.
 */
export function resolvePrimaryStatus(
  code: StatusCode | null | undefined,
  advisoryState: ClosureAdvisoryState
): PrimaryStatusResolution {
  if (!code) {
    return { mode: "official", themeCode: 1 };
  }

  if (code >= 5) {
    return { mode: "official", themeCode: code };
  }

  if (advisoryState === "likely_closed_now") {
    return { mode: "predicted_closed", themeCode: 6 };
  }

  if (advisoryState === "closing_soon") {
    return { mode: "closing", themeCode: 4 };
  }

  return { mode: "official", themeCode: code };
}
