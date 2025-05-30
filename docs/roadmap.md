# DirAnalyze Project Roadmap

This document provides a high-level overview of planned features and development focus for DirAnalyze. For more granular tasks and up-to-date progress, please refer to our GitHub Issues and Milestones.

## Vision
DirAnalyze aims to be a **single-binary development station** that lets you:
*   Paste your **Gemini / OpenAI / local-LLM** key once.
*   Drop in any repo (web, Zig, C/C++, small Swift-PM, basic Python).
*   Chat-drive code edits, builds, and tests **offline** (LLM calls are the only external network activity).
*   Preview results in your browser or on a tethered device.
*   Keep a deterministic, hash-logged record of every action.

## Current Status (as of 2025-05-30)
```v0.2.1-alpha``` – AI Debriefing Assistant for AI context packaging implemented. Development is active for LLM Key Integration, Zig Runner, C/C++ Runner, Web Project Runner (for preview), Windows‑GUI spawn, Python runner, and iOS device sideload. Other features are experimental and off by default.

## Feature Matrix & Targets

| Feature                   | v0.2.1-alpha (Current) | v0.3 (Target Q4 2025) | Notes                                   |
| ------------------------- | ---------------------- | --------------------- | --------------------------------------- |
| LLM Key Integration (UI)  | ❌ Not Implemented     | ✅                    | Stored in local config.                 |
| FTS + Embedding Ranker    | ✅                      | Improving             | Uses MiniLM-L6; swappable.              |
| Git Commit Helper         | ✅                      | UI Polish             | Simple add/commit/tag.                  |
| **AI Debriefing Assistant** | ✅                    | UI Polish             | Context packaging for AI collaboration. |
| **Zig Runner**            | 🔄 In Development     | ✅                    | Handles ```zig build```, ```zig test``` etc. |
| **C/C++ Runner**          | 🔄 In Development     | ✅                    | Build via ```zig cc```.                     |
| **Web Runner** (preview)  | ❌ Not Implemented     | ✅                    | Serve static files for browser preview. |
| Windows-GUI Spawn         | 🔄 In Development     | ✅                    | No capture yet.                         |
| Python Runner             | 🔄 In Development     | ✅                    | System ```python3```; embed later.          |
| iOS Device Sideload       | 🔄 In Development     | Beta                  | Needs libimobiledevice.                 |
| Screen Capture            | ❌ Not Implemented     | Experimental          | ffmpeg / BitBlt; opt-in.                |
| Holoform Graph Index      | ❌ Not Implemented     | Experimental          | Off by default.                         |
| Cross-OS Sandboxing       | ❌ Research Phase      | Research              | Future cgroup/jobobject.                |

## Detailed Roadmap Milestones

### Core 1.0 (Target: End of 2025)
*   **LLM Key Configuration (UI & Backend):** Allow users to input and securely store their LLM API key.
*   **AI Debriefing Assistant:** Guided workflow for preparing comprehensive context packages for AI collaboration.
*   **Stable Runners:**
    *   **Zig Runner:** Robust and well-tested runner for Zig projects (handles build commands, logs output).
    *   **C/C++ Runner:** Robust and well-tested runner for C/C++ projects (handles build commands, logs output).
    *   **Web Project Runner:** Ability to serve static web projects for browser preview.
*   **Windows GUI Interaction:** Reliable spawning and logging for Windows GUI applications.
*   **Python Integration:** Stable Python runner utilizing the system's Python installation.
*   **Deterministic Logging v1:** Implementation and validation of the foundational deterministic File System Access Layer (FSAL) log schema.
    *   *Note: Runners invoking external tools (e.g., shell, build systems) are version-pinned but their behavior depends on the OS/hardware environment.*
*   **Plugin API (Initial):** First design and implementation of an API for external runners.
*   **UI Polish:** General improvements to UI/UX, including for the Git Commit Helper.
*   **Ranker Enhancements:** Refinements to FTS + Embedding Ranker.

### Extended (Target: Q2 2026+)
*   **iOS Device Runner:** Stable sideloading and syslog streaming for iOS devices.
*   **Screen Capture Plugin (Experimental):** Basic screen capture capabilities as an optional plugin.
*   **Embeddable CPython:** Research and potential integration of an embeddable CPython (e.g., 3.12) for a more self-contained Python environment.

### Research (Ongoing - No Specific Dates)
*   **Advanced Context Ranking:** Development of a "Holoform graph" index and smart ranker aiming for >90% precision in code context retrieval for LLMs.
*   **Remote iOS Simulator Mirroring:** Exploring capabilities for mirroring and interacting with remote iOS simulators.
*   **Enhanced Security:** Research and implementation of cross-platform resource sandboxing for increased security when running external code and tools.

---
*This roadmap is a living document and subject to change based on development progress and priorities. Last updated: 2025-05-30.*