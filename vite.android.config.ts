import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { androidPublicAssetsPlugin } from "./build/android-public-assets-plugin";
import { photonBrowserPlugin } from "./build/photon-browser-plugin";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const gameAssets = fileURLToPath(new URL("./public/game", import.meta.url));
const androidGameAssets = fileURLToPath(new URL("./android-shell/game", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./android-client", import.meta.url)),
  publicDir: false,
  base: "./",
  define: {
    "process.env.NEXT_PUBLIC_API_ORIGIN": JSON.stringify(
      process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://tic-tac-toe-plus-alpha.stofs.chatgpt.site",
    ),
    "process.env.NEXT_PUBLIC_PHOTON_APP_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_PHOTON_APP_ID ?? "",
    ),
  },
  plugins: [
    photonBrowserPlugin,
    react(),
    androidPublicAssetsPlugin({ source: gameAssets, destination: androidGameAssets }),
  ],
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
