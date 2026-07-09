/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchThemeChips } from "./SearchThemeChips";

describe("SearchThemeChips", () => {
  it("renders chips only when count meets threshold", () => {
    render(
      <SearchThemeChips
        counts={[
          { themeId: "book", count: 5 },
          { themeId: "therapy", count: 2 },
        ]}
        selectedThemeId={null}
        onSelectTheme={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /book/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /therapy/i })).not.toBeInTheDocument();
  });

  it("toggles selected theme", () => {
    const onSelectTheme = vi.fn();
    render(
      <SearchThemeChips
        counts={[{ themeId: "links", count: 8 }]}
        selectedThemeId={null}
        onSelectTheme={onSelectTheme}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /links/i }));
    expect(onSelectTheme).toHaveBeenCalledWith("links");
  });
});
