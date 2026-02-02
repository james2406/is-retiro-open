/**
 * Generate Open Graph images for all status codes and locales.
 * Run with: npx tsx scripts/generate-og-images.ts
 */
import { createCanvas, registerFont } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public/og");

// Image dimensions (Open Graph standard)
const WIDTH = 1200;
const HEIGHT = 630;

// Status themes from types.ts
const STATUS_THEMES: Record<number, { bgColor: string; textColor: string }> = {
  1: { bgColor: "#2ECC71", textColor: "#FFFFFF" },
  2: { bgColor: "#3498DB", textColor: "#FFFFFF" },
  3: { bgColor: "#F1C40F", textColor: "#000000" },
  4: { bgColor: "#E67E22", textColor: "#FFFFFF" },
  5: { bgColor: "#C0392B", textColor: "#FFFFFF" },
  6: { bgColor: "#C0392B", textColor: "#FFFFFF" },
};

// Titles for each locale
const TITLES: Record<string, string> = {
  es: "¿Está abierto el Retiro?",
  en: "Is Retiro Open?",
};

// Status text for each code and locale (matches i18n.ts status.big values)
const STATUS_TEXT: Record<number, Record<string, string>> = {
  1: { es: "ABIERTO", en: "OPEN" },
  2: { es: "ABIERTO*", en: "OPEN*" },
  3: { es: "ABIERTO*", en: "OPEN*" },
  4: { es: "ABIERTO*", en: "OPEN*" },
  5: { es: "CERRADO", en: "CLOSED" },
  6: { es: "CERRADO", en: "CLOSED" },
};

function generateImage(
  locale: string,
  statusCode: number
): Buffer {
  const theme = STATUS_THEMES[statusCode];
  const title = TITLES[locale];
  const statusText = STATUS_TEXT[statusCode][locale];

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Fill background
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Set text properties
  ctx.fillStyle = theme.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw title (smaller text at top)
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(title, WIDTH / 2, HEIGHT * 0.35);

  // Draw status text (large text in center)
  ctx.font = "bold 180px sans-serif";
  ctx.fillText(statusText, WIDTH / 2, HEIGHT * 0.65);

  return canvas.toBuffer("image/png");
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const locales = ["es", "en"];
  const statusCodes = [1, 2, 3, 4, 5, 6];

  console.log("Generating OG images...");

  for (const locale of locales) {
    for (const code of statusCodes) {
      const filename = `${locale}-${code}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);

      const buffer = generateImage(locale, code);
      fs.writeFileSync(filepath, buffer);

      console.log(`  Created: ${filename}`);
    }
  }

  console.log(`\nDone! Generated ${locales.length * statusCodes.length} images in ${OUTPUT_DIR}`);
}

main().catch(console.error);
