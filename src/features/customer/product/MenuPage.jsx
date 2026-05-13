import React from "react";

export default function MenuPage({ render: Render, ...props }) {
  return <Render {...props} />;
}
