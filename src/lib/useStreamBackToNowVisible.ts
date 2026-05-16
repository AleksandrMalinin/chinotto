import { useEffect, useState } from "react";
import { streamBackToNowVisibleStep } from "@/lib/jumpContextScroll";

/** True when the stream is scrolled meaningfully below “now” (top). */
export function useStreamBackToNowVisible(enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    function sync() {
      const top = document.scrollingElement?.scrollTop ?? 0;
      setVisible((was) => streamBackToNowVisibleStep(top, was));
    }
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [enabled]);

  return visible;
}
