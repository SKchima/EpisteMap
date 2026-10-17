# Epistemap

Local-first concept mapping and knowledge graph tool with native LaTeX support.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Tests-128%20passed-brightgreen.svg)](https://vitest.dev/)
[![Oxlint](https://img.shields.io/badge/Linter-Oxlint%20(0%20warnings)-blueviolet.svg)](https://oxc.rs/)
[![Local--First](https://img.shields.io/badge/Storage-Local--First-emerald.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

Epistemap is an infinite canvas application for structuring academic notes, mathematical concepts, and course summaries into hierarchical graphs. It stores all data locally in the browser and runs without external network dependencies.

---

## Features

### Hierarchical Compound Nodes
- Nested nodes: create parent concepts containing child sub-nodes.
- Bottom-up sizing: parent node bounds adjust to enclose child nodes.
- Layout auto-organization: Dagre algorithm arranges nodes and edges on command.
- Drill-down: focus view on a single subgraph; breadcrumbs bar navigates up the hierarchy.

### Math and Markdown
- KaTeX rendering: inline (`$...$`) and display (`$$...$$`) formulas.
- WikiLinks: `[[Target Concept]]` syntax creates bidirectional graph edges.
- Unlinked references: missing targets render as `+ [[Concept]]` and create nodes on click.
- Backlinks list: side panel displays nodes that reference the active node.

### LaTeX (.tex) Import
- Parses standard LaTeX documents via the "Import .tex" button.
- Maps `\section` to root nodes and `\subsection` to nested child nodes.
- Converts theorem environments (`\begin{definicao}`, `\begin{teorema}`, `\begin{lema}`, etc.) into tagged sub-nodes.
- Preserves math expressions and cross-references.

### PDF Attachments and Viewer
- Attaches PDF files to nodes (stored as Base64 in the local graph model).
- Embedded side-panel viewer with page navigation and zoom controls.
- External reader option opens the PDF at the referenced page in system readers (e.g., Zathura via `#page=N`).

### Visual Themes
- Three modes: Dark (default), Light, and High-Contrast (black borders on pure white background).
- Persisted in `localStorage`.

### Connection Handles
- Handles remain hidden by default.
- Handles appear on selected nodes and valid target nodes during edge dragging.

### Search (Cmd+K)
- Searches titles, tags, and content text.
- Expands collapsed parent nodes and centers the viewport on the selected node.

### History and Backups
- Undo / Redo: `Cmd+Z` / `Cmd+Shift+Z` via Zundo middleware with typing debounce.
- Full backup (.json): exports graph data including embedded PDFs.
- Lightweight backup (.json): exports graph hierarchy and text without PDF binary data (< 50 KB), suitable for git tracking.
- Local snapshots: manual recovery points stored in `localStorage`.
- PNG export: renders the current graph to a 2x image.

---

## Storage and Privacy

- No external servers, telemetry, or third-party cookies.
- All graph data is stored in the local browser profile (`~/.local/state/epistemap/`).
- The git repository contains application source code and tests. Personal notes remain local and can be exported as lightweight JSON to a private repository.

---

## Installation

### Prerequisites
- Node.js 18+
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
Builds assets into `dist/`.

---

## Linux Desktop Launcher

A shell script runs Epistemap as a standalone Chrome window and terminates the background server when the window closes:

```bash
chmod +x bin/epistemap-launcher.sh
./bin/epistemap-launcher.sh install
```

Commands:
```bash
epistemap         # Starts server and opens app window
epistemap status  # Shows server PID and port
epistemap stop    # Stops background server
epistemap dev     # Starts in development mode with HMR
```

---

