#!/usr/bin/env python3
"""Print the body under '## <tag>' in a markdown file (GitHub Release body in CI).

Typical path: docs/github-release-notes.md (technical notes; user copy lives on the website).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract-release-notes.py <tag> <markdown-path>", file=sys.stderr)
        return 2
    tag = sys.argv[1].strip()
    path = Path(sys.argv[2])
    if not path.is_file():
        print(f"not found: {path}", file=sys.stderr)
        return 1
    text = path.read_text(encoding="utf-8")
    header = re.compile(rf"^##\s+{re.escape(tag)}\s*$", re.MULTILINE)
    m = header.search(text)
    if not m:
        print(f"no section '## {tag}'", file=sys.stderr)
        return 1
    rest = text[m.end() :]
    nxt = re.search(r"^##\s+v", rest, re.MULTILINE)
    body = rest[: nxt.start()] if nxt else rest
    body = body.strip()
    if not body:
        print("empty section body", file=sys.stderr)
        return 1
    print(body, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
