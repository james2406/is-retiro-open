import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p: string) => path.resolve(__dirname, p);

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

const SITE_URL = "https://www.estaabiertoelretiro.com";

// Static meta descriptions aimed at search snippets.
const META_DESCRIPTIONS: Record<Locale, string> = {
  es: "¿Está abierto el Retiro ahora? Consulta el estado en tiempo real del Parque del Retiro de Madrid, con datos del Ayuntamiento y avisos meteorológicos.",
  en: "Is Retiro Park open now? Check real-time Retiro Park status in Madrid with official city data and weather warning context.",
};

// Open Graph status text (matches i18n.ts status.big values)
const OG_STATUS: Record<number, Record<Locale, string>> = {
  1: { es: "ABIERTO", en: "OPEN" },
  2: { es: "ABIERTO*", en: "OPEN*" },
  3: { es: "ABIERTO*", en: "OPEN*" },
  4: { es: "ABIERTO*", en: "OPEN*" },
  5: { es: "CERRADO", en: "CLOSED" },
  6: { es: "CERRADO", en: "CLOSED" },
};

// Open Graph descriptions
const OG_DESCRIPTIONS: Record<number, Record<Locale, string>> = {
  1: { es: "El Retiro está abierto.", en: "Retiro Park is open." },
  2: {
    es: "El Retiro está abierto con incidencias.",
    en: "Retiro Park is open with incidents.",
  },
  3: {
    es: "El Retiro está abierto con precaución.",
    en: "Retiro Park is open with caution.",
  },
  4: {
    es: "El Retiro tiene acceso restringido.",
    en: "Retiro Park has restricted access.",
  },
  5: { es: "El Retiro está cerrado.", en: "Retiro Park is closed." },
  6: { es: "El Retiro está cerrado.", en: "Retiro Park is closed." },
};

const OG_TITLES: Record<Locale, string> = {
  es: "¿Está abierto el Retiro?",
  en: "Is Retiro Open?",
};

const PAGE_TITLES: Record<Locale, string> = {
  es: "¿Está abierto el Retiro?",
  en: "Is Retiro Open?",
};

const OG_SITE_NAMES: Record<Locale, string> = {
  es: "¿Está abierto el Retiro?",
  en: "Is Retiro Open?",
};

const APP_TITLES: Record<Locale, string> = {
  es: "¿Retiro Abierto?",
  en: "Is Retiro Open?",
};

const OG_LOCALES: Record<Locale, string> = { es: "es_ES", en: "en_GB" };

const PLACE_NAMES: Record<Locale, string> = {
  es: "Parque del Retiro",
  en: "Retiro Park",
};

