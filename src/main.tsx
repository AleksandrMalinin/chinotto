import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/500.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IconVariantShowcase } from "./components/IconVariantShowcase";
import { setUmami } from "./lib/analytics";
import "./index.css";

const umamiUrl = import.meta.env.VITE_UMAMI_URL ?? null;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID ?? null;
if (import.meta.env.DEV) {
  console.log("[analytics] env at init", {
    VITE_UMAMI_URL: umamiUrl ?? "(undefined)",
    VITE_UMAMI_WEBSITE_ID: umamiWebsiteId ? `${String(umamiWebsiteId).slice(0, 4)}…` : "(undefined)",
  });
}
setUmami(umamiUrl, umamiWebsiteId);

function Root() {
  const [showIconShowcase, setShowIconShowcase] = useState(() =>
    import.meta.env.DEV && window.location.hash === "#icon-variants"
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onHash = () => setShowIconShowcase(window.location.hash === "#icon-variants");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (import.meta.env.DEV && showIconShowcase) {
    return <IconVariantShowcase />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
