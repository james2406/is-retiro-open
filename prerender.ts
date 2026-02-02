import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p: string) => path.resolve(__dirname, p);

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

const SITE_URL = "https://isretiroopen.com";

// Simple meta descriptions for SEO
const META_DESCRIPTIONS: Record<Locale, string> = {
  es: "Consulta en tiempo real el estado del Parque del Retiro de Madrid.",
  en: "Check real-time status of Retiro Park in Madrid.",
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

const OG_LOCALES: Record<Locale, string> = { es: "es_ES", en: "en_GB" };

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

  // 3. Render for each locale
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

    // Update meta description if needed
    if (locale === "en") {
      html = html.replace(META_DESCRIPTIONS.es, META_DESCRIPTIONS.en);
    }

    // Replace Open Graph placeholders
    const code = statusData.code;
    const ogImage = `${SITE_URL}/og/${locale}-${code}.png`;

    html = html
      .replaceAll(
        "__OG_URL__",
        locale === "es" ? SITE_URL : `${SITE_URL}/${locale}`
      )
      .replaceAll("__OG_TITLE__", OG_TITLES[locale])
      .replaceAll("__OG_DESCRIPTION__", OG_DESCRIPTIONS[code][locale])
      .replaceAll("__OG_IMAGE__", ogImage)
      .replaceAll(
        "__OG_IMAGE_ALT__",
        `${OG_TITLES[locale]} ${OG_STATUS[code][locale]}`
      )
      .replaceAll("__OG_LOCALE__", OG_LOCALES[locale]);

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
