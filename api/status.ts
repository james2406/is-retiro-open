import type { VercelRequest, VercelResponse } from "@vercel/node";

interface MadridAPIFeature {
  attributes: {
    ZONA_VERDE: string;
    ALERTA_DESCRIPCION: number;
    HORARIO_INCIDENCIA: string | null;
    OBSERVACIONES: string | null;
  };
}

interface MadridAPIResponse {
  name?: string;
  features?: MadridAPIFeature[];
}

const RETIRO_API_URL =
  "https://sigma.madrid.es/hosted/rest/services/MEDIO_AMBIENTE/ALERTAS_PARQUES/MapServer/0/query";

/**
 * Maps the Madrid API alert code to a simplified status string.
 *
 * Status Mapping Update (Jan 2026):
 * Empirical evidence shows Code 5 ("Previsión Roja") results in actual park closure (gates locked).
 * While the API distinguishes between 5 (Standard Red Alert) and 6 (Emergency/Weather),
 * both result in the park being closed to the public.
 */
function getStatusType(code: number): "open" | "restricted" | "closed" {
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
 * Generates mock data for testing purposes.
 * @param code Optional specific alert code to simulate.
 * @returns Mocked RetiroStatus object.
 */
function getMockData(code?: number) {
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

  return {
    status: getStatusType(mockCode),
    code: mockCode,
    message: messages[mockCode] || messages[1],
    incidents: mockCode >= 5 ? "14:00 a 20:00" : null,
    observations: mockCode === 2 ? "Obras en la zona del estanque" : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Serverless function handler for the Retiro status API.
 * Acts as a proxy to the Madrid API with caching and error handling.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle mock mode
  const { mock, code } = req.query;
  if (mock === "true" || code) {
    const mockCode = code ? parseInt(code as string, 10) : undefined;
    return res.status(200).json(getMockData(mockCode));
  }

  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields:
        "ZONA_VERDE,ALERTA_DESCRIPCION,HORARIO_INCIDENCIA,OBSERVACIONES",
      f: "json",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${RETIRO_API_URL}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data: MadridAPIResponse = await response.json();

    // Verify layer name for robustness
    if (data.name && !data.name.includes("ALERTAS")) {
      console.warn("Layer name mismatch:", data.name);
    }

    const retiroFeature = data.features?.find((f) =>
      f.attributes.ZONA_VERDE?.toLowerCase().includes("retiro")
    );

    if (!retiroFeature) {
      throw new Error("Retiro park data not found");
    }

    const { ALERTA_DESCRIPCION, HORARIO_INCIDENCIA, OBSERVACIONES } =
      retiroFeature.attributes;
    const alertCode = ALERTA_DESCRIPCION || 1;

    const result = {
      status: getStatusType(alertCode),
      code: alertCode,
      message: `Estado actual del parque`,
      incidents: HORARIO_INCIDENCIA || null,
      observations: OBSERVACIONES || null,
      updated_at: new Date().toISOString(),
    };

    // Set cache headers
    // Cache for 5 minutes at edge, serve stale for 10 more while revalidating
    // This keeps costs well within Vercel's free tier (~8,640 calls/month max)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching Retiro status:", error);
    return res.status(500).json({
      error: "Failed to fetch park status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
