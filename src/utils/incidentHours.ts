const TIME_TOKEN_REGEX = "(?:[01]?\\d|2[0-4]):[0-5]\\d";
const BARE_TIME_RANGE_REGEX = new RegExp(`^(${TIME_TOKEN_REGEX})\\s+(${TIME_TOKEN_REGEX})$`);

/**
 * Normalizes incident hour ranges from Madrid API into "HH:mm - HH:mm".
 * Handles connector variants ("a", "to"), dash variants, and bare pairs.
 */
export function formatIncidentHours(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const withoutPrefix = normalized.replace(/^de\s+/i, "");
  const standardized = withoutPrefix
    .replace(/\s+(?:a|to)\s+/gi, " - ")
    .replace(/\s*[–—-]\s*/g, " - ");

  if (standardized.includes(" - ")) {
    return standardized;
  }

  const bareRangeMatch = standardized.match(BARE_TIME_RANGE_REGEX);
  if (bareRangeMatch) {
    const [, from, to] = bareRangeMatch;
    return `${from} - ${to}`;
  }

  return standardized;
}
