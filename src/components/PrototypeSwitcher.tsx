// PROTOTYPE tooling: floating variant switcher. Dev-only (see App.tsx gate).
// Sits at the top of the screen, because the ad being judged lives at the bottom.
import { useCallback, useEffect, useState, type CSSProperties } from "react";

/** Reads ?variant= after mount so the server-rendered HTML and hydration agree. */
export function useVariantParam<K extends string>(keys: readonly K[]): [K, (k: K) => void] {
  const [variant, setVariant] = useState<K>(keys[0]);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("variant") as K | null;
    if (v && keys.includes(v)) setVariant(v);
  }, [keys]);
  const select = useCallback((k: K) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", k);
    window.history.replaceState(null, "", url);
    setVariant(k);
  }, []);
  return [variant, select];
}

// Allowed by Google for data-nosnippet: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
const NOSNIPPET_TAGS = ["DIV", "SPAN", "SECTION"];

interface SeoCheck {
  nosnippet: boolean;
  sponsored: boolean;
  href: string | null;
}

// Inspects the live DOM so the checks reflect exactly what each variant renders.
function checkAd(): SeoCheck | null {
  const ad = document.getElementById("suru-ad");
  if (!adText(ad)) return null;
  const wrapper = ad!.querySelector("[data-nosnippet]");
  const nosnippet =
    !!wrapper && NOSNIPPET_TAGS.includes(wrapper.tagName) && adText(wrapper) === adText(ad);
  const links = [...ad!.querySelectorAll("a")];
  const sponsored = links.length > 0 && links.every((a) => a.relList.contains("sponsored"));
  return { nosnippet, sponsored, href: links[0]?.getAttribute("href") ?? null };
}

function adText(el: Element | null) {
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function reloadWith(param: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.location.href = url.toString();
}

interface Props<K extends string> {
  variants: readonly K[];
  labels: Record<K, string>;
  current: K;
  onSelect: (k: K) => void;
}

export function PrototypeSwitcher<K extends string>({ variants, labels, current, onSelect }: Props<K>) {
  const i = variants.indexOf(current);
  const step = useCallback(
    (d: number) => onSelect(variants[(i + d + variants.length) % variants.length]),
    [i, variants, onSelect],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const [seo, setSeo] = useState<SeoCheck | null>(null);
  useEffect(() => {
    const id = setInterval(() => setSeo(checkAd()), 500);
    return () => clearInterval(id);
  }, []);

  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const lang = params.get("lang") ?? "es";
  const code = params.get("code") ?? "1";
  const mark = (ok: boolean) => (ok ? "✓" : "✗");

  return (
    <div
      style={{
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 5000,
        background: "#111", color: "#fff", borderRadius: 14, padding: "8px 12px",
        boxShadow: "0 6px 24px rgba(0,0,0,.35)", font: "12px/1.4 ui-monospace, Menlo, monospace",
        display: "flex", flexDirection: "column", gap: 6, alignItems: "center", maxWidth: "calc(100vw - 24px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => step(-1)} style={btn} aria-label="Previous variant">←</button>
        <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>
          {current} ({labels[current]})
        </strong>
        <button onClick={() => step(1)} style={btn} aria-label="Next variant">→</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, opacity: 0.9 }}>
        {(["es", "en"] as const).map((l) => (
          <button key={l} onClick={() => reloadWith("lang", l)} style={{ ...chip, ...(lang === l ? on : {}) }}>
            {l.toUpperCase()}
          </button>
        ))}
        <span style={{ opacity: 0.5 }}>|</span>
        {["1", "2", "3", "4", "5"].map((n) => (
          <button key={n} onClick={() => reloadWith("code", n)} style={{ ...chip, ...(code === n ? on : {}) }}>
            {n}
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", color: seo && seo.nosnippet && seo.sponsored ? "#7CFC9A" : "#FF8A80" }}>
        {seo
          ? `nosnippet ${mark(seo.nosnippet)} · sponsored ${mark(seo.sponsored)} · ${seo.href?.replace("https://", "")}`
          : "ad not in DOM"}
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  background: "#333", color: "#fff", border: 0, borderRadius: 8, padding: "2px 10px", cursor: "pointer", fontSize: 14,
};
const chip: CSSProperties = {
  background: "transparent", color: "#fff", border: "1px solid #555", borderRadius: 6, padding: "0 6px", cursor: "pointer", font: "inherit",
};
const on: CSSProperties = { background: "#fff", color: "#111" };
