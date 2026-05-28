import { describe, it, expect, beforeEach } from "vitest";
import {
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  clampUiZoom,
  readStoredUiZoom,
  stepUiZoom,
  writeStoredUiZoom,
  isUiZoomInKey,
  isUiZoomOutKey,
} from "./uiZoom";

describe("uiZoom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clamps to min and max", () => {
    expect(clampUiZoom(0.5)).toBe(UI_ZOOM_MIN);
    expect(clampUiZoom(2)).toBe(UI_ZOOM_MAX);
    expect(clampUiZoom(1.1)).toBe(1.1);
  });

  it("defaults when storage is missing or invalid", () => {
    expect(readStoredUiZoom()).toBe(UI_ZOOM_DEFAULT);
    localStorage.setItem("chinotto.uiZoom", "nope");
    expect(readStoredUiZoom()).toBe(UI_ZOOM_DEFAULT);
  });

  it("persists clamped zoom", () => {
    expect(writeStoredUiZoom(1.1)).toBe(1.1);
    expect(readStoredUiZoom()).toBe(1.1);
    writeStoredUiZoom(1.25);
    expect(readStoredUiZoom()).toBe(UI_ZOOM_MAX);
    writeStoredUiZoom(9);
    expect(readStoredUiZoom()).toBe(UI_ZOOM_MAX);
  });

  it("steps within bounds", () => {
    writeStoredUiZoom(UI_ZOOM_MAX);
    expect(stepUiZoom(readStoredUiZoom(), 1)).toBe(UI_ZOOM_MAX);
    writeStoredUiZoom(UI_ZOOM_MIN);
    expect(stepUiZoom(readStoredUiZoom(), -1)).toBe(UI_ZOOM_MIN);
    writeStoredUiZoom(1);
    expect(stepUiZoom(1, 1)).toBe(1.05);
    expect(stepUiZoom(1, -1)).toBe(0.95);
    expect(stepUiZoom(0.85, -1)).toBe(0.85);
  });

  it("recognizes zoom keyboard shortcuts", () => {
    expect(
      isUiZoomInKey({ metaKey: true, altKey: false, key: "=", code: "Equal" } as KeyboardEvent)
    ).toBe(true);
    expect(
      isUiZoomOutKey({ metaKey: true, altKey: false, key: "-", code: "Minus" } as KeyboardEvent)
    ).toBe(true);
    expect(
      isUiZoomInKey({ metaKey: true, altKey: true, key: "=", code: "Equal" } as KeyboardEvent)
    ).toBe(false);
  });
});
