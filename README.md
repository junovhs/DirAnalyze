# DirAnalyze

*The tiny, local-first AI cockpit for huge codebases.*

- **Single binary (planned)** – no Docker, no Node, no Python runtime
- **Paste-and-go (planned)** – drop a repo, paste your LLM key, start coding
- **Hierarchical Semantic Sketch (planned)** – budget-bounded tree of package → file → symbol summaries; ships only what the model needs
- **Hard secret gate (planned)** – TruffleHog scan; refuses to leak keys or tokens
- **Deterministic hash log (planned)** – every file, prompt and diff recorded for audit/replay
- **MIT licence** – fork it, remix it, just keep the header

> **Security advisory** DirAnalyze is **not sandboxed**. You are editing your local file system directly. Run trusted code only.
> **Status** Alpha: The core UI workflow is functional. The Rust backend is in progress.

---

## 1 Why bother?

| Pain elsewhere                           | DirAnalyze answer                                        |
|-----------------------------------------|----------------------------------------------------------|
| 15 GB IDE + plugin maze                 | Aims for a <5 MB static binary, zero installers (planned)|
| "Paste whole repo into ChatGPT" bloat   | Sketch index will narrow prompts to ≈ 10k tokens (planned)|
| Copy-prompt-paste loop                  | JSON patch actions applied directly to local files       |
| Cloud snooping fears                    | Runs offline; only your chosen LLM endpoint sees code    |
| No trace of what AI changed             | Deterministic hash log for full replay (planned)         |

---

## 2 Current state (2025-06-06)

| Component                      | State                | Notes                                                      |
|--------------------------------|----------------------|------------------------------------------------------------|
| Backend (Rust)                 | **in progress**      | Basic web server and LLM proxy are functional.             |
| Browser UI (HTML/JS/CSS)       | Functional Prototype | Uses the File System Access API for live local editing.    |
| Hierarchical Sketch            | spec drafted         | Parsing and indexing logic not yet implemented.            |
| AI Patcher Workflow            | functional           | Can apply CAPCA patches directly to the local disk.        |
| AI Debriefing Assistant        | functional           | Core workflow for packaging context is implemented.        |

---

## 3 Quick start

1.  Clone the repository and install the [Rust toolchain](https://rustup.rs/).
2.  Install the required [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
3.  Navigate to the `backend` directory and run `cargo run`.
4.  Open `http://127.0.0.1:8000` in a modern browser (Chrome, Edge).
5.  Drop your project folder onto the UI and grant read/write permissions.

---

## 4 Roadmap snapshot

| Version | Focus                                                  | State           |
| ------- | ------------------------------------------------------ | --------------- |
| 0.1     | Functional UI Prototype & Live Local Editing           | **done**        |
| 0.2     | Core Backend Bootstrap & Sketch Indexing               | **in progress** |
| 0.3     | Retrieval Benchmark & CLI Polish                       | planned         |

Full details in [`docs/roadmap.md`](./docs/roadmap.md).

---
## 5 Design principles

1.  **Own the stack** – every byte needed to rebuild lives in the repo
2.  **Deterministic first** – hash every read/write, prompt, diff
3.  **Machine-first interface** – LLM sends JSON actions; UI is a viewer
4.  **Small surface first** – core features only; experiments behind flags
5.  **Offline by default** – network hits only the LLM HTTPS target you set

---

## 6 Planned architecture
'''
Browser UI ── fetch/ws ──┐
▼
DirAnalyze binary (HTTP+WS, index, log, proxy)
▲
external LLM HTTPS│ optional runners (zig cc, swiftc…)
'''
*Diagram represents target design; not yet implemented.*

---

## 7 Limitations

*   Not an IDE – no IntelliSense or refactor-rename yet
*   Non-GNU tool-chains need custom runners
*   Full determinism depends on pinned versions of external CLIs
*   Security isolation is research-phase; run trusted code only

---

## 8 Contributing

1.  Fork → branch `feat/<topic>`
2.  Keep docs and tests in sync
3.  Follow [`docs/git_conventions.md`](./docs/git_conventions.md)

Good-first-issue tags are up for grabs; PRs welcome.

---

## 9 License

MIT for core source. Third-party tools retain their original licences.
