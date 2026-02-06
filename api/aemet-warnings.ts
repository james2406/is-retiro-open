import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WarningSeverity } from "../src/types";

/**
 * AEMET Warning response structure parsed from CAP XML
 */
export interface AemetWarning {
  onset?: string;
  expires?: string;
  nivel?: string; // severity level
  fenomeno?: string; // VI (wind), NE (snow), etc.
  zona?: string; // Zone code (e.g., 722802)
}

export interface AemetWarningSignal {
  hasActiveWarning: boolean;
  hasWarningWithin2Hours: boolean;
  hasWarningLaterToday: boolean;
  activeWarningSeverity: WarningSeverity;
  nextWarningOnset: string | null;
  nextWarningSeverity: WarningSeverity;
  fetchedAt: string | null;
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
const REQUEST_TIMEOUT_MS = 8000;
const TAR_BLOCK_SIZE = 512;
const CLOSING_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;
const MADRID_TIMEZONE = "Europe/Madrid";
const WARNING_SEVERITY_RANK: Record<Exclude<WarningSeverity, null>, number> = {
  minor: 1,
  moderate: 2,
  severe: 3,
  extreme: 4,
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getMadridDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: MADRID_TIMEZONE });
}

function normalizeSeverity(value: string | undefined): WarningSeverity {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (
    normalized === "minor" ||
    normalized === "moderate" ||
    normalized === "severe" ||
    normalized === "extreme"
  ) {
    return normalized;
  }
  return null;
}

function pickHighestSeverity(warnings: AemetWarning[]): WarningSeverity {
  let highest: WarningSeverity = null;

  for (const warning of warnings) {
    const current = normalizeSeverity(warning.nivel);
    if (!current) continue;

    if (!highest || WARNING_SEVERITY_RANK[current] > WARNING_SEVERITY_RANK[highest]) {
      highest = current;
    }
  }

  return highest;
}

function emptyWarningSignal(fetchedAt: string | null): AemetWarningSignal {
  return {
    hasActiveWarning: false,
    hasWarningWithin2Hours: false,
    hasWarningLaterToday: false,
    activeWarningSeverity: null,
    nextWarningOnset: null,
    nextWarningSeverity: null,
    fetchedAt,
  };
}

/**
 * Converts relevant warnings into a conservative closure signal model.
 * Active warning > soon warning (>0 and <=2h) > later today warning.
 */
export function buildWarningSignal(
  warnings: AemetWarning[],
  now: Date = new Date()
): Omit<AemetWarningSignal, "fetchedAt"> {
  const relevantWarnings = warnings.filter((warning) => isRelevantWarning(warning));
  const activeWarnings = relevantWarnings.filter((warning) =>
    isWarningActive(warning, now)
  );

  const upcomingWarnings = relevantWarnings
    .map((warning) => {
      if (!warning.onset) return null;
      const onset = parseDate(warning.onset);
      if (!onset || onset <= now) return null;
      return { warning, onset };
    })
    .filter((entry): entry is { warning: AemetWarning; onset: Date } => entry !== null)
    .sort((a, b) => a.onset.getTime() - b.onset.getTime());

  const nextUpcoming = upcomingWarnings[0];
  const nextWarningOnset = nextUpcoming ? nextUpcoming.onset.toISOString() : null;
  const nextWarningSeverity = nextUpcoming
    ? normalizeSeverity(nextUpcoming.warning.nivel)
    : null;

  const hasWarningWithin2Hours = nextUpcoming
    ? nextUpcoming.onset.getTime() - now.getTime() <= CLOSING_SOON_WINDOW_MS
    : false;

  const hasWarningLaterToday = nextUpcoming
    ? !hasWarningWithin2Hours &&
      getMadridDateKey(nextUpcoming.onset) === getMadridDateKey(now)
    : false;

  return {
    hasActiveWarning: activeWarnings.length > 0,
    hasWarningWithin2Hours,
    hasWarningLaterToday,
    activeWarningSeverity: pickHighestSeverity(activeWarnings),
    nextWarningOnset,
    nextWarningSeverity,
  };
}

function buildMockWarningSignal(
  scenario: "none" | "active" | "soon" | "later",
  now: Date
): AemetWarningSignal {
  switch (scenario) {
    case "active":
      return {
        hasActiveWarning: true,
        hasWarningWithin2Hours: false,
        hasWarningLaterToday: false,
        activeWarningSeverity: "moderate",
        nextWarningOnset: null,
        nextWarningSeverity: null,
        fetchedAt: now.toISOString(),
      };
    case "soon":
      return {
        hasActiveWarning: false,
        hasWarningWithin2Hours: true,
        hasWarningLaterToday: false,
        activeWarningSeverity: null,
        nextWarningOnset: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        nextWarningSeverity: "moderate",
        fetchedAt: now.toISOString(),
      };
    case "later":
      return {
        hasActiveWarning: false,
        hasWarningWithin2Hours: false,
        hasWarningLaterToday: true,
        activeWarningSeverity: null,
        nextWarningOnset: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        nextWarningSeverity: "moderate",
        fetchedAt: now.toISOString(),
      };
    case "none":
    default:
      return emptyWarningSignal(now.toISOString());
  }
}

