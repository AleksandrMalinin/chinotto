/**
 * Component tests for EntryTextWithLinks: rendering of plain text, links, domain badge,
 * and link interaction (openUrl called, parent click not triggered).
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EntryTextWithLinks } from "./EntryTextWithLinks";
import { EntryStream } from "./EntryStream";
import { EntryDetail } from "./EntryDetail";
import type { Entry } from "../../types/entry";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));

vi.mock("./entryApi", () => ({
  findSimilarEntries: vi.fn(() => Promise.resolve([])),
  getThoughtTrail: vi.fn(() => Promise.resolve([])),
}));

describe("EntryTextWithLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders plain text with no URL normally", () => {
    const { container } = render(<EntryTextWithLinks text="No links here" variant="stream" />);
    expect(screen.getByText("No links here")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
  });

  it("renders a clickable link when text contains one URL", () => {
    render(<EntryTextWithLinks text="Read this https://linear.app/blog" variant="stream" />);
    const link = screen.getByRole("link", { name: /linear\.app\/blog/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://linear.app/blog");
    expect(link).toHaveClass("entry-link");
  });

  it("uses cleaned display text for the link (no scheme or www)", () => {
    render(<EntryTextWithLinks text="Check https://linear.app/blog" variant="stream" />);
    expect(screen.getByText("linear.app/blog")).toBeInTheDocument();

    render(<EntryTextWithLinks text="Visit www.openai.com/docs" variant="stream" />);
    expect(screen.getByText("openai.com/docs")).toBeInTheDocument();
  });

  it("shows domain badge only when there is exactly one URL and other text", () => {
    const { container } = render(
      <EntryTextWithLinks text="Read this https://linear.app/blog" variant="stream" />
    );
    const badge = container.querySelector(".entry-domain-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("linear.app");
  });

  it("does not show domain badge when the entry text is exactly the URL", () => {
    const { container } = render(
      <EntryTextWithLinks text="https://linear.app/blog" variant="stream" />
    );
    expect(container.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
  });

  it("does not show domain badge when there are multiple URLs", () => {
    const { container } = render(
      <EntryTextWithLinks text="https://a.com and https://b.com" variant="stream" />
    );
    expect(container.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
  });

  it("stream variant renders with entry-row-text and optional badge", () => {
    const { container } = render(
      <EntryTextWithLinks text="See https://example.com" variant="stream" />
    );
    const rowText = container.querySelector(".entry-row-text");
    expect(rowText).toBeInTheDocument();
    expect(container.querySelector(".entry-domain-badge")).toHaveTextContent("example.com");
  });

  it("detail variant renders with entry-detail-text and optional badge", () => {
    const { container } = render(
      <EntryTextWithLinks text="See https://example.com" variant="detail" />
    );
    const detailText = container.querySelector(".entry-detail-text");
    expect(detailText).toBeInTheDocument();
    expect(container.querySelector(".entry-detail-text-inner")).toBeInTheDocument();
    expect(container.querySelector(".entry-domain-badge")).toHaveTextContent("example.com");
  });

  it("detail variant with plain text has no badge", () => {
    const { container } = render(
      <EntryTextWithLinks text="Just some text" variant="detail" />
    );
    expect(container.querySelector(".entry-detail-text")).toBeInTheDocument();
    expect(container.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
  });

  describe("link interaction", () => {
    it("clicking a rendered link calls the link-opening action", () => {
      render(<EntryTextWithLinks text="Read https://linear.app/blog" variant="stream" />);
      const link = screen.getByRole("link", { name: /linear\.app\/blog/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledTimes(1);
      expect(openUrl).toHaveBeenCalledWith("https://linear.app/blog");
    });

    it("clicking a link does not trigger the parent entry row click handler", () => {
      const onEntryClick = vi.fn();
      const { container } = render(
        <article onClick={onEntryClick}>
          <div className="entry-row-text-wrap">
            <EntryTextWithLinks text="See https://example.com" variant="stream" />
          </div>
        </article>
      );
      const link = screen.getByRole("link", { name: /example\.com/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith("https://example.com");
      expect(onEntryClick).not.toHaveBeenCalled();
    });

    it("link clicks work in EntryStream", () => {
      const onEntryClick = vi.fn();
      const entry: Entry = {
        id: "e1",
        text: "Check https://stream-link.com/page",
        created_at: "2025-01-15T12:00:00Z",
      };
      render(
        <EntryStream
          entries={[entry]}
          sectionTitle="Today"
          onEntryClick={onEntryClick}
        />
      );
      const link = screen.getByRole("link", { name: /stream-link\.com\/page/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith("https://stream-link.com/page");
      expect(onEntryClick).not.toHaveBeenCalled();
    });

    it("link clicks work in EntryDetail", () => {
      const entry: Entry = {
        id: "e1",
        text: "Read this https://detail-link.com/doc",
        created_at: "2025-01-15T12:00:00Z",
      };
      render(
        <EntryDetail
          entry={entry}
          onBack={() => {}}
          onSelectEntry={() => {}}
        />
      );
      const link = screen.getByRole("link", { name: /detail-link\.com\/doc/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith("https://detail-link.com/doc");
    });
  });

  describe("link behavior across entry flow", () => {
    it("entry containing only a URL in stream has cleaned link text and no domain badge", () => {
      const entry: Entry = {
        id: "e1",
        text: "https://linear.app/blog",
        created_at: "2025-01-15T12:00:00Z",
      };
      const { container } = render(
        <EntryStream entries={[entry]} sectionTitle="Today" />
      );
      expect(screen.getByText("linear.app/blog")).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /linear\.app\/blog/ });
      expect(link).toHaveAttribute("href", "https://linear.app/blog");
      expect(container.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
    });

    it("entry containing text plus one URL in stream has clickable link and domain badge below", () => {
      const entry: Entry = {
        id: "e1",
        text: "Read this https://linear.app/blog",
        created_at: "2025-01-15T12:00:00Z",
      };
      const { container } = render(
        <EntryStream entries={[entry]} sectionTitle="Today" />
      );
      const link = screen.getByRole("link", { name: /linear\.app\/blog/ });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://linear.app/blog");
      const badge = container.querySelector(".entry-domain-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("linear.app");
    });

    it("entry detail preserves same link and badge rules as stream", () => {
      const entryWithContext: Entry = {
        id: "e1",
        text: "Check out https://example.com/resource",
        created_at: "2025-01-15T12:00:00Z",
      };
      const entryOnlyUrl: Entry = {
        id: "e2",
        text: "https://example.com/only",
        created_at: "2025-01-15T12:00:00Z",
      };

      const { container: detailWithContext } = render(
        <EntryDetail
          entry={entryWithContext}
          onBack={() => {}}
          onSelectEntry={() => {}}
        />
      );
      expect(screen.getByRole("link", { name: /example\.com\/resource/ })).toBeInTheDocument();
      expect(detailWithContext.querySelector(".entry-domain-badge")).toHaveTextContent("example.com");

      const { container: detailOnlyUrl } = render(
        <EntryDetail
          entry={entryOnlyUrl}
          onBack={() => {}}
          onSelectEntry={() => {}}
        />
      );
      expect(screen.getByRole("link", { name: /example\.com\/only/ })).toBeInTheDocument();
      expect(detailOnlyUrl.querySelector(".entry-domain-badge")).not.toBeInTheDocument();
    });

    it("clicking link in stream opens external URL and does not trigger entry row", () => {
      const onEntryClick = vi.fn();
      const entry: Entry = {
        id: "e1",
        text: "See https://external.com/page",
        created_at: "2025-01-15T12:00:00Z",
      };
      render(
        <EntryStream
          entries={[entry]}
          sectionTitle="Today"
          onEntryClick={onEntryClick}
        />
      );
      const link = screen.getByRole("link", { name: /external\.com\/page/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith("https://external.com/page");
      expect(onEntryClick).not.toHaveBeenCalled();
    });
  });
});
