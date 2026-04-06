import { useState, useEffect } from "react";
import { Info, AlertTriangle, Clock } from "lucide-react";
import type {
  RetiroStatus,
  StatusCode,
  StatusTheme,
  WeatherWarningSignal,
} from "../types";
import { STATUS_THEMES, ERROR_THEME, NIGHT_THEME } from "../types";
import type { Translations } from "../i18n";
import {
  resolveClosureAdvisory,
  type ClosureAdvisoryState,
} from "../utils/closureAdvisory";
import { formatIncidentHours } from "../utils/incidentHours";
import type { ParkHoursInfo } from "../utils/parkHours";
import { resolvePrimaryStatus } from "../utils/primaryStatus";

interface StatusCardProps {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  weatherWarnings: WeatherWarningSignal;
  parkHours: ParkHoursInfo;
  lastChangedAt: string | null;
  lastCheckedAt: number | null;
  t: Translations;
}

/**
 * Returns a relative time label that ticks every 15s.
 */
function useRelativeTime(
  timestamp: number | null,
  translations: { justNow: string; minutesAgo: string },
): string | null {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (timestamp === null) return null;
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return translations.justNow;
  const mins = Math.floor(diffSec / 60);
  return translations.minutesAgo.replace("{n}", String(mins));
}

/**
 * Formats an ISO timestamp as "HH:MM" in the Europe/Madrid timezone.
 */
function formatTimeInMadrid(isoString: string | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formats an ISO timestamp as either HH:MM (if today in Madrid) or a relative
 * string ("yesterday", "N days ago") if older.
 */
function formatLastChanged(
  isoString: string | null,
  translations: { yesterday: string; daysAgo: string },
): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;

  // Get today's date in Madrid timezone
  const now = new Date();
  const madridToday = now.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const changedDay = date.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

  if (changedDay === madridToday) {
    return formatTimeInMadrid(isoString);
  }

  // Use Date.UTC to avoid local-timezone parsing shifting the day
  const todayParts = madridToday.split("-");
  const changedParts = changedDay.split("-");
  const todayUtc = Date.UTC(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
  const changedUtc = Date.UTC(parseInt(changedParts[0]), parseInt(changedParts[1]) - 1, parseInt(changedParts[2]));
  const diffDays = Math.floor((todayUtc - changedUtc) / 86400000);

  const time = formatTimeInMadrid(isoString) ?? "";
  if (diffDays === 1) return time + translations.yesterday;
  if (diffDays > 1) return time + translations.daysAgo.replace("{n}", String(diffDays));
  return null;
}

export function StatusCard({
  data,
  loading,
  error,
  isOffline,
  weatherWarnings,
  parkHours,
  lastChangedAt,
  lastCheckedAt,
  t,
}: StatusCardProps) {
  const lastCheckedLabel = useRelativeTime(lastCheckedAt, t);
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
      const primaryStatus = resolvePrimaryStatus(code);
      theme = STATUS_THEMES[primaryStatus.themeCode] || STATUS_THEMES[1];

      // Nighttime override: codes 1-4 show as closed with navy theme
      if (parkHours.state === "closed_for_night" && code <= 4) {
        theme = NIGHT_THEME;
        bigText = t.status[5].big; // "CERRADO" / "CLOSED"
        description = t.parkHoursClosedForNight;
        // Suppress weather advisories and observations — park is physically closed
        advisoryState = "none";
      } else {
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
            // Append today's hours to the code-1 description
            if (code === 1) {
              description = description.replace(
                ".",
                ` (06:00 – ${parkHours.closeTime}).`,
              );
            }
          }
        }

        // Madrid observations are published in Spanish; avoid mixed-language blocks in English UI.
        showObservations = isSpanish && !!data.observations && data.code === 2;
      }
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

  let parkHoursPillText: string | null = null;
  if (parkHours.state === "closing_soon") {
    parkHoursPillText = t.parkHoursClosingSoon.replace("{time}", parkHours.closeTime);
  }

  const predictedOpeningPillText =
    data && data.code >= 5 && data.predicted_opening
      ? t.predictedOpeningTime.replace("{time}", data.predicted_opening)
      : null;

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

          {/* Park hours pill - only when park is not already weather-closed (codes 1-4) */}
          {data && parkHoursPillText && data.code >= 1 && data.code <= 4 && (
            <div
              className="mt-4 flex items-center gap-3 bg-black/20 rounded-xl px-5 py-4"
              style={{ color: theme.textColor }}
            >
              <Clock className="w-6 h-6 shrink-0" />
              <span className="text-lg font-medium">{parkHoursPillText}</span>
            </div>
          )}

          {/* Predicted opening pill - only when park is weather-closed (codes 5-6) */}
          {predictedOpeningPillText && (
            <div
              className="mt-4 flex items-center gap-3 bg-black/20 rounded-xl px-5 py-4"
              style={{ color: theme.textColor }}
            >
              <Clock className="w-6 h-6 shrink-0" />
              <span className="text-lg font-medium">{predictedOpeningPillText}</span>
            </div>
          )}

          {/* Context note when active warning may predate official park feed updates */}
          {data && advisoryState === "likely_closed_now" && data.code <= 4 && (
            <p className="mt-3 text-sm opacity-80" style={{ color: theme.textColor }}>
              {t.adjustedStatusNote}
            </p>
          )}

          {/* Timestamps */}
          {data && (
            <p
              className="mt-4 text-sm opacity-80"
              style={{ color: theme.textColor }}
            >
              {t.statusUpdated} {formatLastChanged(lastChangedAt, t) ?? "—"}
              {lastCheckedLabel && (
                <> · {t.lastChecked} {lastCheckedLabel}</>
              )}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
