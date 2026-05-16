import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { useStreamBackToNowVisible } from "./useStreamBackToNowVisible";

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

function Harness({ enabled }: { enabled: boolean }) {
  const visible = useStreamBackToNowVisible(enabled);
  return <span data-testid="visible">{visible ? "1" : "0"}</span>;
}

describe("useStreamBackToNowVisible", () => {
  it("becomes visible after scrolling past the away threshold", () => {
    const scrollTop = { current: 0 };
    const restoreScroll = stubScrollingElement(scrollTop);
    const { getByTestId } = render(<Harness enabled />);

    try {
      expect(getByTestId("visible").textContent).toBe("0");
      act(() => {
        scrollTop.current = 200;
        window.dispatchEvent(new Event("scroll"));
      });
      expect(getByTestId("visible").textContent).toBe("1");
    } finally {
      restoreScroll();
    }
  });

  it("resets when disabled", () => {
    const scrollTop = { current: 200 };
    const restoreScroll = stubScrollingElement(scrollTop);
    const { getByTestId, rerender } = render(<Harness enabled />);

    try {
      expect(getByTestId("visible").textContent).toBe("1");
      rerender(<Harness enabled={false} />);
      expect(getByTestId("visible").textContent).toBe("0");
    } finally {
      restoreScroll();
    }
  });
});
