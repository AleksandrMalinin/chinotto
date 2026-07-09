/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchThemeChips } from "./SearchThemeChips";

const sampleThemes = [
  { id: "book", label: "Book", sort_order: 1 },
  { id: "therapy", label: "Therapy", sort_order: 2 },
];

describe("SearchThemeChips", () => {
  it("renders chips only when count meets threshold", () => {
    render(
      <SearchThemeChips
        userThemes={sampleThemes}
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
        userThemes={sampleThemes}
        counts={[{ themeId: "links", count: 8 }]}
        selectedThemeId={null}
        onSelectTheme={onSelectTheme}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /links/i }));
    expect(onSelectTheme).toHaveBeenCalledWith("links");
  });
});