/**
 * Simple XML text extraction helper
 */
function extractXmlTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extracts <valueName>/<value> pairs from nested CAP blocks such as
 * <eventCode> and <geocode>.
 */
function extractNamedValues(
  xml: string,
  tag: "eventCode" | "geocode"
): Array<{ valueName?: string; value: string }> {
  const pairs: Array<{ valueName?: string; value: string }> = [];
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;

  match = regex.exec(xml);
  while (match) {
    const block = match[1];
    const value = extractXmlTag(block, "value");
    if (value) {
      pairs.push({
        valueName: extractXmlTag(block, "valueName")?.toLowerCase(),
        value,
      });
    }
    match = regex.exec(xml);
  }

  return pairs;
}

function extractFenomeno(infoBlock: string): string | undefined {
  const eventCodes = extractNamedValues(infoBlock, "eventCode");
  if (eventCodes.length === 0) return undefined;

  const phenomenonCode = eventCodes.find((entry) =>
    entry.valueName?.includes("fen")
  );

  return phenomenonCode?.value ?? eventCodes[0].value;
}

function extractZona(infoBlock: string): string | undefined {
  const geocodes = extractNamedValues(infoBlock, "geocode");
  if (geocodes.length === 0) return undefined;

  const ugcCode = geocodes.find(
    (entry) => entry.valueName?.includes("ugc") || entry.valueName?.includes("zona")
  );

  return ugcCode?.value ?? geocodes[0].value;
}

/**
 * Parse CAP XML format into our warning structure.
 * CAP = Common Alerting Protocol used by AEMET.
 */
