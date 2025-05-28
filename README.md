# DirAnalyze — Local LLM Operating Environment for Code

DirAnalyze turns any laptop into a **self‑contained AI coding cockpit** capable of loading → understanding → patching → compiling → previewing software projects **offline** and **framework‑free**.  It ships as **one Zig executable** that embeds its own web UI, deterministic file‑system layer, build runners, and ranking engine so a Large Language Model (LLM) can work effectively on codebases with **hundreds of thousands of lines**.

> **Status (2025‑05‑28):** `v0.2‑alpha` — usable for web + Zig + C projects, with Windows‑GUI & iOS device runners under active development.

---

## 1  Project Vision

DirAnalyze is built for developers who want **absolute, long‑term control** over their tool‑chain while still harvesting the raw productivity of modern LLMs.  The guiding idea is simple: *freeze today’s known‑good environment into a single artifact that an AI can drive deterministically tomorrow, ten years from now, or on an air‑gapped laptop in the Arctic.*  Every design choice flows from that premise.

### Core Principles

**Own every byte**
All UI assets, third‑party libraries, compiler front‑ends, even font files are embedded via `@embedFile` and linked statically.  A SHA‑256 of the executable is the one source of truth; if the hash matches, the behaviour is bit‑for‑bit identical—no CDN, no `npm install`, no system DLL roulette.

**Machine‑first, human‑directed**
The human writes objectives; the LLM issues structured JSON commands (`read_file`, `write_file`, `run_task`).  The browser UI is nothing more than an observability console and a failsafe manual override.

**Deterministic & replayable**
Every filesystem mutation, runner invocation, and LLM prompt/response is recorded in an append‑only SQLite ledger (`ops‑YYYYMMDD.sqlite`).  Replaying that log on the same binary byte‑recreates the working tree—perfect for audits, bisects, or resurrecting a two‑year‑old idea.

**Scalable navigation**
Huge projects stay responsive through a two‑tier index:

* **Fast tier — SQLite manifest :** path ↔ hash ↔ size ↔ language ↔ last‑seen line count.
* **Deep tier — Optional *Holoform* graph :** AST‑derived nodes + edges, string literals, call‑graph slices.  Queries return Top‑N candidate files so the LLM never sees more than \~1 % of the repo.

**Offline by default**
All critical functionality works without Internet.  External calls (package registries, LLM APIs) are behind explicit toggles.  On macOS/iOS you can even build and sideload with the free, 7‑day ad‑hoc certificate—pay Apple only when you’re ready to ship.

**Language‑agnostic core, pluggable power tools**
The binary knows nothing about Swift, Zig, or React internally.  Compilation, testing, and static analysis are farmed out to *runners*—tiny CLI adapters you can drop in or delete without recompiling DirAnalyze.

**Security & privacy**
Runners execute in OS sandboxes (cgroup/jobobject/`sandbox‑exec`) with CPU, memory, and network caps.  LLM prompts never leave the host unless you explicitly point them at a remote endpoint.

**Time‑capsule ready**
Archive `diranalyze‑v1.0.0‑x86_64‑linux` alongside your source tree and you’ll be able to rebuild in 2035 without hunting for a deprecated tool‑chain.

### What “success” looks like

* Clone a 500 k‑line mixed Swift + C++ repo on a train with no Wi‑Fi.
* Drag the folder onto DirAnalyze.
* Type “The export PDF button crashes on iPadOS 18—fix it.”
* The AI returns a patch within a minute, touching only two files.
* Unit tests pass; the iPad sideloaded build shows the fix.
* All of it is logged, committed, and reproducible by anyone who has the binary and the repo.

---

## 2  Architecture Overview

2  Core Principles (Non‑negotiable)

| # | Principle                     | Enforced by                                                                             |
| - | ----------------------------- | --------------------------------------------------------------------------------------- |
| 1 | **Everything embedded**       | `@embedFile` for UI/assets; static link of Zig std + optional libs                      |
| 2 | **Language‑agnostic**         | External *runners* with TOML manifests, invoked through the Task Execution Engine (TEE) |
| 3 | **Deterministic log**         | FSAL writes JSON Lines (`logs/ops‑*.jsonl`) with sha256 of before/after                 |
| 4 | **Strict JSON action schema** | LLM responses are validated; non‑conforming output rejected                             |
| 5 | **Sandbox by default**        | Runners launched in tmpfs + cgroup/JobObject; CPU & RAM quotas                          |

---

## 3  High‑Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│             DirAnalyze (single Zig binary)              │
│ ─ HTTP server (serves static UI, JSON API)              │
│ ─ FSAL  ─ deterministic log + patch engine              │
│ ─ LIM   ─ HTTPS → LLM (curl bindings)                   │
│ ─ CIE   ─ code index  (tree‑sitter + optional Holoform) │
│ ─ Ranker─ multi‑signal Top‑N selector                   │
│ ─ TEE   ─ sandboxed runner execution                    │
└──────▲───────────▲───────────▲──────────────▲──────────┘
       │ UI fetch()│ WebSocket │ spawn()      │ runners/
