import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p: string) => path.resolve(__dirname, p);

const LOCALES = ["es", "en"] as const;

// Simple meta descriptions for SEO
const META_DESCRIPTIONS = {
  es: "Consulta en tiempo real el estado del Parque del Retiro de Madrid.",
  en: "Check real-time status of Retiro Park in Madrid."
};

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

  const { render } = await import(serverEntryPath);

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
        `<script>window.__INITIAL_DATA__ = ${JSON.stringify(statusData)}; window.__INITIAL_LOCALE__ = "${locale}";</script>`
      )
      .replace('lang="es"', `lang="${locale}"`);

    // Update meta description if needed
    if (locale === "en") {
      html = html.replace(
        META_DESCRIPTIONS.es, 
        META_DESCRIPTIONS.en
      );
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
