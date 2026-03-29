import { useEffect, useRef } from "react";
import type { Entry } from "@/types/entry";
import { jumpScrollDismissStep } from "@/lib/jumpContextScroll";

type Params = {
  jumpContextYmd: string | null;
  clearJumpContext: () => void;
  isSearchOpen: boolean;
  selectedEntry: Entry | null;
};

/** Clears jump context when the user scrolls back near the top, opens search, or opens an entry. */
export function useJumpContextAutoClear({
  jumpContextYmd,
  clearJumpContext,
  isSearchOpen,
  selectedEntry,
}: Params): void {
  const jumpScrollAwayFromTopRef = useRef(false);

  useEffect(() => {
    if (!jumpContextYmd) return;
    jumpScrollAwayFromTopRef.current = false;
    function onScroll() {
      const el = document.scrollingElement;
      const top = el?.scrollTop ?? 0;
      const { hadScrolledAway, shouldDismiss } = jumpScrollDismissStep(
        top,
        jumpScrollAwayFromTopRef.current
      );
      if (shouldDismiss) {
        clearJumpContext();
      } else {
        jumpScrollAwayFromTopRef.current = hadScrolledAway;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [jumpContextYmd, clearJumpContext]);

  useEffect(() => {
    if (isSearchOpen && jumpContextYmd) {
      clearJumpContext();
    }
  }, [isSearchOpen, jumpContextYmd, clearJumpContext]);

  useEffect(() => {
    if (selectedEntry && jumpContextYmd) {
      clearJumpContext();
    }
  }, [selectedEntry, jumpContextYmd, clearJumpContext]);
}
