import { useEffect, useRef, useState } from "react";
import type { Locale } from "../i18n";

/** Set when a visitor closes the ad; index.html reads it before first paint. */
const DISMISSED_KEY = "suruAdDismissed";

// Space kept free at the end of the page from the first paint, so the fixed banner
// never covers the Madrid Open Data attribution and nothing shifts when it loads
// (layout shift counts against Core Web Vitals). Values are the banner's measured
// height at each width, taking the taller of the ES and EN copy; if the copy
// changes, re-measure. A line's difference is absorbed by the footer's padding.
const RESERVED_HEIGHT =
  "h-[178px] min-[340px]:h-[162px] min-[358px]:h-[149px] min-[389px]:h-[135px] min-[640px]:h-[117px]";

const LABELS: Record<Locale, string> = {
  es: "Publicidad",
  en: "Advertisement",
};

/**
 * Suru Café ad, fixed to the bottom of the page.
 *
 * The ad itself is a separate noindex page (public/ads/suru/) shown in an iframe,
 * so none of its text counts as this page's content in search results. The iframe
 * posts its height and the × click back to this component.
 */
export function SuruAd({ locale }: { locale: Locale }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The iframe is only added after hydration so it never competes with the status.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) {
        setDismissed(true);
        return;
      }
    } catch {
      // Storage unavailable (e.g. blocked cookies): show the ad.
    }
    setMounted(true);

    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      if (event.data?.type === "suru-ad:height") {
        setHeight(event.data.height);
      } else if (event.data?.type === "suru-ad:close") {
        setDismissed(true);
        try {
          localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
          // Can't remember it; the ad returns on the next visit.
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (dismissed) return null;

  return (
    <>
      <div className={`suru-ad ${RESERVED_HEIGHT}`} aria-hidden="true" />
      {mounted && (
        <aside
          className="suru-ad fixed inset-x-0 bottom-0 z-50 border-t-2 border-[#881a24] bg-[#f8f2e3]"
          // Hidden until the iframe reports its height, so it never flashes empty.
          style={{ visibility: height === null ? "hidden" : "visible" }}
          aria-label={LABELS[locale]}
        >
          <iframe
            ref={frameRef}
            src={`/ads/suru/${locale}.html`}
            title={LABELS[locale]}
            className="block w-full border-0"
            style={height === null ? undefined : { height }}
          />
        </aside>
      )}
    </>
  );
}
