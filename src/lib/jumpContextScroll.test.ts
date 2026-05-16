import { describe, it, expect } from "vitest";
import {
  JUMP_CONTEXT_SCROLL_AWAY_MIN_PX,
  JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX,
  jumpScrollDismissStep,
  streamBackToNowVisibleStep,
  streamIsScrolledAwayFromTop,
} from "./jumpContextScroll";

describe("jumpScrollDismissStep", () => {
  it("does not dismiss when still near top and user never scrolled past away threshold", () => {
    expect(jumpScrollDismissStep(80, false)).toEqual({
      hadScrolledAway: false,
      shouldDismiss: false,
    });
    expect(jumpScrollDismissStep(0, false)).toEqual({
      hadScrolledAway: false,
      shouldDismiss: false,
    });
  });

  it("arms hadScrolledAway when scrollTop crosses above away threshold", () => {
    expect(
      jumpScrollDismissStep(JUMP_CONTEXT_SCROLL_AWAY_MIN_PX + 1, false)
    ).toEqual({ hadScrolledAway: true, shouldDismiss: false });
  });

  it("dismisses when armed and scrollTop is at or below top clear threshold", () => {
    expect(
      jumpScrollDismissStep(JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX, true)
    ).toEqual({ hadScrolledAway: true, shouldDismiss: true });
    expect(jumpScrollDismissStep(0, true)).toEqual({
      hadScrolledAway: true,
      shouldDismiss: true,
    });
  });

  it("does not dismiss at top clear threshold until armed", () => {
    expect(
      jumpScrollDismissStep(JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX, false)
    ).toEqual({ hadScrolledAway: false, shouldDismiss: false });
  });

  it("stays armed in the band between top clear and away thresholds", () => {
    const mid = (JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX +
      JUMP_CONTEXT_SCROLL_AWAY_MIN_PX) /
      2;
    expect(jumpScrollDismissStep(mid, true)).toEqual({
      hadScrolledAway: true,
      shouldDismiss: false,
    });
  });
});

describe("streamBackToNowVisibleStep", () => {
  it("shows when scroll is past the away threshold", () => {
    expect(
      streamBackToNowVisibleStep(JUMP_CONTEXT_SCROLL_AWAY_MIN_PX + 1, false)
    ).toBe(true);
  });

  it("hides when scroll is at or below the top clear threshold", () => {
    expect(
      streamBackToNowVisibleStep(JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX, true)
    ).toBe(false);
    expect(streamBackToNowVisibleStep(0, true)).toBe(false);
  });

  it("keeps prior visibility in the band between thresholds", () => {
    const mid =
      (JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX + JUMP_CONTEXT_SCROLL_AWAY_MIN_PX) /
      2;
    expect(streamBackToNowVisibleStep(mid, true)).toBe(true);
    expect(streamBackToNowVisibleStep(mid, false)).toBe(false);
  });
});

describe("streamIsScrolledAwayFromTop", () => {
  it("is false at or below the away threshold", () => {
    expect(streamIsScrolledAwayFromTop(JUMP_CONTEXT_SCROLL_AWAY_MIN_PX)).toBe(
      false
    );
    expect(streamIsScrolledAwayFromTop(0)).toBe(false);
  });

  it("is true above the away threshold", () => {
    expect(
      streamIsScrolledAwayFromTop(JUMP_CONTEXT_SCROLL_AWAY_MIN_PX + 1)
    ).toBe(true);
  });
});
