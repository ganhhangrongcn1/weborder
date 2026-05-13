import React from "react";

export default function ProductDetailPage({ render: Render, ...props }) {
  return <Render {...props} />;
}
