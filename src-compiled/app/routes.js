import { Navigate, Route, Routes } from "react-router-dom";
import AppAdminRoutes from "../features/app/AppAdminRoutes.js";
import AppCustomerRoutes from "../features/app/AppCustomerRoutes.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AppRoutes({
  adminAppProps,
  customerRouteProps
}) {
  return /*#__PURE__*/_jsxs(Routes, {
    children: [/*#__PURE__*/_jsx(Route, {
      path: "/",
      element: /*#__PURE__*/_jsx(Navigate, {
        to: "/home",
        replace: true
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/home",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/menu",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/cart",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/checkout",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/success",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/profile",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/orders",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/loyalty",
      element: /*#__PURE__*/_jsx(AppCustomerRoutes, {
        ...customerRouteProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/menu",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/orders",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/customers",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/loyalty",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/settings",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/settings/zalo",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/settings/shipping",
      element: /*#__PURE__*/_jsx(Navigate, {
        to: "/admin/settings",
        replace: true
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/ui",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "/admin/promotions",
      element: /*#__PURE__*/_jsx(AppAdminRoutes, {
        adminAppProps: adminAppProps
      })
    }), /*#__PURE__*/_jsx(Route, {
      path: "*",
      element: /*#__PURE__*/_jsx(Navigate, {
        to: "/home",
        replace: true
      })
    })]
  });
}