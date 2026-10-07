import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

// MoiJournal hosts the site on Vercel and the journal API on Render (see DEPLOY.md).
// Nitro bundles the server for the host platform: `NITRO_PRESET=vercel` in the Vercel
// project pins that target, and a plain local build falls back to a runnable Node server
// (see the `preview` script).
const FALLBACK_PRESET = "node-server";

function envDefines(mode: string) {
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  return define;
}

export default defineConfig(({ command, mode }) => ({
  define: envDefines(mode),

  css: { transformer: "lightningcss" },

  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    // One copy of React and TanStack Query in the bundle, whichever package pulls them in.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },

  plugins: [
    tailwindcss(),
    tanstackStart({
      // src/server.ts wraps the generated entry so SSR failures render an HTML error page
      // instead of a bare JSON 500.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // The server bundle is only produced for deploys; `vite dev` serves the app directly.
    ...(command === "build" ? [nitro({ defaultPreset: FALLBACK_PRESET })] : []),
    viteReact(),
  ],

  server: {
    host: true,
    port: 8080,
    // Editors that save twice in quick succession can otherwise restart the dev server twice.
    watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
  },
}));
