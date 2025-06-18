### Proposal Packet
*(Red-Team Architect — Definitive Phase II Dossier)*
---

#### 0. Cover Sheet

*   **Project Name:** `diranalyze` - The Trustworthy Blast Radius Analyzer
*   **Version:** Phase II Proposal - v1.0
*   **Date:** 2023-10-27
*   **Prepared For:** Project Stakeholders
*   **Prepared By:** Final Proposal Writer (Synthesizing Red Team Architect Audit and other implicit auditor perspectives)
*   **Core Mandate:** To deliver a rapid, read-only, *trustworthy* risk assessment tool for developers modifying unfamiliar JavaScript/TypeScript codebases.
*   **Previous Red Team Verdict (Initial):** Brittle
*   **Current Red Team Verdict (Post-Revision):** Conditionally Robust (contingent on full implementation of mandated hardening)
*   **Status:** Approved for Phase II development, subject to adherence to defined hardening tasks and roadmap.

---
#### 1. Executive Summary

`diranalyze` is envisioned as a client-side, read-only "Blast Radius Analyzer" for JavaScript/TypeScript codebases. Its primary goal is to provide developers with rapid, trustworthy insights into unfamiliar repositories, specifically answering: "What's Dangerous?", "What's Connected?", and "What's Important?". This is achieved by parsing code locally in the browser using Web Workers and `acorn.js`, then presenting a "Truth Map" of complexity, file inter-dependencies, and symbol-level usage.

The initial concept was deemed "Brittle" by the Red Team due to significant risks in parsing reliability, dependency resolution accuracy, resource management, and transparency of heuristics. The revised vision and development plan directly address these concerns by prioritizing:
*   **Resilient, Multi-File Parsing:** Using a Web Worker pool for parallel, isolated file processing.
*   **Transparent Error Handling:** Clearly indicating unparseable files or incomplete analysis ("No Data is Better Than Bad Data").
*   **Verifiable Metrics:** Using established measures like cyclomatic complexity and direct dependency counts.
*   **Phased Feature Rollout:** Ensuring foundational robustness before tackling advanced symbol-level analysis.

This proposal outlines the development of `diranalyze` as a professional-grade diagnostic utility, focusing on data integrity and user trust. The "Conditionally Robust" verdict hinges on the successful implementation of the mandated hardening tasks, which form the core of the v1.0-v3.0 roadmap. The tool aims to significantly de-risk code modifications in unfamiliar projects, enhancing developer confidence and reducing the likelihood of introducing regressions.

---
#### 2. Problem & User Stories (with KPI table)

**The Core Problem:** Developers assigned to unfamiliar, large, or poorly documented codebases face high cognitive load and significant risk when making changes. The "unknown blast radius" of a modification can lead to unforeseen bugs, system outages, and wasted development effort. Existing IDEs show "what is" but often fail to quickly highlight "what if" or pinpoint structural hazards.

**User Stories:**

*   **Use Case 1: The Bug Hunt (Alex, Mid-Level Developer)**
    *   **As Alex,** a developer new to a critical repository,
    *   **I want to** quickly understand the complexity and interconnectedness of `export-service.js` (related to a bug in "Export to CSV"),
    *   **So that I can** assess the potential impact of my changes beyond the immediate bug ticket scope and avoid breaking related systems like an admin panel or billing.
*   **Use Case 2: The Refactoring Pre-Flight Check (Maria, Senior Developer)**
    *   **As Maria,** a senior developer planning to refactor a legacy `utils.js` file,
    *   **I want to** identify which functions within `utils.js` are most widely used across the application,
    *   **So that I can** make data-driven decisions about how to break the file into smaller modules incrementally and safely, minimizing widespread testing needs for initial changes.

**Key Performance Indicators (KPIs):**

