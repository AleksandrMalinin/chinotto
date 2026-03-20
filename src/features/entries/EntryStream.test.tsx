/**
 * Empty main-stream branches: search message, dismissed placeholder, default vs progressive onboarding.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntryStream } from "./EntryStream";
import type { Entry } from "../../types/entry";

describe("EntryStream empty main timeline", () => {
  it("shows search empty copy when highlights mode and no entries", () => {
    render(<EntryStream entries={[]} showHighlights />);
    expect(
      screen.getByText("No thoughts match your search.")
    ).toBeInTheDocument();
  });

  it("renders dismissed placeholder when emptyOnboarding is null", () => {
    const { container } = render(
      <EntryStream entries={[]} emptyOnboarding={null} />
    );
    expect(
      container.querySelector(".stream-empty-onboarding--dismissed-placeholder")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /just write/i })
    ).not.toBeInTheDocument();
  });

  it("renders default full onboarding when emptyOnboarding is omitted", () => {
    const { container } = render(<EntryStream entries={[]} />);
    expect(
      container.querySelector(".stream-empty-onboarding--progressive")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /just write\. no structure\./i })
    ).toBeInTheDocument();
    expect(screen.getByText("Start with one line.")).toBeInTheDocument();
  });

  it("renders progressive onboarding when emptyOnboarding config is passed", () => {
    const onExitComplete = vi.fn();
    const { container } = render(
      <EntryStream
        entries={[]}
        emptyOnboarding={{
          variant: "soft",
          exiting: false,
          typingAccent: true,
          onExitComplete,
        }}
      />
    );
    expect(
      container.querySelector(".stream-empty-onboarding--progressive")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /just write\. no structure\./i })
    ).toBeInTheDocument();
  });
});

describe("EntryStream non-empty", () => {
  it("renders entry row for dated stream without sectionTitle", () => {
    const entry: Entry = {
      id: "e1",
      text: "Hello stream",
      created_at: new Date().toISOString(),
    };
    render(<EntryStream entries={[entry]} />);
    expect(screen.getByText("Hello stream")).toBeInTheDocument();
  });
});
