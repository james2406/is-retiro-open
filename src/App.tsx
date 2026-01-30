import { useState, useEffect } from "react";
import { Trees } from "lucide-react";
import { useRetiroStatus } from "./hooks/useRetiroStatus";
import { StatusCard } from "./components/StatusCard";
import { Footer } from "./components/Footer";
import { STATUS_THEMES, ERROR_THEME } from "./types";
import { detectLocale, getTranslations } from "./i18n";
import type { StatusCode, RetiroStatus } from "./types";
import type { Locale } from "./i18n";

interface AppProps {
  initialData?: RetiroStatus | null;
}

function App({ initialData = null }: AppProps) {
  const [locale, setLocale] = useState<Locale>("es");
  const { data, loading, error, isOffline } = useRetiroStatus(initialData);

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = getTranslations(locale);

  // Determine current theme for consistent styling
  let theme;
  if (loading) {
    // Use white background during loading
    theme = { bgColor: "#FFFFFF", textColor: "#000000" };
  } else if (!data) { // Removed isOffline check from here
    theme = ERROR_THEME;
  } else if (isOffline && !data) { // Only error theme if offline AND no data
    theme = ERROR_THEME;
  } else {
    // We have data (either initial or fetched), so use it even if offline
    if (data) {
      theme = STATUS_THEMES[data.code as StatusCode] || STATUS_THEMES[1];
    } else {
      theme = ERROR_THEME;
    }
  }

  // Update theme-color meta tag for mobile browsers
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.bgColor);
    }
  }, [theme.bgColor]);

  return (
    <div
      className="h-screen flex flex-col relative overflow-y-auto overflow-x-hidden"
      style={{ backgroundColor: theme.bgColor }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 rounded-full opacity-[0.07] blur-3xl animate-float"
          style={{ backgroundColor: theme.textColor }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 rounded-full opacity-[0.07] blur-3xl animate-float-delayed"
          style={{ backgroundColor: theme.textColor }}
        />
      </div>

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
          t={t}
        />

        {/* Footer */}
        <Footer textColor={theme.textColor} t={t} />
      </div>
    </div>
  );
}

export default App;
