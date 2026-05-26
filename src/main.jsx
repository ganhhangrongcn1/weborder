import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { registerPwaServiceWorker } from "./services/pwaInstallService.js";
import { initSupabaseRuntimeClient } from "./services/supabase/supabaseRuntimeClient.js";
import "./styles.css";
import "./styles/base/reset.css";
import "./styles/base/typography.css";

initSupabaseRuntimeClient();
registerPwaServiceWorker();

const Router = import.meta.env.VITE_APK_BUNDLE === "true" ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
