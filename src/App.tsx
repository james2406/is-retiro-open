import { useState, useEffect } from "react";
import { Trees } from "lucide-react";
import { useRetiroStatus } from "./hooks/useRetiroStatus";
import { useWeatherWarnings } from "./hooks/useWeatherWarnings";
import { StatusCard } from "./components/StatusCard";
import { Footer } from "./components/Footer";
import { STATUS_THEMES, ERROR_THEME } from "./types";
import { detectLocale, getTranslations } from "./i18n";
import type { StatusCode, RetiroStatus } from "./types";
import type { Locale } from "./i18n";
import { resolveClosureAdvisory } from "./utils/closureAdvisory";
import { resolvePrimaryStatus } from "./utils/primaryStatus";

interface AppProps {
  initialData?: RetiroStatus | null;
  initialLocale?: Locale;
}

function App({ initialData = null, initialLocale }: AppProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale || "es");
  const { data, loading, error, isOffline } = useRetiroStatus(initialData);
  const weatherWarnings = useWeatherWarnings();

  useEffect(() => {
    // Only attempt detection if no initial locale was provided (e.g. CSR fallback)
    // or if we want to support dynamic switching via URL params on top of SSG.
    // However, for SSG pages at /en or /, the locale is fixed by the path.
    // We can keep detectLocale() only if initialLocale is missing.
    if (!initialLocale) {
      setLocale(detectLocale());
    }
  }, [initialLocale]);

  const t = getTranslations(locale);
  const advisory = resolveClosureAdvisory(data?.code, weatherWarnings);
  const primaryStatus = resolvePrimaryStatus(data?.code, advisory.state);

  // Determine current theme for consistent styling
  let theme;
  if (loading) {
    // Use white background during loading
    theme = { bgColor: "#FFFFFF", textColor: "#000000" };
  } else if (!data) {
    // No data available (offline or error state)
    theme = ERROR_THEME;
  } else {
    // We have data (either initial or fetched), so use primary status resolution.
    theme = STATUS_THEMES[primaryStatus.themeCode as StatusCode] || STATUS_THEMES[1];
  }

  // Update theme-color meta tag for mobile browsers
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.bgColor);
    }
    document.body.style.backgroundColor = theme.bgColor;
  }, [theme.bgColor]);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: theme.bgColor }}
    >

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header
          className="pt-8 pb-4 px-6 text-center"
          style={{ color: theme.textColor }}
        >
          <div className="inline-flex items-center gap-2">
            <Trees className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-semibold tracking-wide">
              {t.headerTitle}
            </h2>
          </div>
        </header>

        {/* Main Status Card */}
        <StatusCard
          data={data}
          loading={loading}
          error={error}
          isOffline={isOffline}
          weatherWarnings={weatherWarnings}
          t={t}
        />

        {/* Footer */}
        <Footer textColor={theme.textColor} t={t} />
      </div>
    </div>
  );
}

export default App;
