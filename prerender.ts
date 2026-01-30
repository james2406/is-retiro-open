import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";
import {
  toAbsolute,
  serializeForScript,
  getTemplateWithCriticalCss,
  writeHtmlForLocale
} from "./ssg-utils";

const LOCALES = ["es", "en"] as const;

const META_DESCRIPTIONS = {
  es: "Consulta en tiempo real el estado del Parque del Retiro de Madrid.",
  en: "Check real-time status of Retiro Park in Madrid."
};

async function prerender() {
  console.log("Starting SSG Prerender...");

  // 1. Fetch Data
  let statusData;
  try {
    statusData = await fetchRetiroStatus();
    console.log("Fetched Retiro Status:", statusData.code);
  } catch (error) {
    console.error("CRITICAL: Failed to fetch Retiro status.");
    process.exit(1);
  }

  // 2. Prepare Template (Inline CSS)
  const template = getTemplateWithCriticalCss(toAbsolute("dist/index.html"));

  // 3. Load Server Entry
  const serverEntryPath = toAbsolute("dist/server/entry-server.js");
  const { render } = await import(pathToFileURL(serverEntryPath).href);

  // 4. Generate Pages
  for (const locale of LOCALES) {
    // Render App
    const appHtml = render(statusData, locale);

    // Inject Data & HTML
    const html = template
      .replace(`<!--app-html-->`, appHtml)
      .replace(
        `<!--app-data-->`,
        `<script>window.__INITIAL_DATA__ = ${serializeForScript(statusData)}; window.__INITIAL_LOCALE__ = "${locale}";</script>`
      )
      .replace('lang="es"', `lang="${locale}"`);

    // Determine Output Path
    const outputPath = locale === "es"
      ? toAbsolute("dist/index.html")
      : toAbsolute(`dist/${locale}/index.html`);

    // Write File
    writeHtmlForLocale(outputPath, html, locale, META_DESCRIPTIONS);
  }
}

prerender();
