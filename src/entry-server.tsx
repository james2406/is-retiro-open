import React from "react";
import ReactDOMServer from "react-dom/server";
import App from "./App";
import { Providers } from "./components/Providers";
import { RetiroStatus } from "./types";
import { Locale } from "./i18n";

export function render(data: RetiroStatus | null, locale: Locale) {
  // We need to inject the data into the app so it renders with content
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <Providers>
        <App initialData={data} initialLocale={locale} />
      </Providers>
    </React.StrictMode>
  );
}
