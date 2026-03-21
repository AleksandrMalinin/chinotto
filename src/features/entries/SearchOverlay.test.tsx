/**
 * Tests for search overlay rendering: results list visibility, count, preview text, empty state.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "./SearchInput";
import { SearchResultsList } from "./SearchResultsList";
import { getSearchFeedback } from "./searchOverlayFeedback";
import type { Entry } from "../../types/entry";

const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_END = "\u0002";

function entry(id: string, text: string, highlighted?: string): Entry {
  return {
    id,
    text,
    created_at: "2025-01-15T12:00:00Z",
    ...(highlighted !== undefined && { highlighted }),
  };
}

function SearchOverlayWithKeyboard({
  entries,
  initialSelectedIndex = 0,
}: {
  entries: Entry[];
  initialSelectedIndex?: number;
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [value, setValue] = useState("");
  const len = entries.length;
  return (
    <>
      <SearchInput
        value={value}
        onChange={setValue}
        onArrowDown={() => setSelectedIndex((i) => (len ? Math.min(len - 1, i + 1) : 0))}
        onArrowUp={() => setSelectedIndex((i) => (len ? Math.max(0, i - 1) : 0))}
      />
      <SearchResultsList
        entries={entries}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelectedIndex}
        onSelectEntry={() => {}}
      />
    </>
  );
}

function SearchOverlayWithEnter({
  entries,
  selectedIndex,
  onOpenEntry,
  onClose,
}: {
  entries: Entry[];
  selectedIndex: number;
  onOpenEntry: (entry: Entry) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const handleEnter = () => {
    if (entries.length > 0) {
      const toOpen = entries[selectedIndex] ?? entries[0];
      onOpenEntry(toOpen);
    }
    onClose();
  };
  return (
    <>
      <SearchInput
        value={value}
        onChange={setValue}
        onEnter={handleEnter}
      />
      {entries.length > 0 && (
        <SearchResultsList
          entries={entries}
          selectedIndex={selectedIndex}
          onSelectIndex={() => {}}
          onSelectEntry={(e) => {
            onOpenEntry(e);
            onClose();
          }}
        />
      )}
    </>
  );
}

describe("SearchResultsList", () => {
  it("renders nothing when there are no matches", () => {
    const { container } = render(
      <SearchResultsList
        entries={[]}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("when query matches entries, the results list appears", () => {
    const entries: Entry[] = [
      entry(
        "1",
        "1:1 with Sarah re: roadmap alignment and hiring plan for Q2",
        `1:1 with Sarah re: ${HIGHLIGHT_START}roadmap${HIGHLIGHT_END} alignment and hiring plan for Q2`
      ),
    ];
    render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const list = screen.getByRole("listbox", { name: "Search results" });
    expect(list).toBeInTheDocument();
  });

  it("renders the correct number of results", () => {
    const entries: Entry[] = [
      entry("1", "1:1 with Sarah re: roadmap alignment and hiring plan for Q2"),
      entry("2", "Review PR for auth refactor and add comments by EOD"),
    ];
    render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("each result shows a preview of the entry text", () => {
    const entries: Entry[] = [
      entry("1", "1:1 with Sarah re: roadmap alignment and hiring plan for Q2"),
      entry("2", "Review PR for auth refactor and add comments by EOD"),
    ];
    render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    expect(screen.getByText(/1:1 with Sarah re: roadmap/)).toBeInTheDocument();
    expect(screen.getByText(/Review PR for auth refactor/)).toBeInTheDocument();
  });

  it("query 'roadmap' returns one result with matching entry text", () => {
    const entries: Entry[] = [
      entry(
        "1",
        "1:1 with Sarah re: roadmap alignment and hiring plan for Q2",
        `1:1 with Sarah re: ${HIGHLIGHT_START}roadmap${HIGHLIGHT_END} alignment and hiring plan for Q2`
      ),
    ];
    render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain(
      "1:1 with Sarah re: roadmap alignment and hiring plan for Q2"
    );
  });
});

describe("matched text highlighting", () => {
  it("when a query matches part of the text, that substring is highlighted", () => {
    const entries: Entry[] = [
      entry(
        "1",
        "1:1 with Sarah re: roadmap alignment and hiring plan for Q2",
        `1:1 with Sarah re: ${HIGHLIGHT_START}roadmap${HIGHLIGHT_END} alignment and hiring plan for Q2`
      ),
    ];
    const { container } = render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("roadmap");
  });

  it("only the matching substring is highlighted, not the whole entry", () => {
    const entries: Entry[] = [
      entry(
        "1",
        "Review PR for auth refactor and add comments by EOD",
        `Review ${HIGHLIGHT_START}PR${HIGHLIGHT_END} for auth refactor and add comments by EOD`
      ),
    ];
    const { container } = render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("PR");
    const option = screen.getByRole("option");
    expect(option.textContent).toContain("Review PR for auth refactor");
  });

  it("multiple matches in the same entry are all highlighted", () => {
    const entries: Entry[] = [
      entry(
        "1",
        "Sync on roadmap and roadmap review for Q2",
        `Sync on ${HIGHLIGHT_START}roadmap${HIGHLIGHT_END} and ${HIGHLIGHT_START}roadmap${HIGHLIGHT_END} review for Q2`
      ),
    ];
    const { container } = render(
      <SearchResultsList
        entries={entries}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onSelectEntry={() => {}}
      />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe("roadmap");
    expect(marks[1].textContent).toBe("roadmap");
    const option = screen.getByRole("option");
    expect(option.textContent).toContain("Sync on roadmap and roadmap review for Q2");
  });
});

describe("keyboard navigation in search results list", () => {
  const threeEntries: Entry[] = [
    entry("A", "Entry A"),
    entry("B", "Entry B"),
    entry("C", "Entry C"),
  ];

  function getSelectedOptionText(): string | null {
    const option = document.querySelector('[role="option"][aria-selected="true"]');
    return option?.textContent ?? null;
  }

  it("when results appear, the first result is automatically selected", () => {
    render(<SearchOverlayWithKeyboard entries={threeEntries} initialSelectedIndex={0} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
    expect(getSelectedOptionText()).toBe("Entry A");
  });

  it("ArrowDown moves selection to the next result", () => {
    render(<SearchOverlayWithKeyboard entries={threeEntries} />);
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    expect(getSelectedOptionText()).toBe("Entry A");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getSelectedOptionText()).toBe("Entry B");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getSelectedOptionText()).toBe("Entry C");
  });

  it("ArrowUp moves selection to the previous result", () => {
    render(<SearchOverlayWithKeyboard entries={threeEntries} initialSelectedIndex={2} />);
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    expect(getSelectedOptionText()).toBe("Entry C");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getSelectedOptionText()).toBe("Entry B");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getSelectedOptionText()).toBe("Entry A");
  });

  it("selection never goes outside the result list bounds", () => {
    render(<SearchOverlayWithKeyboard entries={threeEntries} />);
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    expect(getSelectedOptionText()).toBe("Entry A");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getSelectedOptionText()).toBe("Entry A");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getSelectedOptionText()).toBe("Entry C");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getSelectedOptionText()).toBe("Entry C");
  });
});

describe("Enter key behavior in search overlay", () => {
  const twoEntries: Entry[] = [
    entry("first", "1:1 with Sarah re: roadmap"),
    entry("second", "Review PR for auth refactor"),
  ];

  it("query with results and Enter opens the selected entry", () => {
    const onOpenEntry = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchOverlayWithEnter
        entries={twoEntries}
        selectedIndex={1}
        onOpenEntry={onOpenEntry}
        onClose={onClose}
      />
    );
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenEntry).toHaveBeenCalledTimes(1);
    expect(onOpenEntry).toHaveBeenCalledWith(twoEntries[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("when no result is explicitly selected, Enter opens the first result", () => {
    const onOpenEntry = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchOverlayWithEnter
        entries={twoEntries}
        selectedIndex={0}
        onOpenEntry={onOpenEntry}
        onClose={onClose}
      />
    );
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenEntry).toHaveBeenCalledWith(twoEntries[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("query with zero results and Enter closes the search overlay", () => {
    const onOpenEntry = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchOverlayWithEnter
        entries={[]}
        selectedIndex={0}
        onOpenEntry={onOpenEntry}
        onClose={onClose}
      />
    );
    const input = screen.getByRole("searchbox", { name: "Search thoughts" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenEntry).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("getSearchFeedback", () => {
  it("when there are no matches, returns empty-state message", () => {
    expect(getSearchFeedback([])).toBe("No thoughts found");
  });

  it("when there is one result, returns '1 result'", () => {
    expect(getSearchFeedback([entry("1", "foo")])).toBe("1 result");
  });

  it("when there are multiple results, returns count with 'results'", () => {
    expect(
      getSearchFeedback([
        entry("1", "1:1 with Sarah re: roadmap alignment and hiring plan for Q2"),
        entry("2", "Review PR for auth refactor and add comments by EOD"),
      ])
    ).toBe("2 results");
  });
});
