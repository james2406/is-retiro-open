import type { StatusCode } from "../types";
import type { ClosureAdvisoryState } from "./closureAdvisory";

export type PrimaryStatusMode = "official";

export interface PrimaryStatusResolution {
  mode: PrimaryStatusMode;
  themeCode: StatusCode;
}

/**
 * Determines the main status displayed to users.
 *
 * Rules:
 * - Never override Madrid's official park status from weather advisories.
 */
export function resolvePrimaryStatus(
  code: StatusCode | null | undefined,
  _advisoryState: ClosureAdvisoryState
): PrimaryStatusResolution {
  if (!code) {
    return { mode: "official", themeCode: 1 };
  }

  return { mode: "official", themeCode: code };
}
