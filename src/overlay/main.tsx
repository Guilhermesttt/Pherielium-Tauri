import React from "react";
import ReactDOM from "react-dom/client";
import OverlayApp from "./OverlayApp";
// Inter embutida: o overlay é outra janela e não passa pelo main.tsx
import "@fontsource-variable/inter/opsz.css";
import "../index.css";
import "./overlay.css";
import { GamepadProvider } from "../context/GamepadContext";
import { installOverlayBridge } from "../lib/installOverlayBridge";

installOverlayBridge();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GamepadProvider>
        <OverlayApp />
      </GamepadProvider>
    </React.StrictMode>
  );
}
