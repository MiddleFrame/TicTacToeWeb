import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { photonBrowserPlugin } from "./build/photon-browser-plugin";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./android-client", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  base: "./",
  define: {
    "process.env.NEXT_PUBLIC_PHOTON_APP_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_PHOTON_APP_ID ?? "",
    ),
  },
  plugins: [photonBrowserPlugin, react()],
  build: {
    outDir: fileURLToPath(new URL("./android-shell", import.meta.url)),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
