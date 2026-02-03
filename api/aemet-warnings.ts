import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * AEMET Warning response structure from the datos URL
 * Note: Actual structure should be verified with real API key
 */
interface AemetWarning {
  onset?: string;
  expires?: string;
  nivel?: string; // amarillo, naranja, rojo
  fenomeno?: string; // VI (wind), NV (snow), etc.
  zona?: string; // Zone code
}

interface AemetInitialResponse {
  descripcion?: string;
  estado?: number;
  datos?: string;
  metadatos?: string;
}

const AEMET_API_BASE = "https://opendata.aemet.es/opendata/api";
const MADRID_AREA_CODE = "61";
const MADRID_METRO_ZONE = "722802";
const RELEVANT_WARNING_TYPES = ["VI", "NV"]; // Wind and Snow

/**
 * Checks if a warning is currently active based on onset/expires times
 */
function isWarningActive(warning: AemetWarning): boolean {
  const now = new Date();
  
  if (warning.onset) {
    const onset = new Date(warning.onset);
    if (onset > now) return false; // Not yet started
  }
  
  if (warning.expires) {
    const expires = new Date(warning.expires);
    if (expires < now) return false; // Already expired
  }
  
  return true;
}

/**
 * Checks if a warning is relevant (wind or snow for Madrid Metro zone)
 */
function isRelevantWarning(warning: AemetWarning): boolean {
  // Check zone - must be Madrid Metropolitana
  if (warning.zona && !warning.zona.includes(MADRID_METRO_ZONE)) {
    return false;
  }
  
  // Check warning type - must be wind (VI) or snow (NV)
  if (warning.fenomeno && !RELEVANT_WARNING_TYPES.includes(warning.fenomeno)) {
    return false;
  }
  
  return true;
}

/**
 * Serverless function handler for AEMET weather warnings proxy.
 * Fetches weather warnings for Madrid and returns whether there's an active warning.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle mock mode for testing
  const { mock, warning } = req.query;
  if (mock === "true") {
    const hasWarning = warning === "true";
    return res.status(200).json({ hasActiveWarning: hasWarning });
  }

  const apiKey = process.env.AEMET_API_KEY;
  
  if (!apiKey) {
    console.warn("AEMET_API_KEY not configured, returning no warning");
    // Set cache headers even for missing config
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ hasActiveWarning: false });
  }

  try {
    // Step 1: Request warnings for area 61 (Madrid)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const initialResponse = await fetch(
      `${AEMET_API_BASE}/avisos_cap/ultimoelaborado/area/${MADRID_AREA_CODE}`,
      {
        headers: { api_key: apiKey },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!initialResponse.ok) {
      throw new Error(`AEMET API responded with status ${initialResponse.status}`);
    }

    const initialData: AemetInitialResponse = await initialResponse.json();

    if (initialData.estado !== 200 || !initialData.datos) {
      throw new Error(`AEMET API error: ${initialData.descripcion || "Unknown error"}`);
    }

    // Step 2: Fetch the datos URL to get actual warning data
    const datosController = new AbortController();
    const datosTimeout = setTimeout(() => datosController.abort(), 8000);

    const datosResponse = await fetch(initialData.datos, {
      signal: datosController.signal,
    });
    clearTimeout(datosTimeout);

    if (!datosResponse.ok) {
      throw new Error(`AEMET datos URL responded with status ${datosResponse.status}`);
    }

    const warnings: AemetWarning[] = await datosResponse.json();

    // Step 3: Filter for relevant, active warnings
    const activeWarnings = warnings.filter(
      (w) => isRelevantWarning(w) && isWarningActive(w)
    );

    const hasActiveWarning = activeWarnings.length > 0;

    // Set cache headers: 15 minutes at edge, serve stale for 30 more while revalidating
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    
    return res.status(200).json({ hasActiveWarning });
  } catch (error) {
    console.error("Error fetching AEMET warnings:", error);
    
    // Fail open: return no warning on error, so core functionality continues
    // Set cache headers even on error to prevent hammering AEMET
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ hasActiveWarning: false });
  }
}
