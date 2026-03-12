# Chinotto – Product spec

## Summary

Chinotto is a minimal desktop thinking tool for instantly capturing thoughts and recovering context later. It targets people who handle a lot of information, flows, decisions, and ideas every day and need a simple place to dump thoughts without organizing them up front.

## Philosophy

- **Capture first, structure later**
- No workspace overhead
- No document mindset
- No manual organization at write time

## Constraints

- Desktop app only
- Local-first
- Single-user
- No sync (for now)
- No collaboration
- No auth
- No cloud dependencies
- No pages, folders, or documents
- No markdown editor
- No tasks, kanban, or templates
- No AI chat
- No embeddings (yet)
- One canonical entity only: **Entry**

## MVP flows

### 1. Capture

- Open the app
- Input is focused immediately
- User starts typing right away
- Pressing Enter creates a new entry

### 2. Stream

- Entries shown in reverse chronological order
- Minimal timeline-like structure

### 3. Search

- Full-text search across entries
- Very fast and simple

## Data model

**Entry**

| Field       | Type   | Notes        |
|------------|--------|--------------|
| id         | string | Primary key  |
| text       | string | Content      |
| created_at | string | ISO 8601 UTC |
