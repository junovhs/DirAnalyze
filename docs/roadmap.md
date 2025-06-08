# Roadmap

## 0.1 - UI Prototype (Done - 2025-06-05)
- [x] Browser-based UI for project loading and visualization.
- [x] Live local file editing via the File System Access API.
- [x] AI Debriefing Assistant for context generation.
- [x] AI Patcher with direct local file system writing.
- [x] Removal of obsolete UI components (Combine Mode).

## 0.2 - Core Backend Bootstrap (Target 2025-08-01)
- [x] CLI `serve` command; proxy to OpenAI, Anthropic, Ollama.
- [ ] Tree-sitter parsers: Swift & JS.
- [ ] Sketch index builder + budget walker.
- [ ] TruffleHog gate — hard fail.
- [x] Deterministic hash log v1 (SQLite schema for versioning: ProjectVersions, VersionFiles, OperationLog).
- [x] Backend API for initial project snapshot (Version 0).
- [ ] Frontend: Calculate file hashes & send initial snapshot data.
- [ ] Backend API & Logic for subsequent version snapshots (post-patch).

## 0.3 - CLI Alpha (Planned)
- [ ] 10-prompt retrieval benchmark vs. naive FTS.
- [ ] Config file `~/.config/diranalyze.toml` (stores key, model, budget).
- [ ] GitHub sync script v2 (labels, milestones auto-sync).
- [ ] UI: Display version history timeline.
- [ ] Core: Restore project to a selected version.
- [ ] Backend: Store and use file diffs for versioning.


## 0.4 - GUI Alpha (Planned)
- [ ] Embedded web-view UI (no Electron).
- [ ] "Log" tab with live hash stream (possibly version events).
- [ ] Key storage UI (encrypted on disk).

## 0.5 - Plugin Runner API (Planned)
- [ ] gRPC runner interface (`Spawn`, `Exec`, `FetchLog`).
- [ ] Example Python runner (system interpreter).
- [ ] Security sandbox spec.

---

## Backlog (Deferred)
- Additional Tree-sitter grammars (Python, Zig, C/C++, TypeScript)
- Runner: iOS sideload / debug agent
- Runner: Remote SSH attach
- Patch-generation constraints (tests & secret safety)
- IDE integration (LSP or VS Code plugin)
- Offline LLM support via Ollama / LM Studio
- Search metrics dashboard (token usage, retrieval hit-rate)

Open an issue with the **help-wanted** label to propose or adopt a task.