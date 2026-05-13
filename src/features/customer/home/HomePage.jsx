import React from "react";

export default function HomePage({ render: Render, ...props }) {
  return <Render {...props} />;
}
