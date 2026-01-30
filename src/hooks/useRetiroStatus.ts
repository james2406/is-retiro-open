import { useState, useEffect, useCallback } from "react";
import type { RetiroStatus, StatusType } from "../types";

interface UseRetiroStatusResult {
  data: RetiroStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refetch: () => Promise<void>;
}

const RETIRO_API_URL =
  "https://sigma.madrid.es/hosted/rest/services/MEDIO_AMBIENTE/ALERTAS_PARQUES/MapServer/0/query";

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const REQUEST_TIMEOUT = 8000;

function getStatusType(code: number): StatusType {
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

function getMockData(code?: number): RetiroStatus {
  const mockCode = code ?? Math.floor(Math.random() * 6) + 1;
  const messages: Record<number, string> = {
    1: "Abierto según horario habitual",
    2: "Incidencias en algunas zonas",
    3: "Alerta amarilla por viento",
    4: "Alerta naranja - Eventos suspendidos",
    5: "Previsión de cierre por tormenta",
    6: "Cerrado por condiciones meteorológicas",
  };

  return {
    status: getStatusType(mockCode),
    code: mockCode as any,
    message: messages[mockCode] || messages[1],
    incidents: mockCode >= 5 ? "14:00 a 20:00" : null,
    observations: mockCode === 2 ? "Obras en la zona del estanque" : null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS[attempt])
      );
    }
  }
  throw new Error("Max retries exceeded");
}

export function useRetiroStatus(initialData: RetiroStatus | null = null): UseRetiroStatusResult {
  const [data, setData] = useState<RetiroStatus | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const fetchStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setError("offline");
      setLoading(false);
      return;
    }

    setIsOffline(false);
    setLoading(true);
    setError(null);

    try {
      // Check for mock mode in URL
      let mockParam: string | null = null;
      let codeParam: string | null = null;

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        mockParam = urlParams.get("mock");
        codeParam = urlParams.get("code");
      }

      if (mockParam === "true" || codeParam) {
        const mockCode = codeParam ? parseInt(codeParam, 10) : undefined;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setData(getMockData(mockCode));
        return;
      }

      const params = new URLSearchParams({
        where: "1=1",
        outFields:
          "ZONA_VERDE,ALERTA_DESCRIPCION,HORARIO_INCIDENCIA,OBSERVACIONES",
        f: "json",
      });

      const response = await fetchWithRetry(`${RETIRO_API_URL}?${params}`);
      const apiData = await response.json();

      const retiroFeature = apiData.features?.find((f: any) =>
        f.attributes.ZONA_VERDE?.toLowerCase().includes("retiro")
      );

      if (!retiroFeature) {
        throw new Error("Retiro park data not found");
      }

      const { ALERTA_DESCRIPCION, HORARIO_INCIDENCIA, OBSERVACIONES } =
        retiroFeature.attributes;
      const alertCode = ALERTA_DESCRIPCION || 1;

      const result: RetiroStatus = {
        status: getStatusType(alertCode),
        code: alertCode as any,
        message: "Estado actual del parque",
        incidents: HORARIO_INCIDENCIA || null,
        observations: OBSERVACIONES || null,
        updated_at: new Date().toISOString(),
      };

      setData(result);
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if we don't have initial data, OR if we want to refresh
    // For hydration, we might want to skip the immediate fetch if we trust the server data
    // But since the status changes, re-fetching immediately is safer to ensure freshness
    fetchStatus();

    const handleOnline = () => {
      setIsOffline(false);
      fetchStatus();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return { data, loading, error, isOffline, refetch: fetchStatus };
}
