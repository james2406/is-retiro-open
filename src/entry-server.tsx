import React from "react";
import ReactDOMServer from "react-dom/server";
import App from "./App";
import { RetiroStatus } from "./types";

export function render(data: RetiroStatus | null) {
  // We need to inject the data into the app so it renders with content
  // Note: We'll need to modify App.tsx to accept initialData
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <App initialData={data} />
    </React.StrictMode>
  );
}
