import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/500.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IconVariantShowcase } from "./components/IconVariantShowcase";
import "./index.css";

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
