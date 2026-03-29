import { describe, it, expect } from "vitest";
import {
  JUMP_CONTEXT_SCROLL_AWAY_MIN_PX,
  JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX,
  jumpScrollDismissStep,
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
