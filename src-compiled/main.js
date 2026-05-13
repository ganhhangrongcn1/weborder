import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { initSupabaseRuntimeClient } from "./services/supabase/supabaseRuntimeClient.js";
import "./styles.css";
import "./styles/base/reset.css";
import "./styles/base/typography.css";
import { jsx as _jsx } from "react/jsx-runtime";
initSupabaseRuntimeClient();
createRoot(document.getElementById("root")).render(/*#__PURE__*/_jsx(React.StrictMode, {
  children: /*#__PURE__*/_jsx(BrowserRouter, {
    children: /*#__PURE__*/_jsx(App, {})
  })
}));