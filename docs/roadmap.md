# Roadmap

## 0.1 Bootstrap (Target 2025-07-01)
- [ ] CLI `serve` command; proxy to OpenAI, Anthropic, Ollama  
- [ ] Tree-sitter parsers: Swift & JS  
- [ ] Sketch index builder + budget walker  
- [ ] TruffleHog gate — hard fail  
- [ ] Deterministic hash log v1 (SQLite)

## 0.2 CLI Alpha
- [ ] 10-prompt retrieval benchmark vs. naive FTS  
- [ ] Config file `~/.config/diranalyze.toml` (stores key, model, budget)  
- [ ] GitHub sync script v2 (labels, milestones auto-sync)

## 0.3 GUI Alpha
- [ ] Embedded web-view UI (no Electron)  
- [ ] "Log" tab with live hash stream  
- [ ] Key storage UI (encrypted on disk)

## 0.4 Plugin Runner API
- [ ] gRPC runner interface (`Spawn`, `Exec`, `FetchLog`)  
- [ ] Example Python runner (system interpreter)  
- [ ] Security sandbox spec

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