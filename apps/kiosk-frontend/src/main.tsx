import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installWatchdog } from "./kiosk/watchdog";
import "./index.css";

// Self-heal on uncaught faults during unattended operation.
installWatchdog();

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
