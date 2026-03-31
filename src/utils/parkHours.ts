export type ParkHoursState = "open" | "closing_soon" | "closed_for_night";

export interface ParkHoursInfo {
  state: ParkHoursState;
  openTime: string;
  closeTime: string;
}

const OPEN_HOUR = 6;
const WINTER_CLOSE_HOUR = 22;
// Summer closes at midnight (00:00), handled via the "before OPEN_HOUR" check.

const CLOSING_SOON_MINUTES = 60;

/**
 * Extracts the current hour, minute, and month in the Europe/Madrid timezone.
 */
function getMadridTime(now: Date): { hour: number; minute: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "numeric",
    month: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  return {
    hour: parseInt(parts.find((p) => p.type === "hour")!.value),
    minute: parseInt(parts.find((p) => p.type === "minute")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value),
  };
}

function isSummer(month: number): boolean {
  return month >= 4 && month <= 9;
}

/**
 * Resolves the current park hours state based on the time in Madrid.
 *
 * Schedule:
 *  - April–September: 06:00 – 00:00 (midnight)
 *  - October–March:   06:00 – 22:00
 */
export function resolveParkHours(now?: Date): ParkHoursInfo {
  const { hour, minute, month } = getMadridTime(now ?? new Date());
  const summer = isSummer(month);
  const closeTime = summer ? "00:00" : "22:00";

  // Before opening → closed for night
  if (hour < OPEN_HOUR) {
    return { state: "closed_for_night", openTime: "06:00", closeTime };
  }

  if (summer) {
    // Summer: closes at midnight (00:00).
    // 23:00–23:59 → closing soon
    if (hour === 23) {
      return { state: "closing_soon", openTime: "06:00", closeTime };
    }
    // 6:00–22:59 → open
    return { state: "open", openTime: "06:00", closeTime };
  }

  // Winter: closes at 22:00.
  const minutesUntilClose = (WINTER_CLOSE_HOUR - hour) * 60 - minute;

  if (minutesUntilClose <= 0) {
    return { state: "closed_for_night", openTime: "06:00", closeTime };
  }

  if (minutesUntilClose <= CLOSING_SOON_MINUTES) {
    return { state: "closing_soon", openTime: "06:00", closeTime };
  }

  return { state: "open", openTime: "06:00", closeTime };
}
