import { ExternalLink } from "lucide-react";
import type { Translations } from "../i18n";
import packageJson from "../../package.json";

interface FooterProps {
  textColor?: string;
  t: Translations;
}

export function Footer({ textColor = "#FFFFFF", t }: FooterProps) {
  return (
    <footer className="py-6 px-6 text-center" style={{ color: textColor }}>
      <div className="inline-flex flex-col items-center gap-2">
        <p className="text-sm opacity-60">
          {t.dataProvidedBy}{" "}
          <a
            href="https://www.madrid.es"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-100 transition-opacity inline-flex items-center gap-1"
          >
            Ayuntamiento de Madrid
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <p className="text-xs opacity-40">{t.license}</p>
        <p className="text-xs opacity-30 mt-1">v{packageJson.version}</p>
      </div>
    </footer>
  );
}
