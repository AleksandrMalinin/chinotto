# Chinotto — Sharing proposal

Product and strategy reference for **private thread sharing**: intentional, calm, read-only handoff of unfinished thinking to one other person.

**Not in scope:** social feed, followers, profiles, likes, public discovery, collaborative documents, publish-to-world.

**Implementation status:** see [sharing.md](sharing.md).

---

## Direction (one choice)

**Private thread links** — the sharer curates a short chronological slice of thinking; the recipient gets a calm, read-only **thread view** built for understanding and conversation, not editing or publishing.

Sharing is handing someone **context**, not a document.

---

## Core sharing philosophy

- Preserve **time** (when each beat happened, what was added later)
- Preserve **voice** (reaction vs context vs open question)
- Signal **non-finality** (“thinking in progress”)
- Require **intent** (explicit selection)
- Stay **small-audience** (one person, maybe two)

The recipient should feel let into an inner monologue over time — not assigned a PDF.

---

## Primary use cases

| Person | Job | What they need |
|--------|-----|----------------|
| Therapist | Process arc between sessions | Continuation blocks, questions, tone shifts |
| Coach | See options, not only conclusions | Flat bullets, parallel paths |
| Partner | Stay in loop without live explanation | Short thread, timestamps |
| Friend | Catch up on what someone’s turning over | Chronological beats |
| Collaborator | Align on decision-in-progress | Context quotes, open questions |

---

## MVP (product)

**Thread link**

1. Select **1–15 entries** (or current thought + thought trail)
2. **Create thread link** — private URL, default **14-day** expiry, **revocable**
3. Recipient opens in **browser** — no Chinotto account
4. **Read-only** view, **oldest → newest**
5. Formatted plain text (paragraphs, bullets, quotes, continuation **Added** labels)
6. Optional **one-line context** from sharer
7. **No recipient write** in MVP

---

## User flow (creator)

```
Stream / Detail → Share thread…
    ↓
Select thoughts · order · expiry · optional note
    ↓
Create link → Copy link · Revoke anytime
```

## User flow (recipient)

```
Open link → Thread view (calm, single column)
    ↓
Read beats in order · footer: read-only · expires …
```

---

## Shared page experience

- Single column ~640px, generous line height
- No sidebar, TOC, hero, read time, or PDF export
- Each **entry = beat**: timestamp + body
- **Continuation**: left accent + “Added {date}” (not full-width section rules)
- Footer: shared read-only · expires · Chinotto

---

## Privacy model

| Rule | Detail |
|------|--------|
| Default | Nothing shared until user creates a link |
| Scope | Only selected entries |
| Transport | HTTPS, unguessable token, `noindex` |
| Lifetime | Expiry + manual revoke |
| Recipient | No account; link is credential |
| Storage | Server holds **slice copy only**; delete on expiry/revoke |
| Local-first | Device remains source of truth |

Share sheet copy: *“A copy of these thoughts will be available at this link until [date]. You can revoke access anytime.”*

---

## Formatting and sharing

Readable plain text **is** the share format (not Markdown, not rich text).

| Primitive | Role when shared |
|-----------|------------------|
| Paragraph breaks | Scan beats without report structure |
| Flat bullets | Parallel exploration |
| `>` blockquotes | External voice vs reaction |
| Question lines | Where to respond in conversation |
| Continuation + Added date | **Differentiator** — evolution, not revision history |

Do not add: headings, bold sections, summaries, key takeaways.

---

## Roadmap

### V2 — Reflection

- Recipient leaves **one reflection per visit** (short text)
- Sharer sees reflections in Chinotto on the thread — not inline in entry body
- Optional single email: “Someone left a reflection” (opt-in)

### V3 — Return thread

- Sharer **appends new entries** to an existing link
- Recipient sees “Updated {date}” on revisit
- Still read-only for recipient

---

## Risks and anti-patterns

| Risk | Mitigation |
|------|------------|
| Performative sharing | No polish tools; unfinished framing; no view stats |
| Link forwarded | Short expiry; revoke |
| Async therapy chat | Bounded reflection, not chat |
| Document expectations | Read-only copy; no edit UI |
| Cloud surveillance feel | Explicit copy-on-share; minimal retention |

**Kill early:** share to feed, link editing, suggest edits, likes, trending shares, SEO landing pages.

---

## Explicitly avoid

- Social graph, public discovery, collaborative editing
- Published / portfolio mode
- Engagement metrics
- Mandatory recipient accounts
- Document templates for “professional sharing”
- Notification firehose

---

## Thought continuity vs documents

**Documents** share state (the answer). **Continuity** shares motion (how thinking moved).

Reject: title, summary, sections, conclusion.

Embrace: dated beats, continuation blocks, open questions, same link updated over time (V3).

**Product object:** **Thread link** — not Shared Document or Shared Page.

---

## Summary

| | Choice |
|---|--------|
| Unit of share | Curated **thread** (1–15 entries) |
| Recipient | Read-only chronological browser view |
| MVP interaction | Create link · copy · revoke |
| V2 | Bounded **reflection** |
| V3 | **Append** to same link |
| Formatting | Readable plain text + continuation dates |

One sentence: *A private, expiring window into how someone’s thinking unfolded — for a person who wasn’t in the room.*
