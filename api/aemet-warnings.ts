import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * AEMET Warning response structure parsed from CAP XML
 */
interface AemetWarning {
  onset?: string;
  expires?: string;
  nivel?: string; // severity level
  fenomeno?: string; // VI (wind), NE (snow), etc.
  zona?: string; // Zone code (e.g., 722802)
}

interface AemetInitialResponse {
  descripcion?: string;
  estado?: number;
  datos?: string;
  metadatos?: string;
}

const AEMET_API_BASE = "https://opendata.aemet.es/opendata/api";
// Area 72 = Comunidad de Madrid
const MADRID_AREA_CODE = "72";
// Wind (VI;Vientos) and Snow (NE;Nevadas) - these are the codes that trigger park closures
const RELEVANT_WARNING_PREFIXES = ["VI", "NE"];
// Zone code for Madrid metropolitan area where Retiro Park is located
// Madrid zones: 722801=Sierra, 722802=Metropolitana y Henares, 722803=Sur/Vegas/Oeste
// Retiro Park is in the "Metropolitana y Henares" zone
const MADRID_RETIRO_ZONE = "722802";

/**
 * Simple XML text extraction helper
 */
function extractXmlTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Parse CAP XML format into our warning structure
 * CAP = Common Alerting Protocol used by AEMET
 */
function parseCapXml(xml: string): AemetWarning[] {
  const warnings: AemetWarning[] = [];
  
  // Split by <info> blocks - each contains one warning
  const infoBlocks = xml.split(/<info>/i).slice(1);
  
  for (const block of infoBlocks) {
    // Extract event type code from eventCode
    const eventCodeMatch = block.match(/<eventCode>[\s\S]*?<value>([^<]+)<\/value>[\s\S]*?<\/eventCode>/i);
    const fenomeno = eventCodeMatch ? eventCodeMatch[1].trim() : undefined;
    
    // Extract zone/geocode
    const geocodeMatch = block.match(/<geocode>[\s\S]*?<value>([^<]+)<\/value>[\s\S]*?<\/geocode>/i);
    const zona = geocodeMatch ? geocodeMatch[1].trim() : undefined;
    
    // Extract timing
    const onset = extractXmlTag(block, 'onset');
    const expires = extractXmlTag(block, 'expires');
    
    // Extract severity/level
    const severity = extractXmlTag(block, 'severity');
    
    warnings.push({
      fenomeno,
      zona,
      onset,
      expires,
      nivel: severity?.toLowerCase(),
    });
  }
  
  return warnings;
}

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
 * Checks if a warning is relevant (wind or snow for Retiro Park area)
 * 
 * We filter by:
 * 1. Zone - must be "Metropolitana y Henares" (722802) where Retiro Park is located
 *    Sierra (722801) and Sur/Vegas/Oeste (722803) warnings are NOT relevant for Retiro
 * 2. Warning type - must be wind (VI) or snow (NE)
 * 
 * The fenomeno field format is "CODE;Description" e.g. "VI;Vientos", "NE;Nevadas"
 */
function isRelevantWarning(warning: AemetWarning): boolean {
  if (!warning.fenomeno) return false;
  
  // Check zone - must be Metropolitana y Henares (where Retiro Park is)
  // 722801 = Sierra de Madrid (mountains - not relevant)
  // 722802 = Metropolitana y Henares (RETIRO IS HERE)
  // 722803 = Sur, Vegas y Oeste (southern suburbs - not relevant)
  if (warning.zona !== MADRID_RETIRO_ZONE) {
    return false;
  }
  
  // Extract the warning type code (before the semicolon)
  const warningCode = warning.fenomeno.split(";")[0];
  
  // Check if it's wind (VI) or snow (NE)
  return RELEVANT_WARNING_PREFIXES.includes(warningCode);
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
    // Fail gracefully if API key not configured
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ hasActiveWarning: false });
  }

  try {
    // Step 1: Get the datos URL from AEMET API
    const url = `${AEMET_API_BASE}/avisos_cap/ultimoelaborado/area/${MADRID_AREA_CODE}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const initialResponse = await fetch(url, {
      headers: { api_key: apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!initialResponse.ok) {
      throw new Error(`AEMET API responded with status ${initialResponse.status}`);
    }

    const initialData: AemetInitialResponse = await initialResponse.json();

    if (initialData.estado !== 200 || !initialData.datos) {
      throw new Error(`AEMET API error: ${initialData.descripcion || "Unknown error"}`);
    }

    // Step 2: Fetch the datos URL to get actual warning data (TAR of CAP XML files)
    const datosController = new AbortController();
    const datosTimeout = setTimeout(() => datosController.abort(), 8000);

    const datosResponse = await fetch(initialData.datos, {
      signal: datosController.signal,
    });
    clearTimeout(datosTimeout);

    if (!datosResponse.ok) {
      throw new Error(`AEMET datos URL responded with status ${datosResponse.status}`);
    }

    // The response is a TAR archive containing CAP XML files
    const rawText = await datosResponse.text();
    
    // Extract XML documents from the tar stream
    const xmlMatches = rawText.match(/<\?xml[\s\S]*?<\/alert>/gi) || [];
    
    let warnings: AemetWarning[] = [];
    for (const xmlDoc of xmlMatches) {
      const parsed = parseCapXml(xmlDoc);
      warnings.push(...parsed);
    }

    // Filter for relevant (wind/snow in Retiro zone) and currently active warnings
    const activeWarnings = warnings.filter((w) => {
      return isRelevantWarning(w) && isWarningActive(w);
    });

    const hasActiveWarning = activeWarnings.length > 0;

    // Cache for 15 minutes, serve stale for 30 more while revalidating
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    
    return res.status(200).json({ hasActiveWarning });
  } catch (error) {
    console.error("[AEMET] Error fetching warnings:", error);
    
    // Fail open: return no warning on error, so core functionality continues
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ hasActiveWarning: false });
  }
}
