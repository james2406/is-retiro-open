import React from "react";
import ReactDOMServer from "react-dom/server";
import App from "./App";
import { RetiroStatus } from "./types";
import { Locale } from "./i18n";

export function render(data: RetiroStatus | null, locale: Locale) {
  // We need to inject the data into the app so it renders with content
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <App initialData={data} initialLocale={locale} />
    </React.StrictMode>
  );
}
