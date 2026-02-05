import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Providers } from "./components/Providers";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

const container = document.getElementById("root");

if (container) {
  const initialData = window.__INITIAL_DATA__;
  const initialLocale = window.__INITIAL_LOCALE__;

  const Root = () => (
    <React.StrictMode>
      <Providers>
        <App initialData={initialData} initialLocale={initialLocale} />
        <Analytics />
      </Providers>
    </React.StrictMode>
  );

  if (import.meta.env.DEV) {
    ReactDOM.createRoot(container).render(<Root />);
  } else {
    ReactDOM.hydrateRoot(container, <Root />);
  }
} else {
  console.error("Root element not found");
}