| KPI                                         | Target             | Measurement Method                                       | Primary Auditor Focus        |
|---------------------------------------------|--------------------|----------------------------------------------------------|------------------------------|
| P95 Analysis Time (Medium Repo: 1k-5k files)| < 60 seconds       | Browser Performance API, internal telemetry              | Cost-Performance, UX-Safety  |
| File Parsing Success Rate (Standard JS/TS)  | > 99%              | Automated tests with diverse code samples, error logging | Red-Team, Blue-Team          |
| Critical Dependency Identification Accuracy | > 98%              | Manual audit against test repos with known dependency graphs | Red-Team                     |
| Symbol Usage Tracking Accuracy (v3.0)       | > 95% (qualified)  | Manual audit, specific test cases for re-exports, etc.   | Red-Team                     |
| Max Main Thread Block during Analysis       | < 200 ms           | Browser Performance Profiler                             | UX-Safety, Cost-Performance  |
| UI Responsiveness (Tree Navigation, Panel)  | < 100 ms p95       | User timing, performance profiler                        | UX-Safety                    |
| Unhandled Exception Rate (Client-Side)    | < 0.01% sessions   | Client-side error reporting (opt-in if any)              | Blue-Team, Red-Team          |
| Transparency of Failed Analysis Points      | 100% visible       | UI audit, testing with intentionally corrupt files       | Red-Team, UX-Safety          |

---
#### 3. High-Level System Sketch (ASCII)

```mermaid
graph TD
    User[Developer's Local Machine] --> Browser[Browser Tab: diranalyze.github.io]
    Browser -- Folder Drop --> MainThread[Main UI Thread]
    MainThread -- File Queue --> WorkerPool[Web Worker Pool (N Workers)]
    
    subgraph WorkerPool
        Worker1[Worker 1: acorn.js Parse & Analyze]
        Worker2[Worker 2: acorn.js Parse & Analyze]
        WorkerN[Worker N: acorn.js Parse & Analyze]
    end

    Worker1 -- Results/Errors --> MainThread
    Worker2 -- Results/Errors --> MainThread
    WorkerN -- Results/Errors --> MainThread

    MainThread -- Updates --> UITree[UI: File Tree ("Truth Map")]
    MainThread -- Updates --> UIPanel[UI: Analysis Panel (Complexity, Connectivity, Symbols)]
    MainThread -- Updates --> UIProgress[UI: Progress Bar & Status]

    LocalFS[Local File System: Project Code] --> BrowserAction{User Action: Read Files}
    BrowserAction --> WorkerPool

    style User fill:#fff,stroke:#333,stroke-width:2px
    style Browser fill:#eee,stroke:#333,stroke-width:2px
    style MainThread fill:#lightyellow,stroke:#333,stroke-width:2px
    style WorkerPool fill:#lightblue,stroke:#333,stroke-width:2px
    style LocalFS fill:#ddd,stroke:#333,stroke-width:2px
```

**Description:**
The system is entirely client-side. The user drops a repository folder onto the web page. The Main UI Thread enumerates files and distributes parsing/analysis tasks to a pool of Web Workers. Each worker processes files individually, using `acorn.js` for JavaScript/TypeScript parsing and initial analysis (e.g., complexity metrics, import/export extraction). Results (or errors) are sent back to the Main Thread, which aggregates data and updates the UI (File Tree, Analysis Panel). All file access is read-only from the user's local disk via browser APIs.

---
#### 4. Component Table

| Component           | Role                                                                    | Key Failure Modes                                                                 | Mitigation Strategy                                                                                                                                                             | Peak QPS/Load (Conceptual) |
|---------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| **Main UI Thread**  | Manages UI rendering, user interactions, worker coordination, data aggregation. | UI freeze due to heavy computation, excessive DOM updates, worker message overload. | Offload all parsing/analysis to workers; virtualize large lists/trees; throttle UI updates; robust error handling for worker messages; clear "Cancel Analysis" button.             | N/A (Event-driven)         |
| **Web Worker Pool** | Executes file reading, parsing (`acorn.js`), and per-file analysis.       | Parser crash on malformed syntax, infinite loop in analysis, memory exhaustion per worker. | Per-file try/catch for parsing; timeout per file analysis; structured error reporting to main thread; worker termination/re-creation on fatal error; strict data contracts for results. | N/A (Parallel file ops)    |
| **`acorn.js` Parser** | Parses JavaScript/TypeScript into Abstract Syntax Trees (ASTs).         | Syntax errors, unsupported new language features, performance on extremely large files. | Use latest stable `acorn` with relevant plugins (e.g., for JSX, TypeScript); explicit error reporting for unparseable files; per-file timeouts. Document supported JS/TS versions. | N/A (Per-file invocation)|
| **Analysis Engine** (in Workers) | Calculates complexity, extracts imports/exports, identifies symbols. | Incorrect dependency resolution (esp. dynamic, path aliases), flawed complexity metrics, symbol tracking errors. | Phased implementation (File -> Symbol); integrate `escomplex`; dedicated module for `tsconfig/jsconfig` path resolution; transparent heuristics; confidence scores for symbol analysis. | N/A (Per-file invocation)|
| **UI: File Tree**   | Displays repository structure, complexity heatmap, parsing status.      | Rendering lag with many files, incorrect status display.                         | UI virtualization for large trees; clear visual distinction for parsed, unparsed, error states; tooltips for error details.                                                 | N/A (Event-driven)         |
| **UI: Analysis Panel**| Displays detailed metrics for selected file/symbol.                   | Stale data, misleading information if underlying analysis is incomplete/flawed.  | Update on selection; clearly source data from analysis engine; display confidence scores/caveats; link to heuristic documentation.                                               | N/A (Event-driven)         |

