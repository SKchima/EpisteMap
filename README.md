# EpisteMap

Local-first visual workspace for structuring academic notes, mathematical concepts, and lecture compendiums into interactive hierarchical knowledge graphs.

---

## Purpose

EpisteMap is designed for studying and organizing dense academic subjects. It allows you to:
- Structure topics into nested concept hierarchies.
- Write mathematical formulas using standard LaTeX notation.
- Connect concepts across subjects using bidirectional WikiLinks.
- Import LaTeX (`.tex`) documents directly into structured concept nodes.
- Attach reference PDFs and read them in a side panel alongside your notes.
- Keep all data local and private on your machine without external cloud dependencies.

---

## Features

### Hierarchical Concepts
- Nested nodes: create parent concepts containing child sub-nodes.
- Dynamic boundaries: parent containers automatically size to fit their children.
- Automatic layout: rearrange nodes and connections with one click.
- Drill-down: isolate view to a specific subgraph with breadcrumb navigation.

### Math and Hyperlinks
- LaTeX formulas: support for inline (`$...$`) and display (`$$...$$`) mathematical typesetting.
- Bidirectional WikiLinks: `[[Concept Name]]` creates navigable links between nodes.
- Unlinked references: missing targets appear as `+ [[Concept]]` and create new nodes on click.
- Backlinks: the side panel lists all notes that reference the active node.

### LaTeX (.tex) Import
- Converts `\section` to root concepts and `\subsection` to child nodes.
- Parses theorem environments (`definicao`, `teorema`, `lema`, `corolario`, `exemplo`) into tagged nodes.
- Preserves mathematical formulas and reference tags.

### PDF Attachments and Reader
- Direct local disk linking (`filePath`) avoiding multi-megabyte Base64 payload bloat in `vault.json`.
- Embedded side-panel reader streaming local PDFs via `/api/pdf?path=...` with page navigation and zoom.
- 1-click native opening in Zathura at the exact referenced page (`POST /api/open-pdf`).

### History and Backups
- Undo and redo support.
- Lightweight JSON export (< 50 KB): exports text and topology without binary data, suitable for version control.
- Full JSON export: includes embedded PDF files for moving between machines.
- Local snapshots: save recovery checkpoints directly in the browser.
- High-resolution image export: capture the entire visible graph to a 2x image.

---

## Storage and Privacy

- No external servers, analytics, or cookies.
- All notes and graph data reside in the local browser profile (`~/.local/state/epistemap/`).
- The git repository contains only application source code. Personal notes can be backed up as lightweight JSON to a private repository.

---

## Installation

### Prerequisites
- Node.js 22+
- npm

### Clone and Install
```bash
git clone https://github.com/SKchima/EpisteMap.git
cd EpisteMap
npm install
```

### Development
```bash
npm run dev
```
Runs at `http://localhost:5173`.

### Production Build
```bash
npm run build
```
Builds production assets into `dist/`.

---

## Linux Desktop Launcher

A shell script runs EpisteMap as a standalone Chrome window and terminates the background server when the window closes:

```bash
chmod +x bin/epistemap-launcher.sh
./bin/epistemap-launcher.sh install
```

Commands:
```bash
epistemap            # Starts production preview server and opens app window
epistemap dev        # Starts in development mode with live HMR
epistemap status     # Shows server PID and port
epistemap stop       # Stops background server
epistemap uninstall  # Removes desktop shortcuts and CLI symlink
```

### Application Launcher & Rofi Integration

Running `./bin/epistemap-launcher.sh install` automatically installs two desktop entries in `~/.local/share/applications/`:

- **`EpisteMap`**: Launches the compiled production preview application.
- **`EpisteMap (Dev)`**: Launches Vite in development mode with live Hot Module Reloading (HMR) for real-time development tracking. Closing the window cleanly terminates the development server.

---

## Local Vault & CLI Automation

EpisteMap synchronizes bidirectionally with a local file on disk (`~/notes/epistemap/vault.json`). Modifying the file triggers real-time updates in the application through Server-Sent Events (SSE).

The included CLI utility enables inspection and modification via terminal or AI agents:

```bash
node bin/epistemap-cli.mjs status
node bin/epistemap-cli.mjs list
node bin/epistemap-cli.mjs add --title "Sobolev Spaces" --parent "Functional Analysis" --desc "Definition..."
node bin/epistemap-cli.mjs connect --source "Sobolev Spaces" --target "Weak Derivatives" --label "generalizes"
node bin/epistemap-cli.mjs get --title "Sobolev Spaces"
```

### LaTeX Compendium Synchronization (SyncTeX & Zathura)

EpisteMap features an automated indexing engine that parses compiled LaTeX documents and builds hierarchical knowledge graphs without duplicating source code or bloating the vault:

- **SyncTeX Page Mapping**: Decompresses `.build/main.synctex.gz` to map each `\section`, `\subsection`, and formal environment (`definicao`, `teorema`, `lema`, `corolario`, `proposicao`, `exemplo`, `exercicio`) to its exact 1-indexed page in the compiled PDF.
- **Deep-Linked Concept Nodes**: Each formal block becomes a node containing clean KaTeX-ready Markdown, extracted concept subtitles, and direct pointer metadata `{ filePath, page }`.
- **Idempotent Updates**: Re-running the synchronization updates existing nodes in-place, preserving canvas layouts and custom manual edges.
- **TikZ Decoupling**: Replaces complex TikZ or quiver diagrams with clean pointers to the exact PDF page, ensuring KaTeX rendering stability.

Commands:
```bash
# Synchronize all compendiums discovered under latex-projects
npm run sync:latex
# Or specify a custom root directory
node bin/epistemap-cli.mjs sync-compendios --root "/path/to/latex-projects"

# Index a single LaTeX project or main.tex (optional --compile flag invokes latexmk)
node bin/epistemap-cli.mjs index-latex "/path/to/project" --compile
```

---

## Technical Specifications & Architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Tests-135%20passed-brightgreen.svg)](https://vitest.dev/)
[![Oxlint](https://img.shields.io/badge/Linter-Oxlint%20(0%20warnings)-blueviolet.svg)](https://oxc.rs/)
[![Local--First](https://img.shields.io/badge/Storage-Local--First-emerald.svg)]()

### Stack
- **Core Framework**: React 19, TypeScript, Vite.
- **Canvas & Graph Engine**: React Flow (`@xyflow/react`), Dagre hierarchical layout algorithm.
- **Mathematics & Markup**: KaTeX (`remark-math`, `rehype-katex`), custom LaTeX AST parser.
- **State & Temporal History**: Zustand with Zundo undo/redo middleware and input debounce coalescing.
- **Local Vault Sync**: Node `fs.watch` and Server-Sent Events (SSE) bridge.
- **Linter & Test Suite**: Oxlint (0 warnings across 152 rules), Vitest (135 acceptance tests).
