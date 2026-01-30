import { useState, useEffect } from "react";
import { Trees } from "lucide-react";
import { useRetiroStatus } from "./hooks/useRetiroStatus";
import { StatusCard } from "./components/StatusCard";
import { Footer } from "./components/Footer";
import { STATUS_THEMES, ERROR_THEME } from "./types";
import { detectLocale, getTranslations } from "./i18n";
import type { StatusCode } from "./types";
import type { Locale } from "./i18n";

function App() {
  const [locale, setLocale] = useState<Locale>("es");
  const { data, loading, error, isOffline } = useRetiroStatus();

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = getTranslations(locale);

  // Determine current theme for consistent styling
  let theme;
  if (isOffline || error || !data) {
    theme = ERROR_THEME;
  } else {
    theme = STATUS_THEMES[data.code as StatusCode] || STATUS_THEMES[1];
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-500 relative overflow-hidden"
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
