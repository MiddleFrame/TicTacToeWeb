import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameClient } from "../app/components/GameClient";
import { LocalizationProvider } from "../app/game/localization";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Android application root is missing");
}

createRoot(root).render(
  <StrictMode>
    <LocalizationProvider>
      <GameClient />
    </LocalizationProvider>
  </StrictMode>,
);
