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

  it("renders quiet lens empty copy when emptyLensMessage is set", () => {
    render(<EntryStream entries={[]} emptyLensMessage="Nothing in Work yet." />);
    expect(screen.getByText("Nothing in Work yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /just write/i })
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(".stream-empty-onboarding--progressive")
    ).not.toBeInTheDocument();
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

  it("shows link indicator when entry text contains a URL", () => {
    const entry: Entry = {
      id: "e-link",
      text: "Watch https://letterboxd.com/film/example",
      created_at: new Date().toISOString(),
    };
    render(<EntryStream entries={[entry]} />);
    expect(screen.getByLabelText("Contains link")).toBeInTheDocument();
  });

  it("does not show link indicator for plain text entries", () => {
    const entry: Entry = {
      id: "e-plain",
      text: "Just a thought",
      created_at: new Date().toISOString(),
    };
    render(<EntryStream entries={[entry]} />);
    expect(screen.queryByLabelText("Contains link")).not.toBeInTheDocument();
  });

  it("shows only first line in stream preview when entry has multiple lines", () => {
    const entry: Entry = {
      id: "e-multi",
      text: "Enjoy yourself — it's later than you think\nMeow\nCool",
      created_at: new Date().toISOString(),
    };
    render(<EntryStream entries={[entry]} />);
    expect(screen.getByText(/Enjoy yourself/)).toBeInTheDocument();
    expect(screen.queryByText(/Meow/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cool/)).not.toBeInTheDocument();
  });

  it("marks the newest entry row for compact stream typography", () => {
    const newest: Entry = {
      id: "e-newest",
      text: "Latest thought",
      created_at: new Date().toISOString(),
    };
    const older: Entry = {
      id: "e-older",
      text: "Earlier thought",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    };
    const { container } = render(<EntryStream entries={[newest, older]} />);
    const newestRow = container.querySelector(".entry-row--newest");
    expect(newestRow).toBeTruthy();
    expect(newestRow?.textContent).toContain("Latest thought");
    expect(container.querySelectorAll(".entry-row--newest")).toHaveLength(1);
  });
});
