export const CONFIG = {
  RETIRO_API_URL:
    "https://sigma.madrid.es/hosted/rest/services/MEDIO_AMBIENTE/ALERTAS_PARQUES/MapServer/0/query",
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff in ms
  REQUEST_TIMEOUT: 8000, // 8 seconds
  TARGET_LAYER_NAME: "ALERTAS CLIMATOLOGICAS PARQUES", // Layer name to verify
};
