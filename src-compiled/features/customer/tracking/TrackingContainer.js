import { jsx as _jsx } from "react/jsx-runtime";
export default function TrackingContainer({
  trackingRender: TrackingRender,
  ...props
}) {
  if (!TrackingRender) return null;
  return /*#__PURE__*/_jsx(TrackingRender, {
    ...props
  });
}