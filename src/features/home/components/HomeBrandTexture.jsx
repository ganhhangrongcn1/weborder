import { useId } from "react";

export default function HomeBrandTexture() {
  const patternId = `home-weave-${useId().replace(/:/g,"")}`;
  return <svg className="home-brand-texture" aria-hidden="true" focusable="false" width="100%" height="100%">
    <defs><pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M6 14l1 .2m7-10 .8-.3" fill="none" stroke="currentColor" strokeWidth=".45" strokeLinecap="round" />
      <circle cx="2" cy="3" r=".45" fill="currentColor" /><circle cx="11" cy="9" r=".35" fill="currentColor" />
    </pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${patternId})`} />
  </svg>;
}
