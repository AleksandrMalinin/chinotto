/**
 * Jump context auto-clear: scroll-back-to-top, search open, entry detail open.
 */
import { describe, it, expect, vi } from "vitest";
import { useCallback, useState } from "react";
import { render, act } from "@testing-library/react";
import type { Entry } from "@/types/entry";
import { useJumpContextAutoClear } from "./useJumpContextAutoClear";

const ENTRY: Entry = {
  id: "e1",
  text: "Example thought for test.",
  created_at: "2025-03-15T12:00:00Z",
};

function stubScrollingElement(scrollTopRef: { current: number }) {
  const node = {
    get scrollTop() {
      return scrollTopRef.current;
    },
    set scrollTop(v: number) {
      scrollTopRef.current = v;
    },
  };
  const previous = Object.getOwnPropertyDescriptor(document, "scrollingElement");
  Object.defineProperty(document, "scrollingElement", {
    configurable: true,
    enumerable: true,
    get() {
      return node as unknown as HTMLHtmlElement;
    },
  });
  return () => {
    if (previous) {
      Object.defineProperty(document, "scrollingElement", previous);
    } else {
      delete (document as unknown as { scrollingElement?: unknown }).scrollingElement;
    }
  };
}

describe("useJumpContextAutoClear", () => {
  it("calls clearJumpContext after scrolling past away threshold then back near top", () => {
    const clear = vi.fn();
    function Harness() {
      const [ymd, setYmd] = useState<string | null>("2025-03-15");
      const clearJump = useCallback(() => {
        clear();
        setYmd(null);
      }, []);
      useJumpContextAutoClear({
        jumpContextYmd: ymd,
        clearJumpContext: clearJump,
        isSearchOpen: false,
        selectedEntry: null,
      });
      return null;
    }

    const scrollTop = { current: 0 };
    const restoreScroll = stubScrollingElement(scrollTop);
    render(<Harness />);

    try {
      act(() => {
        scrollTop.current = 200;
        window.dispatchEvent(new Event("scroll"));
      });
      expect(clear).not.toHaveBeenCalled();

      act(() => {
        scrollTop.current = 0;
        window.dispatchEvent(new Event("scroll"));
      });
      expect(clear).toHaveBeenCalledTimes(1);
    } finally {
      restoreScroll();
    }
  });

  it("does not clear from scroll events when the user never scrolled past away threshold", () => {
    const clear = vi.fn();
    function Harness() {
      const [ymd, setYmd] = useState<string | null>("2025-03-15");
      const clearJump = useCallback(() => {
        clear();
        setYmd(null);
      }, []);
      useJumpContextAutoClear({
        jumpContextYmd: ymd,
        clearJumpContext: clearJump,
        isSearchOpen: false,
        selectedEntry: null,
      });
      return null;
    }

    const scrollTop = { current: 0 };
    const restoreScroll = stubScrollingElement(scrollTop);
    render(<Harness />);

    try {
      act(() => {
        scrollTop.current = 40;
        window.dispatchEvent(new Event("scroll"));
      });
    } finally {
      restoreScroll();
    }
    expect(clear).not.toHaveBeenCalled();
  });

  it("clears when search opens while jump context is active", () => {
    const clear = vi.fn();
    let openSearch: () => void = () => {};

    function Harness() {
      const [ymd, setYmd] = useState<string | null>("2025-03-15");
      const [searchOpen, setSearchOpen] = useState(false);
      openSearch = () => setSearchOpen(true);
      const clearJump = useCallback(() => {
        clear();
        setYmd(null);
      }, []);
      useJumpContextAutoClear({
        jumpContextYmd: ymd,
        clearJumpContext: clearJump,
        isSearchOpen: searchOpen,
        selectedEntry: null,
      });
      return null;
    }

    render(<Harness />);
    act(() => openSearch());
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("clears when an entry is opened while jump context is active", () => {
    const clear = vi.fn();
    let openEntry: () => void = () => {};

    function Harness() {
      const [ymd, setYmd] = useState<string | null>("2025-03-15");
      const [entry, setEntry] = useState<Entry | null>(null);
      openEntry = () => setEntry(ENTRY);
      const clearJump = useCallback(() => {
        clear();
        setYmd(null);
      }, []);
      useJumpContextAutoClear({
        jumpContextYmd: ymd,
        clearJumpContext: clearJump,
        isSearchOpen: false,
        selectedEntry: entry,
      });
      return null;
    }

    render(<Harness />);
    act(() => openEntry());
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
