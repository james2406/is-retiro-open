import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
  ssr: {
    // Bundle these dependencies in the SSR build (required for SSR compatibility)
    noExternal: ["lucide-react"],
  },
});
