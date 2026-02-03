import { Info, AlertTriangle } from "lucide-react";
import type { RetiroStatus, StatusCode, StatusTheme } from "../types";
import { STATUS_THEMES, ERROR_THEME } from "../types";
import type { Translations } from "../i18n";

interface StatusCardProps {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  hasActiveWarning: boolean;
  t: Translations;
}

/**
 * Parses a date string in DD/MM/YYYY format and returns a Date object.
 */
function parseSourceDate(dateStr: string): Date | null {
  try {
    const [day, month, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
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
  hasActiveWarning,
  t,
}: StatusCardProps) {
  let theme: StatusTheme;
  let bigText: string;
  let description: string;
  let showObservations = false;

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
      theme = STATUS_THEMES[code] || STATUS_THEMES[1];
      bigText = t.status[code].big;

      // Add asterisk to "ABIERTO"/"OPEN" (code 1) when weather warning is active
      // Codes 2-4 already have asterisks in translations
      if (hasActiveWarning && code === 1) {
        bigText = bigText + "*";
      }

      // Build description, integrating incident hours if present
      if (data.incidents && data.code >= 5) {
        const isSpanish = t.headerTitle.startsWith("¿");
        // Treat both closing (5) and closed (6) as closed
        description = isSpanish
          ? `Cerrado por alerta meteorológica (${data.incidents}).`
          : `Closed due to weather alert (${data.incidents.replace(
              " a ",
              "–"
            )}).`;
      } else {
        description = t.status[code].description;
      }

      showObservations = !!data.observations && data.code === 2;
    } else {
      // Fallback for safety (should be covered by loading/error blocks)
      theme = ERROR_THEME;
      bigText = "";
      description = "";
    }
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

          {/* Weather alert verification prompt - show when warning active AND park not closed (codes 1-4) */}
          {data && hasActiveWarning && data.code >= 1 && data.code <= 4 && (
            <a
              href="https://x.com/MADRID"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center gap-3 bg-black/20 rounded-xl px-5 py-4 hover:bg-black/30 transition-colors"
              style={{ color: theme.textColor }}
            >
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <span className="text-lg font-medium">{t.weatherAlert}</span>
            </a>
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
