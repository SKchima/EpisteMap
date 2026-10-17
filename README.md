# Epistemap

> **Scientific Knowledge Modeling, Concept Graphs & LaTeX Compendium Navigation.**  
> *Interactive Concept Mapping, Scientific Notes & Knowledge Graphs — 100% Local-First.*

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?logo=vite)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Tests-128%20passed-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![Oxlint](https://img.shields.io/badge/Linter-Oxlint%20(0%20warnings)-blueviolet.svg)](https://oxc.rs/)
[![Local--First](https://img.shields.io/badge/Storage-100%25%20Local--First-emerald.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🧭 What is Epistemap?

**Epistemap** is an interactive conceptual workspace designed for students, mathematicians, computer scientists, and researchers who need to structure, navigate, and master complex subjects and academic compendiums.

Inspired by the principles of **Spec-Driven Development (SDD)**, epistemology, and modern personal knowledge management (PKM) tools (such as Roam and Obsidian), Epistemap marries the visual freedom of an infinite canvas with the rigor of **LaTeX (KaTeX)**.

---

## ✨ Key Features

### 🧩 1. Hierarchical Structure & Compound Nodes
- **Nested Concepts**: Create root concepts and subdivide them into multi-level child objects without collisions.
- **Bottom-Up Layout Engine**: Container nodes automatically calculate dynamic widths and heights based on their children.
- **Dagre Spatial Auto-Layout**: Rebalance and arrange complex concept graphs with a single click on **"Organize Map"**.
- **Drill-Down & Breadcrumbs**: Focus your viewport onto an isolated concept subgraph or navigate back smoothly via the top breadcrumbs bar.

### 📐 2. Native Mathematics & Markdown
- **Full KaTeX Rendering**: Real-time rendering for inline math (`$E = mc^2$`) and display equations (`$$\int_a^b f(x) dx$$`).
- **Semantic Hyperlinks (`[[WikiLinks]]`)**: Link ideas across concepts by typing `[[Target Concept]]` in any description.
- **Interactive Red Links**: Unlinked concepts appear highlighted (`+ [[New Concept]]`). Clicking one instantly creates the root node, establishes a semantic edge, and opens it for immediate editing.
- **Automatic Backlinks**: The side inspector dynamically aggregates all notes referencing the active concept.

### 📖 3. Direct LaTeX Compendium Importer (`.tex`)
- Import lecture notes, compendiums, and problem sets using the **"Import .tex"** button.
- The parser automatically structures:
  - `\chapter` and `\section` $\rightarrow$ Root concepts / Section containers.
  - `\subsection` and `\subsubsection` $\rightarrow$ Nested hierarchical sub-nodes.
  - Mathematical Environments (`\begin{definicao}`, `\begin{teorema}`, `\begin{lema}`, `\begin{corolario}`, `\begin{exemplo}`, etc.) $\rightarrow$ Child nodes tagged `#definicao`, `#teorema`, etc.
  - Cross-references (`\ref`, `\eqref`) and KaTeX expressions preserved verbatim.

### 📄 4. PDF Attachment & Embedded Reader
- **Self-Contained Attachments**: Attach reference PDFs to any concept with Base64 storage embedded directly in the graph JSON.
- **Inspector Split View**: Read, zoom, and navigate pages (Previous, Next, Jump to Page) without leaving the canvas.
- **Native Reader Jump (Zathura)**: Quick button to open the PDF directly at the current reference page in your Linux native reader (e.g. Zathura via `#page=N`).

### 🎨 5. Three Distinct Visual Themes
- **Dark (Default)**: `#0d1017` dark aesthetic tuned for low-light research sessions.
- **Light**: Clean neutral background (`#f8fafc`) for daytime work.
- **High-Contrast Paper / Print**: Pure white canvas (`#ffffff`), solid black borders (`2px solid #000000`), and absolute black typography (WCAG AAA compliant), tailored for reading and exporting directly to printed compendiums.

### 🎯 6. Smart Connection Handles
- Lateral connection handles are **completely invisible by default**, keeping the canvas clutter-free.
- Handles become visible on the active node when selected.
- When dragging a new edge, target handles appear dynamically across compatible nodes and scale up on hover for effortless snapping.

### 🔍 7. Global Spotlight Search (`Cmd+K`)
- Spotlight-style command palette searching titles, tags, and body content in real time.
- **Smart Navigation**: Jumping to a hidden or nested concept automatically unfolds collapsed ancestors and animates smooth camera centering onto the target node.

### ⏪ 8. Temporal History (Undo / Redo) & Backup Management
- **Undo / Redo**: Full `Cmd+Z` and `Cmd+Shift+Z` support powered by `zundo` middleware with keystroke debounce coalescing.
- **Full Backup (.json)**: Export complete self-contained graphs with Base64-embedded PDFs.
- **Lightweight Backup (.json)**: Strips heavy Base64 binary payloads (< 50 KB), perfect for versioning in your personal git notes repo (e.g., `ygg`).
- **Local Snapshots**: Save named recovery checkpoints directly in browser storage to experiment risk-free.
- **2x Retina PNG Export**: High-resolution image snapshots capturing the entire visible knowledge graph.

---

## 🔒 Security, Privacy & Local-First Architecture

- **Zero Cloud / Zero Telemetry**: Epistemap never contacts external servers, tracking services, or cloud APIs.
- **Local Isolation**: All graph data resides strictly within your local browser storage (`~/.local/state/epistemap/`).
- **Separation of Open Source Code and Personal Data**:
  - The public Epistemap repository contains **only the application source code and synthetic acceptance tests**.
  - Your actual notes and study maps remain private on your machine and can be backed up to your personal notes repo (e.g. `~/repos/ygg/epistemap-backups/`).

---

## 🚀 Installation & Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/SKchima/EpisteMap.git
cd EpisteMap
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```
Production assets are generated in `dist/` with modular code splitting (KaTeX, React Flow, Markdown, and Vendor chunks) for instant loading.

---

## 🐧 Linux Desktop Integration (Rofi / Hyprland / Sway / GNOME)

Epistemap includes an intelligent standalone launcher that runs the map as an isolated desktop app (without browser tabs or URL bars):

```bash
# 1-Click desktop integration (installs ~/.local/bin/epistemap and .desktop for Rofi):
chmod +x bin/epistemap-launcher.sh
./bin/epistemap-launcher.sh install
```

### Terminal Commands
```bash
epistemap         # Starts background server and launches the app window
epistemap status  # Displays running server PID and port status
epistemap stop    # Gracefully terminates the background server
epistemap dev     # Launches in development mode with Hot Module Reloading (HMR)
```

> **1-to-1 Lifecycle**: The background server monitors the app window and automatically shuts down when you close the window (e.g. `Super + Q`), preventing orphaned Node processes on port `5173`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd + K` / `Ctrl + K` | Open Global Search Palette |
| `Cmd + ,` / `Ctrl + ,` | Open Settings, Backups & Snapshots Modal |
| `Cmd + Z` / `Ctrl + Z` | Undo last graph modification |
| `Cmd + Shift + Z` / `Ctrl + Y` | Redo last reverted modification |
| `Tab` | Create a child concept inside the selected node |
| `Enter` | Create a sibling concept (same parent as selected) |
| `Delete` / `Backspace` | Delete selected node or edge (with confirmation prompt if node has children) |
| `Esc` | Clear active selection; if none, drill-up one level |
| Double-click on canvas | Create a new root concept at click coordinates |

---

## 🧪 Code Quality & Acceptance Tests

Epistemap is engineered following **Spec-Driven Development (SDD)** with exhaustive test coverage:

```bash
# Run the complete test suite (128 acceptance tests via Vitest)
npm test

# Run Oxlint (0 warnings, 0 errors guaranteed)
npm run lint

# Strict TypeScript typechecking and production build
npm run build
```

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