Browser UI       Logs/preview  Build/Test    Zig/C/Web,
(plain JS)                                WinGUI, iOS…
```

---

## 4  Primary Components

### 4.1  FSAL (File‑System Abstraction Layer)

* CRUD operations with `overwrite|append|patch` modes.
* Unified diff patcher (GNU format).
* SHA‑256 before/after, op log.

### 4.2  CIE (Code‑Introspection Engine)

* Tree‑sitter AST outlines for >20 languages.
* String‑literal & UI‑heuristic extraction.
* Optional **Holoform** graph importer (nodes/edges JSON).
* Stores into SQLite for millisecond queries.

### 4.3  Ranker Pipeline

1. FTS match on literals.
2. UI‑heuristic filter (Button, onClick, IBAction…).
3. Embedding similarity (MiniLM + Faiss).
4. Call‑graph proximity.
5. Git‑blame recency bias.

Top‑25 files (≤100 KB) form the LLM context slice.

### 4.4  TEE (Task Execution Engine)

* Spawns runners under sandbox.
* Captures stdout/stderr, exit code, runtime.
* Logs into FSAL.

### 4.5  Runners (extensible)

| Runner                 | Status | Notes                                   |
| ---------------------- | ------ | --------------------------------------- |
| Zig/C build            | ✅      | Uses `zig cc` / `zig build`             |
| Static‑web preview     | ✅      | Opens browser tab                       |
| Windows GUI            | 🟡     | Spawns EXE, optional BitBlt capture     |
| iOS Device             | 🟡     | `ideviceinstaller` + `rvictl` mirror    |
| iOS Simulator (remote) | 🔜     | SSH -> `simctl` + H.264 relay           |
| Python                 | 🔜     | System `python3`; CPython embed phase 7 |

---

## 5  Feature Roadmap

| Phase | Deliverable                    | Target Date |
| ----- | ------------------------------ | ----------- |
| 0     | Bootstrap HTTP server + FS log | **Done**    |
| 1     | Action schema validator        | **Done**    |
| 2     | Windows GUI runner & capture   | 2025‑06‑30  |
| 3     | iOS device runner (USB)        | 2025‑07‑31  |
| 4     | iOS simulator remote runner    | 2025‑08‑31  |
| 5     | Auto‑update checker            | 2025‑09‑30  |
| 6     | Cross‑OS sandbox quotas        | 2025‑10‑31  |
| 7     | Embed CPython 3.12             | 2025‑12‑31  |
| 8     | Tree‑sitter semantic diff      | 2026‑Q1     |
| 9     | **v1.0 stable**                | 2026‑Q2     |

*If returning after a hiatus, resume with the first incomplete phase.*

---

## 6  Quick Start (alpha)

```bash
# clone
git clone https://github.com/<you>/diranalyze.git
cd diranalyze

# build static binary
zig build -Drelease-safe

# run
./zig-out/bin/diranalyze
# open http://localhost:8787
```

> **Tip:** Add your LLM key under **Settings → Credentials**.  Device & simulator runners require libimobiledevice and/or an SSH‑reachable macOS host.

---

## 7  Example Workflow (iOS app)

1. Create empty repo `brush-manager` and open in DirAnalyze.
2. Chat: *“Scaffold an iPad app that imports .brushset, tags, previews, syncs iCloud.”*
3. LLM asks clarifiers → writes Swift scaffold via FSAL.
4. iOS device runner sideloads to iPad, mirrors UI.
5. Sam presses **Save button**, sees crash log in right panel.
6. Chat: *“Fix the save button crash.”*  Ranker selects 18 candidate files → LLM patches.
7. Green preview, commit via built‑in Git pane.

---

## 8  Tech Stack & Dependencies

* **Language:** Zig 0.12.
* **Bundled libs:** mbedTLS, sqlite‑amalgamated, faiss‑static (optional).
* **Third‑party CLIs:** tree‑sitter, libimobiledevice, ffmpeg (optional), ssh.
* All external executables are detected at runtime and reported in **About → Diagnostics**.

---

## 9  Contribution Guide

* `main` is always green.
* Feature branches: `feat/<topic>`; bugfix: `fix/<issue#>`.
* CI checks: build, unit‑tests, deterministic‑log diff, clang‑format.
* PRs must include **roadmap phase impact** section.

---

## 10  License

DirAnalyze code is **MIT** (see `LICENSE`).  Vendored third‑party tools retain original licenses in `/third_party/`.

---

## 11  FAQ

**Q — Does it work on macOS/Linux/Windows?**  Yes.  Runners are OS‑specific but the core binary builds for all three.

**Q — Why no Electron/UI framework?**  They bloat size, hide bugs, and violate principle #1.

**Q — Offline use?**  100 %. Only LLM calls need network; point LIM to a local llama.cpp endpoint to stay offline.

---

## 12  Appendix A — Holoform Integration

* Holoform graph generator lives in `/runners/holoform/`.
* Outputs `graph.json` with nodes
  `{id, file, span_start, span_end, kind}` and edges `{src, dst, rel}`.
* Imported into SQLite → Ranker uses edge degree for locality boost.

---

Made with pessimism and determinism by **junovhs & contributors**.  Hash it, freeze it, own it.
