import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get("code");
    const code = codeParam ? parseInt(codeParam, 10) : 1;

    // Define themes (copied from src/types.ts to avoid import issues)
    const STATUS_THEMES: Record<number, { bgColor: string; textColor: string; label: string; subLabel: string }> = {
      1: { 
        bgColor: "#2ECC71", 
        textColor: "#FFFFFF",
        label: "SÍ, ABIERTO",
        subLabel: "Horario habitual"
      },
      2: { 
        bgColor: "#3498DB", 
        textColor: "#FFFFFF",
        label: "SÍ, CON INCIDENCIAS",
        subLabel: "Consulta zonas afectadas"
      },
      3: { 
        bgColor: "#F1C40F", 
        textColor: "#000000",
        label: "PRECAUCIÓN",
        subLabel: "Zonas restringidas"
      },
      4: { 
        bgColor: "#E67E22", 
        textColor: "#FFFFFF",
        label: "RESTRINGIDO",
        subLabel: "Eventos suspendidos"
      },
      5: { 
        bgColor: "#C0392B", 
        textColor: "#FFFFFF",
        label: "CERRADO",
        subLabel: "Alerta meteorológica"
      },
      6: { 
        bgColor: "#C0392B", 
        textColor: "#FFFFFF",
        label: "CERRADO",
        subLabel: "Alerta meteorológica"
      },
    };

    const theme = STATUS_THEMES[code] || STATUS_THEMES[1];

    // Simple Tree Icon SVG path
    const TreeIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style={{ marginRight: 16 }}
      >
        <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 5.3-2.1" />
        <path d="M7 16v6" />
        <path d="M13 19v3" />
        <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .9-1.7l-3.5-5a1.08 1.08 0 0 0-1.8 0l-3.5 5a1 1 0 0 0 .9 1.7L9.2 9a3 3 0 0 0 4 10Z" />
      </svg>
    );

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.bgColor,
            color: theme.textColor,
            fontFamily: '"Inter", sans-serif',
            padding: 40,
            textAlign: "center",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              opacity: 0.9,
              marginBottom: 40,
            }}
          >
            {TreeIcon}
            <span>¿Está abierto el Retiro?</span>
          </div>

          {/* Main Status */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 20,
              textTransform: "uppercase",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {theme.label}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              opacity: 0.8,
            }}
          >
            {theme.subLabel}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
