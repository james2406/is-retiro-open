export type Locale = "es" | "en";

export interface Translations {
  headerTitle: string;
  loading: string;
  lastSourceUpdate: string;
  likelyClosedNowAlert: string;
  likelyClosedNowDescription: string;
  warningSoonAlert: string;
  closingLaterTodayAlert: string;
  warningSoonDescription: string;
  closingLaterTodayDescription: string;
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
    likelyClosedNowAlert: "Verifica el estado actual en @MADRID →",
    likelyClosedNowDescription:
      "Abierto ahora, pero una alerta meteorológica activa podría cerrar el parque.",
    warningSoonAlert: "Verifica el estado actual en @MADRID →",
    closingLaterTodayAlert: "Verifica el estado actual en @MADRID →",
    warningSoonDescription:
      "Abierto ahora, pero podría cerrar pronto por alerta meteorológica.",
    closingLaterTodayDescription:
      "Abierto ahora, pero podría cerrar más tarde hoy por alerta meteorológica.",
    adjustedStatusNote:
      "Las actualizaciones oficiales pueden retrasarse durante alertas activas.",
    dataProvidedBy: "Datos facilitados por el",
    license: "Licencia: Madrid Open Data",
    checkOfficialSite: "Ver web oficial",
    status: {
      1: { big: "ABIERTO", description: "Horario habitual." },
      2: { big: "ABIERTO*", description: "Incidencias reportadas." },
      3: {
        big: "ABIERTO*",
        description:
          "Precaución: acceso restringido a zonas infantiles, deportivas y de mayores, y a Jardines de Cecilio Rodríguez. Evita permanecer bajo el arbolado.",
      },
      4: {
        big: "ABIERTO*",
        description:
          "Acceso restringido en varias zonas, incluidos los Jardines de Cecilio Rodríguez y Herrero Palacios. Eventos al aire libre suspendidos; se recomienda abandonar el parque.",
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
    likelyClosedNowAlert: "Verify current status on @MADRID →",
    likelyClosedNowDescription:
      "Open now, but an active weather warning could trigger closure.",
    warningSoonAlert: "Verify current status on @MADRID →",
    closingLaterTodayAlert: "Verify current status on @MADRID →",
    warningSoonDescription: "Open now, but a weather warning is expected soon.",
    closingLaterTodayDescription:
      "Open now, but a weather warning is expected later today.",
    adjustedStatusNote:
      "Official updates may lag during active warnings.",
    dataProvidedBy: "Data provided by",
    license: "License: Madrid Open Data",
    checkOfficialSite: "Check official site",
    status: {
      1: { big: "OPEN", description: "Regular hours." },
      2: { big: "OPEN*", description: "Incidents reported." },
      3: {
        big: "OPEN*",
        description:
          "Caution: restricted access to children's, sports, and senior areas, and to Cecilio Rodríguez Gardens. Avoid staying under trees.",
      },
      4: {
        big: "OPEN*",
        description:
          "Restricted access in multiple areas, including Cecilio Rodríguez and Herrero Palacios Gardens. Outdoor events are suspended; visitors are advised to leave the park.",
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
