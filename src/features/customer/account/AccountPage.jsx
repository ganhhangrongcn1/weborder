import React from "react";

export default function AccountPage({ render: Render, ...props }) {
  return <Render {...props} />;
}