// Safe JSON serializer to prevent XSS when injecting data into HTML
function serializeForScript(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function prerender() {
  console.log("Starting SSG Prerender...");

  // 1. Fetch Data (Strict Error Handling)
  let statusData;
  try {
    statusData = await fetchRetiroStatus();
    console.log("Fetched Retiro Status:", JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error("CRITICAL: Failed to fetch Retiro status during build.");
    console.error(error);
    // FAIL the build. Do not deploy dangerous fallbacks.
    process.exit(1);
  }

  // 2. Load the server entry
  const templatePath = toAbsolute("dist/index.html");
  if (!fs.existsSync(templatePath)) {
    console.error("CRITICAL: dist/index.html not found. Did the client build fail?");
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, "utf-8");
  
  // Note: We assume the build script runs `vite build --ssr src/entry-server.tsx` first.
  const serverEntryPath = toAbsolute("dist/server/entry-server.js");
  if (!fs.existsSync(serverEntryPath)) {
     console.error("CRITICAL: dist/server/entry-server.js not found. Did the server build fail?");
     process.exit(1);
  }

  // Use file URL for cross-platform compatibility (Windows)
  const { render } = await import(pathToFileURL(serverEntryPath).href);

  // 3. Generate locale-specific web manifests
  const manifestTemplatePath = toAbsolute("dist/manifest.webmanifest");
  const manifestTemplate = fs.existsSync(manifestTemplatePath)
    ? fs.readFileSync(manifestTemplatePath, "utf-8")
    : null;

  if (manifestTemplate) {
    for (const locale of LOCALES) {
      const manifest = manifestTemplate.replaceAll("__APP_TITLE__", APP_TITLES[locale]);
      const manifestPath = locale === "es"
        ? toAbsolute("dist/manifest.webmanifest")
        : toAbsolute(`dist/${locale}/manifest.webmanifest`);
      const manifestDir = path.dirname(manifestPath);
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
      }
      fs.writeFileSync(manifestPath, manifest);
      console.log(`Generated manifest: ${manifestPath}`);
    }
  }

  // 4. Render for each locale
  for (const locale of LOCALES) {
    console.log(`Rendering for locale: ${locale}`);

    // 3a. Render the app
    const appHtml = render(statusData, locale);

    // 3b. Inject into HTML
    // We replace the outlet <!--app-html--> and also inject the initial state
    // We also update the lang attribute and meta description
    let html = template
      .replace(`<!--app-html-->`, appHtml)
      .replace(
        `<!--app-data-->`,
        `<script>window.__INITIAL_DATA__ = ${serializeForScript(statusData)}; window.__INITIAL_LOCALE__ = "${locale}";</script>`
      )
      .replace('lang="es"', `lang="${locale}"`);

    // Replace Open Graph placeholders
    const code = statusData.code;
    if (!(code in OG_DESCRIPTIONS)) {
      console.error(`CRITICAL: Unexpected status code ${code} from API`);
      process.exit(1);
    }
    const canonicalUrl = locale === "es" ? SITE_URL : `${SITE_URL}/${locale}`;
    const ogImage = `${SITE_URL}/og/${locale}-${code}.png`;
    const ogLocaleAlternate =
      locale === "es" ? OG_LOCALES.en : OG_LOCALES.es;

    const jsonLd = serializeForScript({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: PAGE_TITLES[locale],
      description: META_DESCRIPTIONS[locale],
      url: canonicalUrl,
      inLanguage: locale === "es" ? "es-ES" : "en-GB",
      dateModified: statusData.updated_at,
      isPartOf: {
        "@type": "WebSite",
        name: OG_SITE_NAMES[locale],
        url: SITE_URL,
      },
      about: {
        "@type": "Place",
        name: PLACE_NAMES[locale],
      },
    });

    html = html
      .replaceAll("__MANIFEST_URL__", locale === "es" ? "/manifest.webmanifest" : `/${locale}/manifest.webmanifest`)
      .replaceAll("__META_DESCRIPTION__", META_DESCRIPTIONS[locale])
      .replaceAll("__APP_TITLE__", APP_TITLES[locale])
      .replaceAll("__PAGE_TITLE__", PAGE_TITLES[locale])
      .replaceAll("__CANONICAL_URL__", canonicalUrl)
      .replaceAll("__ALT_ES__", SITE_URL)
      .replaceAll("__ALT_EN__", `${SITE_URL}/en`)
      .replaceAll("__ALT_DEFAULT__", SITE_URL)
      .replaceAll("__OG_URL__", canonicalUrl)
      .replaceAll("__OG_TITLE__", OG_TITLES[locale])
      .replaceAll("__OG_SITE_NAME__", OG_SITE_NAMES[locale])
      .replaceAll("__OG_DESCRIPTION__", OG_DESCRIPTIONS[code][locale])
      .replaceAll("__OG_IMAGE__", ogImage)
      .replaceAll(
        "__OG_IMAGE_ALT__",
        `${OG_TITLES[locale]} ${OG_STATUS[code][locale]}`
      )
      .replaceAll("__OG_LOCALE__", OG_LOCALES[locale])
      .replaceAll("__OG_LOCALE_ALTERNATE__", ogLocaleAlternate)
      .replaceAll("__TWITTER_TITLE__", OG_TITLES[locale])
      .replaceAll("__TWITTER_DESCRIPTION__", OG_DESCRIPTIONS[code][locale])
      .replaceAll("__TWITTER_IMAGE__", ogImage)
      .replaceAll(
        "__TWITTER_IMAGE_ALT__",
        `${OG_TITLES[locale]} ${OG_STATUS[code][locale]}`
      )
      .replaceAll("__JSON_LD__", jsonLd);

    // 5. Write to correct file location
    let filePath;
    if (locale === "es") {
        filePath = toAbsolute("dist/index.html");
    } else {
        const dir = toAbsolute(`dist/${locale}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        filePath = path.join(dir, "index.html");
    }
    
    fs.writeFileSync(filePath, html);
    console.log(`Successfully pre-rendered ${filePath}`);
  }
}

prerender();
