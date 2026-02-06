export type Locale = "es" | "en";

export interface Translations {
  headerTitle: string;
  loading: string;
  lastSourceUpdate: string;
  likelyClosedNowAlert: string;
  closingSoonAlert: string;
  closingLaterTodayAlert: string;
  closingLaterTodayDescription: string;
  predictedClosedBig: string;
  predictedClosedDescription: string;
  closingBig: string;
  closingDescription: string;
  adjustedStatusNote: string;
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
    loading: "Cargando...",
    lastSourceUpdate: "Última actualización",
    likelyClosedNowAlert: "Alerta meteorológica activa · Verifica en @MADRID →",
    closingSoonAlert: "Alerta meteorológica · Verifica en @MADRID →",
    closingLaterTodayAlert: "Alerta meteorológica · Verifica en @MADRID →",
    closingLaterTodayDescription: "Posible cierre más tarde hoy.",
    predictedClosedBig: "CERRADO",
    predictedClosedDescription: "Cierre probable por alerta meteorológica activa.",
    closingBig: "CIERRE INMINENTE",
    closingDescription: "Posible cierre inminente por alerta meteorológica.",
    adjustedStatusNote:
      "Estado principal ajustado por una alerta meteorológica activa de AEMET; el parte oficial del parque puede retrasarse.",
    dataProvidedBy: "Datos facilitados por el",
    license: "Licencia: Madrid Open Data",
    checkOfficialSite: "Ver web oficial",
    status: {
      1: { big: "ABIERTO", description: "Horario habitual." },
      2: { big: "ABIERTO*", description: "Incidencias reportadas." },
      3: {
        big: "ABIERTO*",
        description:
          "Precaución: acceso restringido a zonas infantiles, deportivas y de mayores, y a Jardines de Cecilio Rodríguez (acceso al Pabellón por la puerta del Paseo de Uruguay). No permanecer bajo el arbolado.",
      },
      4: {
        big: "ABIERTO*",
        description:
          "Acceso restringido a zonas infantiles, deportivas y de mayores; área canina, Pinar de San Blas, Cementerio, Planteles, Jardines de Cecilio Rodríguez y Jardines de Herrero Palacios. Eventos al aire libre suspendidos; se recomienda abandonar el parque.",
      },
      5: { big: "CERRADO", description: "Cerrado por alerta meteorológica." },
      6: { big: "CERRADO", description: "Cerrado por alerta meteorológica." },
    },
    error: { big: "?", description: "Error obteniendo datos." },
    offline: { big: "?", description: "Sin conexión." },
  },
  en: {
    headerTitle: "Is Retiro Open?",
    loading: "Loading...",
    lastSourceUpdate: "Last update",
    likelyClosedNowAlert: "Active weather warning · Verify on @MADRID →",
    closingSoonAlert: "Weather warning · Verify on @MADRID →",
    closingLaterTodayAlert: "Weather warning · Verify on @MADRID →",
    closingLaterTodayDescription: "May close later today.",
    predictedClosedBig: "CLOSED",
    predictedClosedDescription: "Likely closure due to an active weather warning.",
    closingBig: "CLOSING",
    closingDescription: "Likely to close soon due to a weather warning.",
    adjustedStatusNote:
      "Main status adjusted due to an active AEMET warning; official park feed may lag.",
    dataProvidedBy: "Data provided by",
    license: "License: Madrid Open Data",
    checkOfficialSite: "Check official site",
    status: {
      1: { big: "OPEN", description: "Regular hours." },
      2: { big: "OPEN*", description: "Incidents reported." },
      3: {
        big: "OPEN*",
        description:
          "Caution: restricted access to children's, sports, and senior areas, and to Cecilio Rodríguez Gardens (Pavilion access via the Paseo de Uruguay gate). Do not stay under trees.",
      },
      4: {
        big: "OPEN*",
        description:
          "Restricted access to children's, sports, and senior areas; dog area, Pinar de San Blas, Cemetery, Planteles, Cecilio Rodríguez Gardens, and Herrero Palacios Gardens. Outdoor events suspended; visitors are advised to leave the park.",
      },
      5: { big: "CLOSED", description: "Closed due to weather warning." },
      6: { big: "CLOSED", description: "Closed due to weather warning." },
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

  // 3. Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("es")) {
    return "es";
  }

  // 4. Default to Spanish for all other languages
  return "es";
}

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}
