import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p: string) => path.resolve(__dirname, p);

const LOCALES = ["es", "en"] as const;

// Simple meta descriptions for SEO
const META_DESCRIPTIONS = {
  es: "Consulta en tiempo real el estado del Parque del Retiro de Madrid.",
  en: "Check real-time status of Retiro Park in Madrid."
};

// Safe JSON serializer to prevent XSS when injecting data into HTML
function serializeForScript(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Helper to generate dynamic descriptions for SEO/Social
function getStatusDescription(statusData: any, locale: string): string {
  const isEs = locale === "es";
  const { status } = statusData;

  if (status === "open") {
    return isEs
      ? "✅ SÍ, el Retiro está ABIERTO. Consulta el horario y condiciones."
      : "✅ YES, Retiro Park is OPEN. Check hours and conditions.";
  } else if (status === "restricted") {
    return isEs
      ? "⚠️ PRECAUCIÓN: El Retiro tiene zonas balizadas y restricciones."
      : "⚠️ CAUTION: Retiro Park has restricted zones.";
  } else {
    return isEs
      ? "⛔️ CERRADO: El Retiro está cerrado por alerta meteorológica."
      : "⛔️ CLOSED: Retiro Park is closed due to weather alert.";
  }
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
    // We also update the lang attribute
    let html = template
      .replace(`<!--app-html-->`, appHtml)
      .replace(
        `<!--app-data-->`,
        `<script>window.__INITIAL_DATA__ = ${serializeForScript(statusData)}; window.__INITIAL_LOCALE__ = "${locale}";</script>`
      )
      .replace('lang="es"', `lang="${locale}"`);

    // 4. Update Meta Tags (Description & OG)
    const dynamicDescription = getStatusDescription(statusData, locale);
    
    // Replace the default description wherever it appears
    const descriptionRegex = new RegExp(META_DESCRIPTIONS.es, "g");
    html = html.replace(descriptionRegex, dynamicDescription);

    // Update OG Image to use dynamic Vercel OG endpoint
    const ogImageUrl = `https://is-retiro-open.vercel.app/api/og?code=${statusData.code}`;
    
    // Replace the default absolute OG image URL with our dynamic one
    // We use a regex that matches the specific default URL in index.html
    const defaultOgImageRegex = /https:\/\/is-retiro-open\.vercel\.app\/og-image\.png/g;
    html = html.replace(defaultOgImageRegex, ogImageUrl);



    // Update locale-specific tags
    if (locale === "en") {
        html = html.replace('content="es_ES"', 'content="en_US"');
    }

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
