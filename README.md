# DirAnalyze — Local LLM Coding Cockpit

⚠️ Security Advisory

DirAnalyze is not sandboxed. Running untrusted code is dangerous. Use caution when loading third-party projects. Full security isolation is a Research goal and not part of Core 1.0.

DirAnalyze is a **single‑binary development station** that lets you:

* paste your **Gemini / OpenAI / local‑LLM** key once,
* drop in any repo (web, Zig, C/C++, small Swift‑PM, basic Python),
* chat‑drive code edits, builds, and tests **offline**,
* preview results in your browser or on a tethered device,
* and keep a deterministic, hash‑logged record of every action so you can replay or audit the work months later.

It runs on Windows 10+, macOS 13+, and most modern Linux distros—no installers, no package managers, no cloud calls except the LLM endpoint you configure.

> **Current status (2025‑05‑29):** `v0.2.1‑alpha` – solid for static‑web, Zig and C projects. AI Debriefing Assistant added. Windows‑GUI spawn, Python runner, and iOS device sideload are in active development. Everything else is marked **experimental** and off by default.

---

## Why bother?  (Core advantages)

| Pain elsewhere                             | DirAnalyze answer                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| 15 GB IDE + plugin maze                    | < 5 MB static Zig binary, zero installers.                                |
| NPM audit hell & CDN outages               | All assets baked into the binary you can hash today and run in 2035.      |
| LLM context bloat                          | Local index (FTS + embeddings) narrows prompts to ≈ 30 files, not 30 000. |
| “Copy prompt → paste AI → copy patch” loop | One **/api/action** call per edit; the UI does the plumbing for you.      |
| Fear of cloud snooping                     | Runs offline; only your LLM endpoint sees code, and you choose which one. |

---

## 1  Design principles

1. **Own the stack** – the repo contains every byte needed to rebuild; external CLIs are version‑pinned in `/third_party/manifest.lock`.
2. **Deterministic log** – every FS write, runner spawn, and LLM prompt/response hash is appended to a SQLite journal so a future run can replay or diff behaviour. *Runners that invoke external tools (e.g., shell, build systems, device tools) are version-pinned but not frozen in behavior. Re-execution may vary depending on OS/hardware environment.*
3. **Machine‑first interface** – the LLM sends JSON actions like `{ "op": "patch", "path": "src/foo.zig", … }`.  Human UI is a thin viewer.
4. **Small surface first, power later** – core runners do only spawn + log; screen capture, simulators, sandboxing, and Holoform graphs are opt‑in experiments.
5. **Offline by default** – network is used only for the LLM HTTPS target you configure.

---

## 2  How it works (high‑level)

```
┌────────── Browser UI (static HTML/JS) ──────────┐
│  • file tree  • chat  • diff viewer  • logs     │
└────▲───────────────fetch/WebSocket────────▲─────┘
     │                                       │
     │           DirAnalyze (zig exe)        │
     │   ─ HTTP server & static assets       │
     │   ─ FSAL  + deterministic log         │
     │   ─ Ranker (FTS + MiniLM embeddings)  │
     │   ─ Runner registry (zig/c/web/…)     │
     │   ─ LLM proxy (curl TLS, key in cfg)   │
     ▼                                       ▼
  source repo                          external CLI
                                       (only when
                                        runner needs)
```

*On first load* DirAnalyze indexes the repo, stores hashes + string literals + embeddings in SQLite, and serves the UI.  Edits flow as JSON actions, applied atomically; the LLM never sees more than the ranked slice of code you allowed. *Runners that invoke external tools (e.g., shell, build systems, device tools) are version-pinned but not frozen in behavior. Re-execution may vary depending on OS/hardware environment.*


---

## 3  Quick start

```bash
# 1. clone
$ git clone https://github.com/<you>/diranalyze.git && cd diranalyze

# 2. build static binary
$ zig build -Drelease-safe   # < 20 s on a laptop

# 3. run
$ ./zig-out/bin/diranalyze
# open http://localhost:8787  (first run prompts for LLM key)
```

Requirements: Zig 0.12 nightly or newer.  On Windows, run from PowerShell; on macOS, `codesign --remove-signature` is not needed.

---

## 4  Feature matrix

| Feature                   | v0.2.1‑alpha | v0.3 (target '25‑Q4) | Notes                                   |
| ------------------------- | ------------ | -------------------- | --------------------------------------- |
| Paste LLM key (UI)        | ✅            | —                    | Stored in local config.                 |
| FTS + embedding ranker    | ✅            | improving            | Uses MiniLM‑L6; can swap.               |
| Git commit helper         | ✅            | UI polish            | Simple add/commit/tag.                  |
| **AI Debriefing Assistant** | ✅          | UI Polish            | Context packaging for AI.               |
| **Zig / C / Web** runners | ✅            | —                    | Build via `zig cc` or `emrun` for WASM. |
| Windows‑GUI spawn         | 🔄 dev       | ✅                    | No capture yet.                         |
| Python runner             | 🔄 dev       | ✅                    | System `python3`; embed later.          |
| iOS device sideload       | 🔄 dev       | beta                 | Needs libimobiledevice.                 |
| Screen capture            | ❌            | experimental         | ffmpeg / BitBlt; opt‑in.                |
| Holoform graph index      | ❌            | experimental         | Off by default.                         |
| Cross‑OS sandboxing       | ❌            | research             | Future cgroup/jobobject.                |

---

## 5  Roadmap snapshot (freeze 2025‑05‑29)

**Core 1.0 (ship 2025‑12‑31)**

* Stable Zig/C/Web runners
* Windows‑GUI spawn + log
* Python runner (system)
* Deterministic FS log schema v1 *Runners that invoke external tools (e.g., shell, build systems, device tools) are version-pinned but not frozen in behavior. Re-execution may vary depending on OS/hardware environment.*
* Plugin API for external runners
* **AI Debriefing Assistant** (Context packaging)

**Extended (2026‑Q2+)**

* iOS device runner (sideload + syslog)
* Basic screen capture plugin
* Embeddable CPython 3.12

**Research (no dates)**

* Holoform graph + smart ranker >90 % precision
* Remote iOS simulator mirroring
* Cross‑platform resource sandboxing

---

## 6  Limitations (know before you dive)

* Not an IDE—no IntelliSense, no refactor‑rename yet.
* Non‑GNU tool‑chains (MSVC, big Xcode projects) require custom runners.
* Full determinism depends on pinned versions of external CLIs; future OS changes may break them.
* Security: running un‑trusted code is **unsafe** until sandbox research matures.

---

## 7  Contributing

* Clone → create branch `feat/<topic>` → run `zig build test` → open PR.
* Keep docs + README in sync; every feature must add a log‑replay test.
* Experimental features belong behind `--feature <flag>`.

---

## 8  License

MIT for core source.  Third‑party CLI tools are under their original licenses—see `/third_party/`.

## Project Management & Conventions

For details on our development process, Git conventions, and project roadmap, please see the following documents in the `/docs` folder:

*   [**Git Conventions (`docs/git_conventions.md`)**](./docs/git_conventions.md): Guidelines for commit messages, branching, and pull requests. Essential for contributors and for AI-assisted commit generation.
*   [**Project Roadmap (`docs/roadmap.md`)**](./docs/roadmap.md): A detailed outline of planned features and development milestones.