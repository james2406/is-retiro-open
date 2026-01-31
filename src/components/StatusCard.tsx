import { Info } from "lucide-react";
import type { RetiroStatus, StatusCode, StatusTheme } from "../types";
import { STATUS_THEMES, ERROR_THEME } from "../types";
import type { Translations } from "../i18n";

interface StatusCardProps {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  t: Translations;
}

function formatMadridTime(isoString: string, locale: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function StatusCard({
  data,
  loading,
  error,
  isOffline,
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

          {/* Last Updated */}
          {data?.updated_at && (
            <p
              className="mt-4 text-sm opacity-60"
              style={{ color: theme.textColor }}
            >
              {t.updated}:{" "}
              {formatMadridTime(
                data.updated_at,
                t.headerTitle.startsWith("¿") ? "es" : "en"
              )}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