---
#### 5. Assumptions & Constraints

*   **Client-Side Execution:** All processing occurs within the user's browser. No source code or derived metadata is transmitted externally.
*   **Read-Only Access:** The tool only reads files from the local system; it does not write or modify any files.
*   **JavaScript/TypeScript Focus:** Primary support is for `.js`, `.jsx`, `.ts`, `.tsx` files. Analysis of other file types is out of scope.
*   **Modern Browser Dependency:** Requires browser support for Web Workers, File System Access API (or equivalent drag/drop input), and modern ECMAScript.
*   **`acorn.js` Capabilities & Limitations:** Analysis accuracy is fundamentally tied to `acorn.js` (and its plugins') ability to parse the target codebase. Highly experimental or non-standard syntax may not be supported.
*   **Performance Constraints:** Analysis speed is subject to the user's local machine resources and browser performance. There will be practical limits to repository size/complexity.
*   **No Build Step Integration:** The tool analyzes code as-is. It does not run build tools (e.g., webpack, Babel transpilation beyond what `acorn` plugins handle) and may misinterpret dependencies reliant on complex build-time transformations if not reflected in `tsconfig/jsconfig` paths.

---
#### 6. Cost & Performance Budget

*   **Direct Monetary Cost:** $0 (static GitHub Pages hosting, client-side execution).
*   **Indirect Cost (User Time/Resource):**
    *   **Analysis Time:** Target P95 < 60 seconds for medium-sized repositories (1k-5k files, ~100-500MB of JS/TS).
    *   **Browser Memory Usage:** Aim to keep memory footprint manageable, avoiding browser crashes. Workers to discard raw ASTs after processing, main thread to efficiently store aggregated data. **TODO:** Define specific target (e.g., < 1GB for medium repo).
    *   **CPU Usage:** Utilize Web Workers to prevent main thread blocking > 200ms. CPU usage will be high during analysis but should not render the browser unusable.
*   **Resource Abuse Mitigation (Red Team Mandate):**
    *   Master timeout for overall analysis (e.g., 5-10 minutes, configurable or adaptive).
    *   Per-file parsing/analysis timeouts within workers.
    *   Clearly visible "Cancel Analysis" button with prompt termination of workers.
    *   User warnings for excessively large repositories before initiating analysis.
    *   Worker pool sizing strategy (e.g., `navigator.hardwareConcurrency - 1`, capped).

---
#### 7. Data-Integrity & Security Plan

*   **Core Principle: "No Data is Better Than Bad Data."** The system must prioritize accuracy and transparency about its analytical limitations.
*   **Parser Resilience (Hardening Task 1 - Previous Audit):**
    *   Each file parsed in an isolated try/catch block within a Web Worker.
    *   Parsing failures for one file must not affect others.
    *   Detailed error messages (e.g., syntax error, line number) captured and made available in the UI.
*   **Transparency of Analysis (Hardening Task 1 - Previous Audit):**
    *   UI ("Truth Map") must clearly distinguish:
        *   Successfully parsed and analyzed files.
        *   Files that failed parsing (with error details on hover/click).
        *   Files skipped (e.g., non JS/TS, or matching an explicit ignore list - **TODO:** Consider .gitignore support).
*   **Dependency Resolution Accuracy (Hardening Task 2 - Current Audit):**
    *   Robust support for ES Modules, CommonJS.
    *   Critical: Accurate parsing and application of `jsconfig.json`/`tsconfig.json` for path aliases and module resolution. Failures or ambiguities in resolving these paths must be flagged.
*   **Symbol Analysis Integrity (Hardening Task 3 - Current Audit):**
    *   For v3.0 (Symbol Explorer): Implement confidence scoring for symbol usage counts. If analysis is uncertain due to dynamic patterns or complex re-exports, this must be transparently communicated.
*   **Heuristic Transparency (Hardening Task 3 - Previous Audit):**
    *   "Danger Map" (complexity): Based on documented metrics (e.g., cyclomatic complexity via `escomplex`, LOC). Raw metrics exposed in UI.
    *   "Importance" (centrality): Based on quantifiable import counts and symbol usage.
*   **Security (Client-Side Focus):**
    *   **No Data Transmission:** Source code and analysis results remain in the user's browser.
    *   **Supply Chain Integrity:**
        *   Pin exact versions of all dependencies (`acorn.js`, UI libraries) via `package-lock.json` or `yarn.lock`.
        *   Use Subresource Integrity (SRI) for any CDN-hosted libraries.
        *   Regularly audit dependencies for known vulnerabilities (e.g., `npm audit`).
    *   **Malicious Code Input:** While the tool is read-only, parsing malformed or intentionally crafted files could theoretically exploit a vulnerability in `acorn.js` or other dependencies. Mitigation: Worker isolation, timeouts, keeping dependencies updated. The risk to the user's system is low as no code is executed, only parsed.

---
#### 8. Observability & Incident Response

*   **Observability (Client-Side):**
    *   **User-Facing:**
        *   Real-time progress bar: "Analyzing X of Y files..."
        *   Clear error indicators on files in the "Truth Map" with tooltips showing specific parsing errors.
        *   Status messages for overall analysis (e.g., "Analysis complete," "Analysis timed out," "Analysis cancelled").
    *   **Developer/Forensics (Hardening Requirement):**
        *   Implement a detailed, user-accessible session log (downloadable/copyable text).
        *   Log to include: timestamp, browser/OS info (optional/generic), number of files attempted/succeeded/failed, individual file errors, worker statuses, critical timeouts reached, overall analysis duration.
        *   This helps users report issues accurately and aids developers in diagnosing tool limitations on specific codebases.
*   **Anomaly Alerts (Conceptual for Client-Side):**
    *   The tool should alert the user if a very high percentage of files fail to parse (e.g., >25%), suggesting a fundamental incompatibility or widespread issue.
    *   Alert if master timeout is reached, indicating the repository may be too large/complex for current settings.
*   **Incident Response (User-Initiated):**
    *   **"Cancel Analysis" Button (Human Override/Kill-Switch):** Must be prominent and effectively terminate all Web Worker activity and ongoing computations, freeing up resources. This is the primary "kill-switch."
    *   **Browser Controls:** Standard browser stop/refresh/close tab actions serve as ultimate fallbacks.
*   **OpenTelemetry Span Schema:** N/A for purely client-side tool with no backend. If any telemetry (even opt-in error reporting) is added, this would become relevant.

---
#### 9. Privacy & Compliance Mapping

*   **Core Privacy Stance:** All processing is local; no user code or derived metadata leaves the user's browser.
*   **GDPR:**
    *   As no personal data is collected, processed, or stored by any remote server component, GDPR obligations related to data processing by `diranalyze` itself are minimal.
    *   The act of a user selecting a local folder for analysis is user-initiated and data remains local.
    *   **Action:** A clear `PRIVACY.MD` file will state:
        *   All analysis is performed client-side.
        *   No source code or repository data is transmitted from the user's machine.
        *   No cookies are used for tracking beyond standard GitHub Pages behavior (if any).
        *   If opt-in error reporting is ever implemented, its scope, data collected, and purpose will be clearly defined with explicit user consent.
*   **SOC 2:** N/A for a free, client-side, unhosted tool. If this were a commercial SaaS product, relevant controls around data security, availability, processing integrity, confidentiality, and privacy would apply.
*   **Supply-Chain Integrity (Security Control):**
    *   `SECURITY.MD` file outlining responsible disclosure policy for potential vulnerabilities found in `diranalyze` or its dependencies.
    *   Pinning dependencies (SHA-256 for CDNs via SRI) helps ensure the integrity of the delivered code.

---
#### 10. UX & Human-Factors Safeguards

*   **Clarity and Trust:**
    *   **"Truth Map":** UI must honestly reflect analysis limitations (e.g., unparsed files). Avoid presenting incomplete data as complete.
    *   **Transparent Heuristics:** Users should understand *why* a file is "red" (dangerous) or "central." Show underlying metrics.
    *   **Confidence Scores:** For advanced analysis (like symbol tracking), qualify the data's certainty.
*   **Performance and Responsiveness:**
    *   **Non-Blocking UI:** Web Workers are critical to ensure the main UI thread remains responsive during analysis.
    *   **Progress Indication:** Users need constant feedback on long-running operations.
    *   **Cancellation:** Users must be able to abort lengthy operations easily.
    *   **Virtualization:** UI elements (trees, lists) must handle large datasets without freezing.
*   **Error Handling and Recovery:**
    *   Graceful degradation: One failed file parse shouldn't break the entire tool.
    *   Actionable error messages: Provide context for parsing errors where possible.
*   **Cognitive Load Reduction:**
    *   The tool's primary purpose is to simplify complexity. The UI itself must be clean, intuitive, and provide high-signal information quickly.
    *   Default views should highlight the most critical information immediately.
*   **User Workflow Support (as per Use Cases):**
    *   Easy "drop" initiation.
    *   Instant (or near-instant) initial triage view (Danger Map).
    *   Seamless drill-down from file to dependencies and vice-versa.

---
#### 11. Reflection & Iteration Hooks

*   **Initial Red Team Audit (Verdict: Brittle):** Revealed critical flaws in assuming parsing perfection, underestimating dependency complexity, and potential for resource abuse. This forced a fundamental rethink.
*   **User Vision Refinement:** The user's acceptance of the "Brittle" verdict and refinement of the vision towards "The Trustworthy Blast Radius Analyzer" was pivotal. The "No Data is Better Than Bad Data" principle became central.
*   **Second Red Team Audit (Verdict: Conditionally Robust):** Validated that the revised plan (Web Workers, transparent errors, phased rollout, defined hardening tasks) addressed the major concerns. The "conditional" aspect highlights that robustness depends on diligent execution of these tasks.
*   **Iterative Feature Development (Roadmap v1.0-v3.0):**
    *   **v1.0 (Resilient Foundation):** Focuses on core parsing stability and transparent error reporting – directly from Red Team mandates.
    *   **v2.0 (Insight Engine):** Builds file-level dependency graphing on the stable foundation. Complexity metrics enhanced.
    *   **v3.0 (Surgical Loupe):** Tackles the most complex aspect – symbol-level analysis – last, with an emphasis on confidence scoring.
*   **Ongoing Feedback Loop:**
    *   **User Testing:** Crucial for validating heuristics (danger/importance scores) and UI/UX effectiveness with real-world complex codebases.
    *   **Open Issue Tracking (GitHub):** For bugs, feature requests, and community feedback on limitations or desired enhancements (e.g., support for more frameworks, better monorepo handling).
    *   **Periodic Re-Audit (Conceptual):** After major releases (e.g., post-v3.0), a reassessment against new JS/TS features and larger/more complex test cases would be prudent.

---
#### 12. Open Questions & Risks (Table)

| ID  | Question / Risk Area                                     | Description                                                                                                                               | Mitigation / Monitoring Strategy                                                                                                                                | Severity | Probability |
|-----|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|-------------|
| R01 | **Accuracy of Advanced Module Resolution**               | `tsconfig/jsconfig` paths, dynamic imports, complex re-export patterns can be very hard to trace statically.                              | Dedicated module for path resolution (Hardening Task 2). Thorough testing with diverse project setups. Transparently flag unresolved paths or low-confidence links. | High     | Medium      |
| R02 | **Scalability for Extremely Large Repositories**           | Main thread aggregation, memory for graph data, or UI rendering could still become bottlenecks for truly massive codebases (e.g., >50k files). | UI Virtualization (Hardening Task 4). Memory profiling. Consider sampling or partial analysis modes for huge repos as a future feature. Set practical documented limits. | Medium   | Medium      |
| R03 | **Precision of Symbol-Level Tracking (v3.0)**            | Distinguishing true usage vs. type-only, handling name collisions, tracking through complex export chains is non-trivial.                   | Confidence scoring (Hardening Task 3). Focus on common patterns first. Extensive test cases. Document limitations clearly.                                  | High     | High        |
| R04 | **Effectiveness of Complexity Heuristics**               | Default "Danger Score" thresholds might not suit all project types or coding styles.                                                      | Expose raw metrics. Allow potential for user-configurable thresholds (future). Gather feedback on heuristic effectiveness.                                    | Medium   | Medium      |
| R05 | **Evolving JS/TS Language Features & Build Tool Output** | New syntax or transpiled code patterns may break `acorn.js` or analysis logic.                                                            | Keep `acorn.js` and plugins updated. Monitor JS/TS evolution. Community feedback. Version-gate features if needed.                                           | Medium   | Medium      |
| R06 | **Browser API/Performance Inconsistencies**              | Variations in Web Worker performance, File API access, or JS engine speed across browsers/versions.                                       | Test on major target browsers. Define minimum browser versions. Graceful degradation where possible.                                                            | Low      | Medium      |
| R07 | **User Adoption if Trust is Broken Early**                 | If early versions are perceived as unreliable or misleading, rebuilding trust will be difficult.                                            | Prioritize robustness and transparency in v1.0. Adhere strictly to "No Data is Better Than Bad Data."                                                           | High     | Low         |

---
#### 13. Appendices

**Appendix A: Mandated Hardening Tasks (Consolidated from Red Team Audits)**

1.  **Parser Resilience and Granular Error Handling (Original Task 1):**
    *   Wrap all `acorn.js` calls in robust error handling per file within workers.
    *   A single file's parsing failure must not halt analysis for other files.
    *   Failed parses clearly marked in UI with error details.
2.  **Define and Implement Strict Data Contracts for Worker-Main Thread Communication (Evolved Task 1):**
    *   Precisely define data structures workers send to the main thread (minimal, processed info).
3.  **Comprehensive JavaScript/TypeScript Dependency Resolution (Original Task 2) & Robustify TypeScript and Module Path Resolution Strategy (Evolved Task 2):**
    *   Systematically support ES Modules, CommonJS.
    *   Critical: Develop a dedicated, resilient module for parsing `jsconfig.json`/`tsconfig.json` (including `extends`) and resolving path aliases (`paths`, `baseUrl`). This must transparently handle errors.
    *   Document supported ECMAScript/TypeScript versions and known limitations.
4.  **Deterministic and Transparent Heuristics Engine (Original Task 3):**
    *   Complexity: Use `escomplex` (or similar), expose raw metrics, document score calculation.
    *   Centrality: Base strictly on quantifiable import/usage counts.
5.  **Implement Transparent Confidence Scoring for Symbol Analysis (Evolved Task 3 - for v3.0):**
    *   Display confidence scores or qualifiers for symbol usage counts, reflecting analysis certainty. Document heuristics for these scores.
6.  **Web Worker-Based Processing with Resource Safeguards (Original Task 4) & Develop a Scalable Data Aggregation and UI Rendering Strategy for Large Repositories (Evolved Task 4):**
    *   Exclusive use of Web Workers for CPU-intensive tasks.
    *   Configurable timeouts (per-file, overall analysis). Clear "Cancel Analysis" button.
    *   Memory-efficient data aggregation on the main thread.
    *   UI virtualization for large trees/lists.
    *   Worker pool sizing strategy.
7.  **Client-Side Observability & Forensics:**
    *   Implement a user-accessible, detailed session log (downloadable/copyable).
8.  **Supply Chain Integrity & Privacy Documentation:**
    *   Pin dependencies, use SRI.
    *   Maintain `SECURITY.MD` and `PRIVACY.MD`.