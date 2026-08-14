import assert from "node:assert/strict";
import test from "node:test";
import { fetchRetiroStatus } from "./madridApi";

test("Madrid alert code 7 is treated as closed", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response(JSON.stringify({
    name: "ALERTAS CLIMATOLÓGICAS PARQUES",
    features: [{
      attributes: {
        ZONA_VERDE: "Jardines del Buen Retiro",
        ALERTA_DESCRIPCION: 7,
        FECHA_INCIDENCIA: "14/08/2026",
        HORARIO_INCIDENCIA: null,
        OBSERVACIONES: null,
        PREVISION_APERTURA: null,
      },
    }],
  }));

  const status = await fetchRetiroStatus();

  assert.deepEqual(
    { code: status.code, status: status.status },
    { code: 6, status: "closed" },
  );
});
