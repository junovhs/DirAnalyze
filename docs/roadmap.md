# DirAnalyze Project Roadmap

This document provides a high-level overview of planned features and development focus for DirAnalyze. For more granular tasks and up-to-date progress, please refer to our GitHub Issues and Milestones.

## Vision
DirAnalyze aims to be a **single-binary development station** that lets you:
*   Paste your **Gemini / OpenAI / local-LLM** key once.
*   Drop in any repo (web, Zig, C/C++, small Swift-PM, basic Python).
*   Chat-drive code edits, builds, and tests **offline** (LLM calls are the only external network activity).
*   Preview results in your browser or on a tethered device.
*   Keep a deterministic, hash-logged record of every action.

## Current Status (as of 2025-05-29)
`v0.2-alpha` – Solid for static-web, Zig and C projects. Windows-GUI spawn, Python runner, and iOS device sideload are in active development. Other features are experimental and off by default.

## Feature Matrix & Targets

| Feature                   | v0.2-alpha (Current) | v0.3 (Target Q4 2025) | Notes                                   |
| ------------------------- | -------------------- | --------------------- | --------------------------------------- |
| LLM Key Integration (UI)  | ✅                    | —                     | Stored in local config.                 |
| FTS + Embedding Ranker    | ✅                    | Improving             | Uses MiniLM-L6; swappable.              |
| Git Commit Helper         | ✅                    | UI Polish             | Simple add/commit/tag.                  |
| **Zig / C / Web** runners | ✅                    | —                     | Build via `zig cc` or `emrun` for WASM. |
| Windows-GUI Spawn         | 🔄 In Development   | ✅                    | No capture yet.                         |
| Python Runner             | 🔄 In Development   | ✅                    | System `python3`; embed later.          |
| iOS Device Sideload       | 🔄 In Development   | Beta                  | Needs libimobiledevice.                 |
| Screen Capture            | ❌ Not Implemented   | Experimental          | ffmpeg / BitBlt; opt-in.                |
| Holoform Graph Index      | ❌ Not Implemented   | Experimental          | Off by default.                         |
| Cross-OS Sandboxing       | ❌ Research Phase    | Research              | Future cgroup/jobobject.                |

## Detailed Roadmap Milestones

### Core 1.0 (Target: End of 2025)
*   **Stable Runners:** Robust and well-tested runners for Zig, C, and Web projects.
*   **Windows GUI Interaction:** Reliable spawning and logging for Windows GUI applications.
*   **Python Integration:** Stable Python runner utilizing the system's Python installation.
*   **Deterministic Logging v1:** Implementation and validation of the foundational deterministic File System Access Layer (FSAL) log schema.
    *   *Note: Runners invoking external tools (e.g., shell, build systems) are version-pinned but their behavior depends on the OS/hardware environment.*
*   **Plugin API (Initial):** First design and implementation of an API for external runners.

### Extended (Target: Q2 2026+)
*   **iOS Device Runner:** Stable sideloading and syslog streaming for iOS devices.
*   **Screen Capture Plugin (Experimental):** Basic screen capture capabilities as an optional plugin.
*   **Embeddable CPython:** Research and potential integration of an embeddable CPython (e.g., 3.12) for a more self-contained Python environment.

### Research (Ongoing - No Specific Dates)
*   **Advanced Context Ranking:** Development of a "Holoform graph" index and smart ranker aiming for >90% precision in code context retrieval for LLMs.
*   **Remote iOS Simulator Mirroring:** Exploring capabilities for mirroring and interacting with remote iOS simulators.
*   **Enhanced Security:** Research and implementation of cross-platform resource sandboxing for increased security when running external code and tools.

---
*This roadmap is a living document and subject to change based on development progress and priorities. Last updated: 2025-05-29.*