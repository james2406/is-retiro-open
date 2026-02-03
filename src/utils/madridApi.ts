import { CONFIG } from "../config";
import type { RetiroStatus, StatusType, StatusCode } from "../types";

// Raw response interfaces from Madrid API
interface MadridAPIFeature {
  attributes: {
    ZONA_VERDE: string;
    ALERTA_DESCRIPCION: number;
    FECHA_INCIDENCIA: string | null;
    HORARIO_INCIDENCIA: string | null;
    OBSERVACIONES: string | null;
  };
}

interface MadridAPIResponse {
  name?: string;
  features?: MadridAPIFeature[];
}

/**
 * Maps the Madrid API alert code to a StatusType.
 *
 * Status Mapping Update (Jan 2026):
 * Empirical evidence shows Code 5 ("Previsión Roja") results in actual park closure (gates locked).
 * While the API distinguishes between 5 (Standard Red Alert) and 6 (Emergency/Weather),
 * both result in the park being closed to the public.
 */
function getStatusType(code: number): StatusType {
  switch (code) {
    case 1:
    case 2:
    case 3:
      return "open";
    case 4:
      return "restricted";
    case 5: // Standard Red Alert (Closure)
    case 6: // Emergency/Weather Closure
      return "closed";
    default:
      return "open";
  }
}

/**
 * Fetches a URL with retry logic and exponential backoff.
 * @param url The URL to fetch.
 * @param retries Number of retry attempts (default: 3).
 * @returns The Response object if successful.
 * @throws Error if all retries fail.
 */
export async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.RETRY_DELAYS[attempt])
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Fetches the current status of El Retiro Park from the Madrid API.
 * Parses the response and maps it to our internal data model.
 * @returns Promise resolving to the RetiroStatus object.
 */
export async function fetchRetiroStatus(): Promise<RetiroStatus> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "ZONA_VERDE,ALERTA_DESCRIPCION,FECHA_INCIDENCIA,HORARIO_INCIDENCIA,OBSERVACIONES",
    f: "json",
  });

  const response = await fetchWithRetry(`${CONFIG.RETIRO_API_URL}?${params}`);
  const apiData: MadridAPIResponse = await response.json();

  // Validate Layer Name (Robustness Check)
  // Note: We check if it includes "ALERTAS" to be safe, as exact names might change slightly
  if (apiData.name && !apiData.name.toUpperCase().includes("ALERTAS")) {
    console.warn(`Layer name mismatch: Expected similar to '${CONFIG.TARGET_LAYER_NAME}', got '${apiData.name}'`);
  }

  const retiroFeature = apiData.features?.find((f) =>
    f.attributes.ZONA_VERDE?.toLowerCase().includes("retiro")
  );

  if (!retiroFeature) {
    throw new Error("Retiro park data not found in API response");
  }

  const { ALERTA_DESCRIPCION, FECHA_INCIDENCIA, HORARIO_INCIDENCIA, OBSERVACIONES } =
    retiroFeature.attributes;
  const alertCode = ALERTA_DESCRIPCION || 1;

  return {
    status: getStatusType(alertCode),
    code: alertCode as StatusCode,
    message: "Estado actual del parque",
    incidents: HORARIO_INCIDENCIA || null,
    observations: OBSERVACIONES || null,
    // Store as UTC ISO string; display layer converts to Europe/Madrid timezone
    updated_at: new Date().toISOString(),
    // Date when Madrid last updated the alert (format: "DD/MM/YYYY")
    source_updated_at: FECHA_INCIDENCIA || null,
  };
}

/**
 * Generates mock data for testing or when the API is unreachable.
 * @param code Optional specific alert code to force.
 * @returns Mocked RetiroStatus object.
 */
export function getMockData(code?: number): RetiroStatus {
  let mockCode = code ?? Math.floor(Math.random() * 6) + 1;
  
  // Validate and clamp mockCode to be within valid range 1-6
  if (isNaN(mockCode) || mockCode < 1 || mockCode > 6) {
    mockCode = 1;
  }
  
  const messages: Record<number, string> = {
    1: "Abierto según horario habitual",
    2: "Incidencias en algunas zonas",
    3: "Alerta amarilla por viento",
    4: "Alerta naranja - Eventos suspendidos",
    5: "Cerrado por condiciones meteorológicas",
    6: "Cerrado por condiciones meteorológicas",
  };

  // Format today's date as DD/MM/YYYY for mock data
  const today = new Date();
  const mockSourceDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return {
    status: getStatusType(mockCode),
    code: mockCode as StatusCode,
    message: messages[mockCode] || messages[1],
    incidents: mockCode >= 5 ? "14:00 a 20:00" : null,
    observations: mockCode === 2 ? "Obras en la zona del estanque" : null,
    updated_at: new Date().toISOString(),
    source_updated_at: mockSourceDate,
  };
}
