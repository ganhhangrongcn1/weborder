import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { initSupabaseRuntimeClient } from "./services/supabase/supabaseRuntimeClient.js";
import "./styles.css";
import "./styles/base/reset.css";
import "./styles/base/typography.css";

initSupabaseRuntimeClient();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
