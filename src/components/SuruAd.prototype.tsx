// PROTOTYPE, throwaway. Question: where should the Suru Café ad (design 2A) sit
// on the page? Three placements on the real home page, switchable via ?variant=A|B|C.
//
// SEO guards used in every variant:
// - data-nosnippet sits on a <div> inside the <aside>. Google only honours it on
//   div/span/section, so the handoff's <aside data-nosnippet> would be ignored.
// - The attribute is in the server-rendered HTML from the start, never added by JS.
// - The link uses rel="sponsored noopener".
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "../i18n";
import "./SuruAd.prototype.css";

export const SURU_AD_HREF = "https://app.granops.com/s/cggyuk";
const ASSETS = "/prototype-suru-ad";

const COPY = {
  es: {
    label: "PUBLI",
    aria: "Publicidad",
    close: "Cerrar anuncio",
    title: "¿Vas al Retiro?",
    text: "Café de especialidad y alfajores artesanales a 5 min del parque (Maíquez 50).",
    giftPre: " te regala ",
    giftStrong: "2 sellos",
    giftPost: " en tu tarjeta de fidelidad.",
    cta: "Consigue aquí tu tarjeta de fidelidad",
  },
  en: {
    label: "AD",
    aria: "Advertisement",
    close: "Close ad",
    title: "Heading to Retiro?",
    text: "Specialty coffee and artisan alfajores, 5 min from the park (Maíquez 50).",
    giftPre: " gives you ",
    giftStrong: "2 free stamps",
    giftPost: " on your loyalty card.",
    cta: "Get your loyalty card here",
  },
} satisfies Record<Locale, Record<string, string>>;

type Copy = (typeof COPY)[Locale];

// Archivo loads after hydration so it never blocks the status text from painting.
function useArchivoFont() {
  useEffect(() => {
    if (document.getElementById("suru-ad-font")) return;
    const link = document.createElement("link");
    link.id = "suru-ad-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;900&display=swap";
    document.head.appendChild(link);
  }, []);
}

// Reserves room at the end of the page for a fixed element so it never covers
// the Madrid Open Data attribution (the licence requires it to stay visible).
function useSpacerHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, height };
}

function BannerContent({ c, onClose }: { c: Copy; onClose?: () => void }) {
  return (
    <>
      <div className="suru-ad__meta">
        <span className="suru-ad__label">{c.label}</span>
        {onClose && (
          <button className="suru-ad__close" type="button" aria-label={c.close} onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <div className="suru-ad__body">
        <div className="suru-ad__title">{c.title}</div>
        <p className="suru-ad__text">{c.text}</p>
        <p className="suru-ad__text">
          <img className="suru-ad__logo" src={`${ASSETS}/wordmark-wine.png`} alt="Suru" />
          {c.giftPre}
          <strong>{c.giftStrong}</strong>
          {c.giftPost}
        </p>
      </div>
      <div className="suru-ad__mascot" aria-hidden="true">
        <img src={`${ASSETS}/mascot-wine-on-cream.png`} alt="" />
      </div>
      <a className="suru-ad__cta" href={SURU_AD_HREF} rel="sponsored noopener" target="_blank">
        <span>{c.cta}</span>
        <span aria-hidden="true">→</span>
      </a>
    </>
  );
}

/** A: the handoff as designed. Fixed to the bottom, × hides it for this visit. */
export function VariantA({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  useArchivoFont();
  const { ref, height } = useSpacerHeight();
  // Hidden until mounted, like the handoff, so SSR and hydration agree.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
  return (
    <>
      <div style={{ height: open ? height : 0 }} aria-hidden="true" />
      <aside id="suru-ad" className="suru-ad suru-ad--sticky" aria-label={c.aria} hidden={!open}>
        <div ref={ref} className="suru-ad__inner" data-nosnippet>
          <BannerContent c={c} onClose={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
VariantA.label = "Sticky bar";

/** B: part of the page, just above the attribution. Nothing overlaps the status. */
export function VariantB({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  useArchivoFont();
  return (
    <aside id="suru-ad" className="suru-ad suru-ad--card" aria-label={c.aria}>
      <div className="suru-ad__inner" data-nosnippet>
        <BannerContent c={c} />
      </div>
    </aside>
  );
}
VariantB.label = "In-page card";

/** C: a one-line tab pinned to the bottom. Tapping it opens the full banner. */
export function VariantC({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  useArchivoFont();
  const { ref, height } = useSpacerHeight();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div style={{ height }} aria-hidden="true" />
      <aside id="suru-ad" className="suru-ad suru-ad--tab" aria-label={c.aria}>
        <div ref={ref} data-nosnippet>
          {/* Both states are always in the DOM so the ad text is covered by
              data-nosnippet from the first render. */}
          <div className="suru-ad__inner" hidden={!expanded}>
            <BannerContent c={c} onClose={() => setExpanded(false)} />
          </div>
          <button
            type="button"
            className="suru-ad__tab"
            hidden={expanded}
            aria-expanded={expanded}
            onClick={() => setExpanded(true)}
          >
            <span className="suru-ad__tab-mascot" aria-hidden="true">
              <img src={`${ASSETS}/mascot-wine-on-cream.png`} alt="" />
            </span>
            <img className="suru-ad__logo" src={`${ASSETS}/wordmark-wine.png`} alt="Suru" />
            <span>
              {c.giftPre.trim()} <strong>{c.giftStrong}</strong>
            </span>
            <span className="suru-ad__tab-end">
              <span className="suru-ad__label">{c.label}</span>
              <span aria-hidden="true">↑</span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
VariantC.label = "Tuck-away tab";

export const SURU_AD_VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
export type SuruAdVariantKey = keyof typeof SURU_AD_VARIANTS;
