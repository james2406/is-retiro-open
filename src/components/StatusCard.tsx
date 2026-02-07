import { Info, AlertTriangle } from "lucide-react";
import type {
  RetiroStatus,
  StatusCode,
  StatusTheme,
  WeatherWarningSignal,
} from "../types";
import { STATUS_THEMES, ERROR_THEME } from "../types";
import type { Translations } from "../i18n";
import {
  resolveClosureAdvisory,
  type ClosureAdvisoryState,
} from "../utils/closureAdvisory";
import { formatIncidentHours } from "../utils/incidentHours";
import { resolvePrimaryStatus } from "../utils/primaryStatus";

interface StatusCardProps {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  weatherWarnings: WeatherWarningSignal;
  t: Translations;
}

/**
 * Parses a date string in DD/MM/YYYY format and returns a Date object.
 * Returns null if the date is invalid.
 */
function parseSourceDate(dateStr: string): Date | null {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const date = new Date(year, month - 1, day);
  // Validate the date is real (e.g., not Feb 31)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Checks if the source date is stale (yesterday or older) compared to today in Madrid timezone.
 */
function isSourceDateStale(dateStr: string | null): boolean {
  if (!dateStr) return false;
  
  const sourceDate = parseSourceDate(dateStr);
  if (!sourceDate) return false;
  
  // Get today's date in Madrid timezone
  const madridNow = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const [year, month, day] = madridNow.split("-").map(Number);
  const todayMadrid = new Date(year, month - 1, day);
  
  // Compare dates (source is stale if it's before today)
  return sourceDate < todayMadrid;
}

/**
 * Formats the source date (DD/MM/YYYY) for display.
 */
function formatSourceDate(dateStr: string, locale: string): string {
  const sourceDate = parseSourceDate(dateStr);
  if (!sourceDate) return dateStr;
  
  return sourceDate.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function StatusCard({
  data,
  loading,
  error,
  isOffline,
  weatherWarnings,
  t,
}: StatusCardProps) {
  let theme: StatusTheme;
  let bigText: string;
  let description: string;
  let showObservations = false;
  let advisoryState: ClosureAdvisoryState = "none";
  const isSpanish = t.headerTitle.startsWith("¿");

  if (isOffline && !data) { // Only show offline error if we have NO data
    theme = ERROR_THEME;
    bigText = t.offline.big;
    description = t.offline.description;
  } else if (error && !data) { // Only show error if we have NO data
    theme = ERROR_THEME;
    bigText = t.error.big;
    description = t.error.description;
  } else {
    // We have data, show it (even if technically offline/error in background)
    // Fallback if data is null (shouldn't happen here due to logic, but for TS)
    if (data) {
      const code = data.code as StatusCode;
      const advisory = resolveClosureAdvisory(code, weatherWarnings);
      advisoryState = advisory.state;
      const primaryStatus = resolvePrimaryStatus(code, advisoryState);
      theme = STATUS_THEMES[primaryStatus.themeCode] || STATUS_THEMES[1];

      bigText = t.status[code].big;
      // Add an asterisk when code 1 has a warning advisory.
      // Codes 2-4 already include asterisks in translations.
      if (
        (
          advisoryState === "likely_closed_now" ||
          advisoryState === "warning_soon" ||
          advisoryState === "closing_later_today"
        ) &&
        code === 1
      ) {
        bigText = bigText + "*";
      }

      // Build description, integrating incident hours if present
      if (data.incidents && data.code >= 5) {
        // Treat both closing (5) and closed (6) as closed
        const formattedIncidentHours = formatIncidentHours(data.incidents);
        description = isSpanish
          ? `Cerrado por alerta meteorológica (${formattedIncidentHours}).`
          : `Closed due to weather warning (${formattedIncidentHours}).`;
      } else {
        if (advisoryState === "likely_closed_now") {
          description = t.likelyClosedNowDescription;
        } else if (advisoryState === "warning_soon") {
          description = t.warningSoonDescription;
        } else if (advisoryState === "closing_later_today") {
          description = t.closingLaterTodayDescription;
        } else {
          description = t.status[code].description;
        }
      }

      // Madrid observations are published in Spanish; avoid mixed-language blocks in English UI.
      showObservations = isSpanish && !!data.observations && data.code === 2;
    } else {
      // Fallback for safety (should be covered by loading/error blocks)
      theme = ERROR_THEME;
      bigText = "";
      description = "";
    }
  }

  let advisoryText: string | null = null;

  if (advisoryState === "likely_closed_now") {
    advisoryText = t.likelyClosedNowAlert;
  } else if (advisoryState === "warning_soon") {
    advisoryText = t.warningSoonAlert;
  } else if (advisoryState === "closing_later_today") {
    advisoryText = t.closingLaterTodayAlert;
  }

  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:p-8"
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <p className="text-xl sm:text-2xl font-medium" style={{ color: "#000000" }}>
          {t.loading}
        </p>
      ) : (
        <div className="flex flex-col items-center text-center max-w-2xl">
          {/* Big Status Text */}
          <h1
            className="font-black leading-none tracking-tighter text-center w-full"
            style={{
              color: theme.textColor,
              fontSize: "clamp(3.5rem, 18vw, 10rem)",
              minWidth: "min(90vw, 800px)",
            }}
          >
            {bigText}
          </h1>

          {/* Description Section */}
          <div
            className="mt-6 flex flex-col items-center gap-2"
            style={{ color: theme.textColor }}
          >
            <p className="text-xl sm:text-2xl font-medium">{description}</p>

            {/* Observations (Code 2) */}
            {showObservations && data?.observations && (
              <div className="mt-2 flex items-start gap-2 bg-white/10 rounded-lg p-4">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-left">{data.observations}</p>
              </div>
            )}
          </div>

          {/* Error link to official site */}
          {(error || isOffline) && (
            <a
              href="https://www.madrid.es/portales/munimadrid/es/Inicio/El-Ayuntamiento/Parques-y-jardines/Parque-de-El-Retiro"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 underline text-lg hover:opacity-80"
              style={{ color: theme.textColor }}
            >
              {t.checkOfficialSite}
            </a>
          )}

          {/* Predictive closure advisory - only when park is still shown as open/restricted (codes 1-4) */}
          {data && advisoryText && data.code >= 1 && data.code <= 4 && (
            <a
              href="https://x.com/MADRID"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center gap-3 bg-black/20 rounded-xl px-5 py-4 hover:bg-black/30 transition-colors"
              style={{ color: theme.textColor }}
            >
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <span className="text-lg font-medium">{advisoryText}</span>
            </a>
          )}

          {/* Context note when active warning may predate official park feed updates */}
          {data && advisoryState === "likely_closed_now" && data.code <= 4 && (
            <p className="mt-3 text-sm opacity-80" style={{ color: theme.textColor }}>
              {t.adjustedStatusNote}
            </p>
          )}

          {/* Stale data warning - only show when data is old */}
          {data && isSourceDateStale(data.source_updated_at) && (
            <p
              className="mt-4 text-sm opacity-80"
              style={{ color: theme.textColor }}
            >
              {t.lastSourceUpdate}:{" "}
              {data.source_updated_at && formatSourceDate(
                data.source_updated_at,
                t.headerTitle.startsWith("¿") ? "es" : "en"
              )}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
