import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRetiroStatus } from "./src/utils/madridApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p: string) => path.resolve(__dirname, p);

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

  // 3. Render the app
  const appHtml = render(statusData);

  // 4. Inject into HTML
  // We replace the outlet <!--app-html--> and also inject the initial state
  const html = template
    .replace(`<!--app-html-->`, appHtml)
    .replace(
      `<!--app-data-->`,
      `<script>window.__INITIAL_DATA__ = ${JSON.stringify(statusData)}</script>`
    );

  // 5. Write to dist/index.html
  const filePath = toAbsolute("dist/index.html");
  fs.writeFileSync(filePath, html);
  console.log("Successfully pre-rendered dist/index.html");
}

prerender();
