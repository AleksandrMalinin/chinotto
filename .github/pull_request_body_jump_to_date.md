## Feature
Jump to a calendar date from the main stream: month calendar with local-date dots, scroll to that day’s anchor in the reverse-chronological stream, sticky “Back to now” context, and per-day stream section headers (Today / Yesterday / older dates). Scroll aligns the whole date section with a small top offset (`scrollJumpSectionIntoView`, `1.3rem`).

## Why
Users need to return to a specific day without search or manual scrolling. Capture stays one stream; jump is a navigation affordance on top of the existing entry list.

## Scope
- In scope: Tauri commands `jump_dates_in_month`, `jump_anchor_for_local_date`; `JumpToDatePopover` + trigger near search; stream grouping/section labels; jump context row + auto-clear (scroll back to top, open search, open entry detail, global capture shortcut); `scrollJumpSectionIntoView`; unit/hook tests for jump scroll math and auto-clear; product/architecture/docs alignment.
- Out of scope: new entry fields, sync, filtered “date mode,” search semantics changes, unrelated tray/window refactors.

## Test Plan
- [x] Calendar opens from jump control; days with thoughts show dots; pick a date scrolls to that day’s section with date header visible.
- [x] “Back to now” returns to top; jump context clears when scrolling back near top (after scrolling away), when opening search, when opening an entry, and on global capture shortcut.
- [x] `npm run test:ts` (includes `jumpContextScroll.test.ts`, `useJumpContextAutoClear.test.tsx`).
- [x] `npm run test:rs` / `cargo test` for new DB commands.

## Demo (optional)
- Screenshot or short screen recording of calendar → jump → section + “Back to now”.

## Notes
- Jump anchor is the latest entry on that **local** calendar day (same ordering as stream).
- Tray quick-capture landed earlier on `main` via a separate PR; this branch builds on current app shell.
