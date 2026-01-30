import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// API mock plugin for local development
function apiMockPlugin(): Plugin {
  return {
    name: "api-mock",
    configureServer(server) {
      server.middlewares.use("/api/status", async (req, res) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const mock = url.searchParams.get("mock");
        const codeParam = url.searchParams.get("code");

        // Return mock data for development
        const mockCode = codeParam
          ? parseInt(codeParam, 10)
          : mock === "true"
          ? Math.floor(Math.random() * 6) + 1
          : null;

        if (mockCode !== null) {
          const messages: Record<number, string> = {
            1: "Abierto según horario habitual",
            2: "Incidencias en algunas zonas",
            3: "Alerta amarilla por viento",
            4: "Alerta naranja - Eventos suspendidos",
            5: "Previsión de cierre por tormenta",
            6: "Cerrado por condiciones meteorológicas",
          };
          const getStatusType = (code: number) => {
            if (code <= 3) return "open";
            if (code === 4) return "restricted";
            if (code === 5) return "closing";
            return "closed";
          };
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              status: getStatusType(mockCode),
              code: mockCode,
              message: messages[mockCode] || messages[1],
              incidents: mockCode >= 5 ? "14:00 a 20:00" : null,
              observations:
                mockCode === 2 ? "Obras en la zona del estanque" : null,
              updated_at: new Date().toISOString(),
            })
          );
          return;
        }

        // Fetch from real API
        try {
          const params = new URLSearchParams({
            where: "1=1",
            outFields:
              "ZONA_VERDE,ALERTA_DESCRIPCION,HORARIO_INCIDENCIA,OBSERVACIONES",
            f: "json",
          });
          const apiUrl = `https://sigma.madrid.es/hosted/rest/services/MEDIO_AMBIENTE/ALERTAS_PARQUES/MapServer/0/query?${params}`;
          const response = await fetch(apiUrl);
          const data = await response.json();

          const retiroFeature = data.features?.find(
            (f: { attributes: { ZONA_VERDE?: string } }) =>
              f.attributes.ZONA_VERDE?.toLowerCase().includes("retiro")
          );

          if (!retiroFeature) {
            throw new Error("Retiro park data not found");
          }

          const {
            ZONA_VERDE,
            ALERTA_DESCRIPCION,
            HORARIO_INCIDENCIA,
            OBSERVACIONES,
          } = retiroFeature.attributes;
          const alertCode = ALERTA_DESCRIPCION || 1;
          const getStatusType = (code: number) => {
            if (code <= 3) return "open";
            if (code === 4) return "restricted";
            if (code === 5) return "closing";
            return "closed";
          };

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              status: getStatusType(alertCode),
              code: alertCode,
              message: "Estado actual del parque",
              incidents: HORARIO_INCIDENCIA || null,
              observations: OBSERVACIONES || null,
              updated_at: new Date().toISOString(),
            })
          );
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: "Failed to fetch", message: String(error) })
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiMockPlugin()],
});
