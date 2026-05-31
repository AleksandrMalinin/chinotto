# Development

## Prerequisites

- Node.js
- Rust
- [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/)

## Run

```bash
npm install
npm run tauri dev
```

Use `npm run tauri dev` (not `npm run dev` alone) for the full desktop app including the Rust backend.

## Test

```bash
npm test
```

Runs Rust tests (`cargo test` in `src-tauri/`) and TypeScript tests (Vitest + Node test runner).

## Build

```bash
npm run tauri build
```

Packaged macOS releases are published via GitHub Releases (tag `v*`).

## Contributing

- Product scope and agent contract: [`AGENTS.md`](../AGENTS.md)
- Commit format: [`docs/internal/commit-convention.md`](internal/commit-convention.md)
- Detailed architecture and product spec: [`docs/internal/`](internal/README.md)
