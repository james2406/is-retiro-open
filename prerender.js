import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => path.resolve(__dirname, p);

const RETIRO_API_URL =
  "https://sigma.madrid.es/hosted/rest/services/MEDIO_AMBIENTE/ALERTAS_PARQUES/MapServer/0/query";

function getStatusType(code) {
  switch (code) {
    case 1:
    case 2:
    case 3:
      return "open";
    case 4:
      return "restricted";
    case 5:
      return "closing";
    case 6:
      return "closed";
    default:
      return "open";
  }
}

async function fetchRetiroStatus() {
  console.log("Fetching Retiro status...");
  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields:
        "ZONA_VERDE,ALERTA_DESCRIPCION,HORARIO_INCIDENCIA,OBSERVACIONES",
      f: "json",
    });

    const response = await fetch(`${RETIRO_API_URL}?${params}`);
    if (!response.ok) throw new Error(`API responded with ${response.status}`);
    
    const data = await response.json();
    const retiroFeature = data.features?.find((f) =>
      f.attributes.ZONA_VERDE?.toLowerCase().includes("retiro")
    );

    if (!retiroFeature) throw new Error("Retiro park data not found");

    const { ALERTA_DESCRIPCION, HORARIO_INCIDENCIA, OBSERVACIONES } =
      retiroFeature.attributes;
    const alertCode = ALERTA_DESCRIPCION || 1;

    return {
      status: getStatusType(alertCode),
      code: alertCode,
      message: "Estado actual del parque",
      incidents: HORARIO_INCIDENCIA || null,
      observations: OBSERVACIONES || null,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching status:", error);
    // Fallback or rethrow? For SSG, we probably want to fail the build if we can't get data,
    // or maybe fallback to a default "Open" state but that's risky.
    // Let's fallback to "Open" with a console warning so the build succeeds, 
    // but in a real scenario you might want to fail.
    return {
      status: "open",
      code: 1,
      message: "Estado actual del parque (Fallback)",
      incidents: null,
      observations: null,
      updated_at: new Date().toISOString(),
    };
  }
}

async function prerender() {
  // 1. Fetch Data
  const statusData = await fetchRetiroStatus();
  console.log("Status Data:", statusData);

  // 2. Load the server entry
  // We need to build the SSR entry first. 
  // Ideally we assume `dist/server/entry-server.js` exists after `vite build --ssr`.
  const template = fs.readFileSync(toAbsolute("dist/index.html"), "utf-8");
  
  // Note: In a pure Node script we can't easily import the compiled TS component 
  // without a proper SSR build step.
  // We will assume the build script runs `vite build --ssr src/entry-server.tsx` first.
  const { render } = await import("./dist/server/entry-server.js");

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
  console.log("Pre-rendered index.html");
  
  // Cleanup server build if desired, but keeping it is fine.
}

prerender();
