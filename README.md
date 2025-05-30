# DirAnalyze

*The tiny, local-first AI cockpit for huge codebases.*

- **Single binary (planned)** – no Docker, no Node, no Python runtime  
- **Paste-and-go (planned)** – drop a repo, paste your LLM key, start coding  
- **Hierarchical Semantic Sketch** – budget-bounded tree of package → file → symbol summaries; ships only what the model needs  
- **Hard secret gate** – TruffleHog scan; refuses to leak keys or tokens  
- **Deterministic hash log** – every file, prompt and diff recorded for audit/replay  
- **MIT licence** – fork it, remix it, just keep the header  

> **Security advisory** DirAnalyze is **not sandboxed**. Running untrusted code is dangerous.  
> **Status** Pre-alpha: nothing usable today; see the roadmap.

---

## 1 Why bother?

| Pain elsewhere                           | DirAnalyze answer (planned)                              |
|-----------------------------------------|----------------------------------------------------------|
| 15 GB IDE + plugin maze                 | < 5 MB static binary, zero installers                   |
| "Paste whole repo into ChatGPT" bloat   | Sketch index narrows prompts to ≈ 10 k tokens            |
| Copy-prompt-paste loop                  | JSON actions applied atomically via local cockpit        |
| Cloud snooping fears                    | Runs offline; only your chosen LLM endpoint sees code    |
| No trace of what AI changed             | Deterministic hash log for full replay                   |

---

## 2 Current state (2025-06-02)

| Component                      | State           |
|--------------------------------|-----------------|
| Zig/Rust/Go backend            | not started     |
| Tree-sitter parsers (Swift/JS) | **todo**        |
| Sketch index builder           | spec drafted    |
| TruffleHog gate                | CLI stubbed     |
| Deterministic log v1           | schema drafted  |
| Browser UI                     | prototype only  |
| Benchmarks                     | design pending  |

---

## 3 Quick start (placeholder)

```bash
# binary not published yet
./diranalyze serve path/to/my/repo
# browser will open at http://localhost:8080
```

---

## 4 Roadmap snapshot

| Version | Focus                                                  | State           |
| ------- | ------------------------------------------------------ | --------------- |
| 0.1     | Round-trip prompt, sketch index, secret gate, hash log | **in progress** |
| 0.2     | Retrieval benchmark & CLI polish                       | planned         |
| 0.3     | Embedded browser UI                                    | planned         |
| 0.4     | Runner plugin API                                      | planned         |

Full details in [`ROADMAP.md`](./ROADMAP.md).

---

## 5 Design principles

1. **Own the stack** – every byte needed to rebuild lives in the repo
2. **Deterministic first** – hash every read/write, prompt, diff
3. **Machine-first interface** – LLM sends JSON actions; UI is a viewer
4. **Small surface first** – core features only; experiments behind flags
5. **Offline by default** – network hits only the LLM HTTPS target you set

---

## 6 Planned architecture

```
Browser UI ── fetch/ws ──┐
                         ▼
         DirAnalyze binary (HTTP+WS, index, log, proxy)
                         ▲
       external LLM HTTPS│   optional runners (zig cc, swiftc…)
```

*Diagram represents target design; not yet implemented.*

---

## 7 Limitations

* Not an IDE – no IntelliSense or refactor-rename yet
* Non-GNU tool-chains need custom runners
* Full determinism depends on pinned versions of external CLIs
* Security isolation is research-phase; run trusted code only

---

## 8 Contributing

1. Fork → branch `feat/<topic>`
2. Keep docs and tests in sync
3. Follow [`docs/git_conventions.md`](./docs/git_conventions.md)

Good-first-issue tags are up for grabs; PRs welcome.

---

## 9 License

MIT for core source. Third-party tools retain their original licences.