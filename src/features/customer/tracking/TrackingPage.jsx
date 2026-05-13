import React from "react";

export default function TrackingPage({ render: Render, ...props }) {
  return <Render {...props} />;
}
