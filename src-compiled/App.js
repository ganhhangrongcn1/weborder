import AppProviders from "./features/app/AppProviders.js";
import AppRoutes from "./app/routes.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function App() {
  return /*#__PURE__*/_jsx(AppProviders, {
    children: providers => /*#__PURE__*/_jsx(AppRoutes, {
      ...providers
    })
  });
}