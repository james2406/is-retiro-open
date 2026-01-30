import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import type { RetiroStatus } from "./types";

declare global {
  interface Window {
    __INITIAL_DATA__?: RetiroStatus;
  }
}

const container = document.getElementById("root");

if (container) {
  const initialData = window.__INITIAL_DATA__;

  if (import.meta.env.DEV) {
    // In dev mode, using hydrateRoot on empty HTML can cause issues because
    // the server didn't render anything. We should use createRoot instead
    // if there's no server-rendered content.
    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App initialData={initialData} />
      </React.StrictMode>
    );
  } else {
    // In production (SSG), we always hydrate because HTML is pre-rendered
    ReactDOM.hydrateRoot(
      container,
      <React.StrictMode>
        <App initialData={initialData} />
      </React.StrictMode>
    );
  }
} else {
  console.error("Root element not found");
}