export function parseCapXml(xml: string): AemetWarning[] {
  const warnings: AemetWarning[] = [];
  const infoRegex = /<info\b[^>]*>([\s\S]*?)<\/info>/gi;
  let match: RegExpExecArray | null;

  match = infoRegex.exec(xml);
  while (match) {
    const infoBlock = match[1];
    const onset = extractXmlTag(infoBlock, "onset");
    const expires = extractXmlTag(infoBlock, "expires");
    const severity = extractXmlTag(infoBlock, "severity");
    const fenomeno = extractFenomeno(infoBlock);
    const zona = extractZona(infoBlock);

    warnings.push({
      fenomeno,
      zona,
      onset,
      expires,
      nivel: severity?.toLowerCase(),
    });

    match = infoRegex.exec(xml);
  }

  return warnings;
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Checks if a warning is currently active based on onset/expires times
 */
export function isWarningActive(warning: AemetWarning, now: Date = new Date()): boolean {
  if (warning.onset) {
    const onset = parseDate(warning.onset);
    if (!onset || onset > now) return false;
  }

  if (warning.expires) {
    const expires = parseDate(warning.expires);
    if (!expires || expires <= now) return false;
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
export function isRelevantWarning(warning: AemetWarning): boolean {
  if (!warning.fenomeno) return false;

  // Check zone - must be Metropolitana y Henares (where Retiro Park is)
  // 722801 = Sierra de Madrid (mountains - not relevant)
  // 722802 = Metropolitana y Henares (RETIRO IS HERE)
  // 722803 = Sur, Vegas y Oeste (southern suburbs - not relevant)
  if (!warning.zona || !warning.zona.includes(MADRID_RETIRO_ZONE)) {
    return false;
  }

  // Extract the warning type code (before the semicolon)
  const warningCode = warning.fenomeno.split(";")[0]?.trim().toUpperCase();
  if (!warningCode) return false;

  // Check if it's wind (VI) or snow (NE)
  return RELEVANT_WARNING_PREFIXES.includes(warningCode);
}

export function extractXmlDocumentsFromText(rawText: string): string[] {
  const xmlMatches = rawText.match(/<alert\b[\s\S]*?<\/alert>/gi) || [];
  return xmlMatches.map((xml) => xml.trim()).filter(Boolean);
}

function readTarAscii(field: Uint8Array): string {
  let result = "";

  for (const byte of field) {
    if (byte === 0) break;
    result += String.fromCharCode(byte);
  }

  return result;
}

function parseTarFileSize(header: Uint8Array): number | null {
  const sizeField = header.subarray(124, 136);
  const octalSize = readTarAscii(sizeField).trim().replace(/\0/g, "");
  if (!octalSize) return 0;

  const parsed = Number.parseInt(octalSize, 8);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * Extract CAP XML documents from a TAR archive payload.
 */
export function extractXmlDocumentsFromTarBuffer(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < TAR_BLOCK_SIZE) return [];

  const xmlDocs: string[] = [];
  const decoder = new TextDecoder("utf-8");
  let offset = 0;

  while (offset + TAR_BLOCK_SIZE <= bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK_SIZE);
    const isEndBlock = header.every((byte) => byte === 0);
    if (isEndBlock) break;

    const fileSize = parseTarFileSize(header);
    if (fileSize === null) return [];

    const dataStart = offset + TAR_BLOCK_SIZE;
    const paddedSize = Math.ceil(fileSize / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    const nextOffset = dataStart + paddedSize;

    if (nextOffset > bytes.length) return [];

    if (fileSize > 0) {
      const fileBytes = bytes.subarray(dataStart, dataStart + fileSize);
      const fileText = decoder.decode(fileBytes);
      const matches = extractXmlDocumentsFromText(fileText);
      if (matches.length > 0) {
        xmlDocs.push(...matches);
      }
    }

    offset = nextOffset;
  }

  return xmlDocs;
}

export function extractXmlDocuments(rawBuffer: ArrayBuffer, contentType: string): string[] {
  const tarXmlDocs = extractXmlDocumentsFromTarBuffer(rawBuffer);
  if (tarXmlDocs.length > 0) {
    return tarXmlDocs;
  }

  const rawText = new TextDecoder("utf-8").decode(new Uint8Array(rawBuffer));
  const xmlMatches = extractXmlDocumentsFromText(rawText);
  if (xmlMatches.length > 0) {
    return xmlMatches;
  }

  if (rawText.trim().length === 0) {
    return [];
  }

  throw new Error(
    `No CAP XML alerts found in AEMET datos response (content-type: ${contentType}, length: ${rawText.length})`
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Serverless function handler for AEMET weather warnings proxy.
 * Fetches weather warnings for Madrid and returns a predictive signal object.
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
  const mock = firstQueryValue(req.query.mock);
  const warning = firstQueryValue(req.query.warning);
  const warningScenario = firstQueryValue(req.query.warningScenario);
  if (mock === "true") {
    const now = new Date();
    let scenario: "none" | "active" | "soon" | "later" = "none";

    if (
      warningScenario === "none" ||
      warningScenario === "active" ||
      warningScenario === "soon" ||
      warningScenario === "later"
    ) {
      scenario = warningScenario;
    } else if (warning === "true") {
      // Backward compatibility with old mock parameter.
      scenario = "active";
    }

    return res.status(200).json(buildMockWarningSignal(scenario, now));
  }

  const apiKey = process.env.AEMET_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: "AEMET API key not configured" });
  }

  try {
    // Step 1: Get the datos URL from AEMET API
    const url = `${AEMET_API_BASE}/avisos_cap/ultimoelaborado/area/${MADRID_AREA_CODE}`;

    const initialResponse = await fetchWithTimeout(url, {
      headers: { api_key: apiKey },
    });

    if (!initialResponse.ok) {
      throw new Error(`AEMET API responded with status ${initialResponse.status}`);
    }

    const initialData: AemetInitialResponse = await initialResponse.json();

    if (initialData.estado !== 200 || !initialData.datos) {
      throw new Error(`AEMET API error: ${initialData.descripcion || "Unknown error"}`);
    }

    // Step 2: Fetch the datos URL to get actual warning data (TAR of CAP XML files)
    const datosResponse = await fetchWithTimeout(initialData.datos);

    if (!datosResponse.ok) {
      throw new Error(`AEMET datos URL responded with status ${datosResponse.status}`);
    }

    // Extract CAP XML from TAR payload or plain XML response.
    const contentType = datosResponse.headers.get("content-type") ?? "";
    const rawBuffer = await datosResponse.arrayBuffer();
    const xmlDocuments = extractXmlDocuments(rawBuffer, contentType);

    let warnings: AemetWarning[] = [];
    for (const xmlDoc of xmlDocuments) {
      const parsed = parseCapXml(xmlDoc);
      warnings.push(...parsed);
    }

    const now = new Date();
    const signal = buildWarningSignal(warnings, now);

    // Cache for 5 minutes, serve stale for 10 more while revalidating
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    return res
      .status(200)
      .json({ ...signal, fetchedAt: now.toISOString() } satisfies AemetWarningSignal);
  } catch (error) {
    console.error("[AEMET] Error fetching warnings:", error);

    // Fail-open: weather warning is a secondary signal and should not break UX.
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(emptyWarningSignal(new Date().toISOString()));
  }
}
