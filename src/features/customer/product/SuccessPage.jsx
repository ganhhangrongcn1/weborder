import React from "react";

export default function SuccessPage({ render: Render, ...props }) {
  return <Render {...props} />;
}
