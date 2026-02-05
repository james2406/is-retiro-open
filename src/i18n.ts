export type Locale = "es" | "en";

export interface Translations {
  headerTitle: string;
  headerSubtitle: string;
  loading: string;
  lastSourceUpdate: string;
  weatherAlert: string;
  likelyClosedNowAlert: string;
  closingSoonAlert: string;
  closingLaterTodayAlert: string;
  closingLaterTodayDescription: string;
  predictedClosedBig: string;
  predictedClosedDescription: string;
  closingBig: string;
  closingDescription: string;
  dataProvidedBy: string;
  license: string;
  checkOfficialSite: string;
  status: {
    1: { big: string; description: string };
    2: { big: string; description: string };
    3: { big: string; description: string };
    4: { big: string; description: string };
    5: { big: string; description: string };
    6: { big: string; description: string };
  };
  error: { big: string; description: string };
  offline: { big: string; description: string };
}

const translations: Record<Locale, Translations> = {
  es: {
    headerTitle: "¿Está abierto el Retiro?",
    headerSubtitle: "",
    loading: "Cargando...",
    lastSourceUpdate: "Última actualización",
    weatherAlert: "Alerta meteorológica · Verifica en @MADRID →",
    likelyClosedNowAlert: "Aviso activo · Verifica en @MADRID →",
    closingSoonAlert: "Aviso meteorológico · Verifica en @MADRID →",
    closingLaterTodayAlert: "Aviso meteorológico · Verifica en @MADRID →",
    closingLaterTodayDescription: "Posible cierre más tarde hoy.",
    predictedClosedBig: "CERRADO",
    predictedClosedDescription: "Cierre probable por aviso meteorológico activo.",
    closingBig: "CIERRE INMINENTE",
    closingDescription: "Posible cierre inminente por aviso meteorológico.",
    dataProvidedBy: "Datos facilitados por el",
    license: "Licencia: Madrid Open Data",
    checkOfficialSite: "Ver web oficial",
    status: {
      1: { big: "ABIERTO", description: "Horario habitual." },
      2: { big: "ABIERTO*", description: "Incidencias reportadas." },
      3: {
        big: "ABIERTO*",
        description: "Precaución: Zonas infantiles y deportivas restringidas.",
      },
      4: {
        big: "ABIERTO*",
        description:
          "Eventos suspendidos. Se recomienda no permanecer en el parque.",
      },
      5: { big: "CERRADO", description: "Cerrado por alerta meteorológica." },
      6: { big: "CERRADO", description: "Cerrado por alerta meteorológica." },
    },
    error: { big: "?", description: "Error obteniendo datos." },
    offline: { big: "?", description: "Sin conexión." },
  },
  en: {
    headerTitle: "Is Retiro Open?",
    headerSubtitle: "",
    loading: "Loading...",
    lastSourceUpdate: "Last update",
    weatherAlert: "Weather warning · Verify on @MADRID →",
    likelyClosedNowAlert: "Active warning · Verify on @MADRID →",
    closingSoonAlert: "Weather warning · Verify on @MADRID →",
    closingLaterTodayAlert: "Weather warning · Verify on @MADRID →",
    closingLaterTodayDescription: "May close later today.",
    predictedClosedBig: "CLOSED",
    predictedClosedDescription: "Likely closure due to an active weather warning.",
    closingBig: "CLOSING",
    closingDescription: "Likely to close soon due to weather warnings.",
    dataProvidedBy: "Data provided by",
    license: "License: Madrid Open Data",
    checkOfficialSite: "Check official site",
    status: {
      1: { big: "OPEN", description: "Regular hours." },
      2: { big: "OPEN*", description: "Incidents reported." },
      3: {
        big: "OPEN*",
        description: "Caution: Restricted access to specific zones.",
      },
      4: {
        big: "OPEN*",
        description:
          "Events suspended. Recommendation: Do not stay in the park.",
      },
      5: { big: "CLOSED", description: "Closed due to weather alert." },
      6: { big: "CLOSED", description: "Closed due to weather alert." },
    },
    error: { big: "?", description: "Error fetching data." },
    offline: { big: "?", description: "No internet connection." },
  },
};

export function detectLocale(): Locale {
  // SSR check
  if (typeof window === "undefined") {
    return "es"; // Default to Spanish for SSR
  }

  // 1. Check for injected locale (SSG hydration)
  if (typeof window !== "undefined" && (window as any).__INITIAL_LOCALE__) {
    return (window as any).__INITIAL_LOCALE__ as Locale;
  }

  // 2. Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get("lang");
  if (langParam === "en" || langParam === "es") {
    return langParam;
  }

  // 2. Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("es")) {
    return "es";
  }

  // 3. Default to Spanish for all other languages
  return "es";
}

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}
