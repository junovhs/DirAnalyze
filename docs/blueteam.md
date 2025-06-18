### Proposal Packet
*(Blue-Team Resilience Lead — Definitive Phase II Dossier)*
---

#### 0. Cover Sheet

**Project Name:** diranalyze (The Codebase MRI)

**Version:** Phase II Proposal - v1.0 (Consolidated - Blue Team Strand)

**Prepared For:** Project Stakeholders

**Core Mandate (Blue Team):** Ensure `diranalyze`, when deployed, is highly observable, resilient to known and unknown failure modes, and equipped with robust incident response capabilities to meet or exceed MTTR/MTTD targets. The system must degrade gracefully and provide clear diagnostics for both users and the development team.

**Origin of this Strand:** This document represents the Blue-Team Resilience Lead's finalized input, incorporating findings and action plans from the Observability & Incident Response Audit (dated October 26, 2023) and the subsequent project commitment to a comprehensive, two-track resilience and observability strategy.

---

#### 1. Executive Summary

This Blue-Team Resilience strand of the `diranalyze` Phase II proposal outlines the strategy for achieving production readiness through comprehensive observability, robust resilience engineering, and proactive incident response. The initial focus on client-side fault tolerance has been significantly expanded to include a full-fledged, opt-in telemetry system, formalized OpenTelemetry adoption, defined SLOs, proactive monitoring, and a clear CI/CD pipeline with rollback capabilities.

The core principle is that `diranalyze` must not only be resilient in a single user session but also manageable and improvable as a deployed service. This involves isolating failures (primarily within Web Workers), providing clear user feedback, and equipping the development team with the tools to detect, triage, and remediate systemic issues swiftly. The "Needs-Work" verdict from the initial audit has been addressed through a committed plan for Track 1 (In-App Resilience) and Track 2 (Proactive Telemetry & Service Management). This revised approach positions `diranalyze` for sustainable operation and continuous improvement.

---

#### 2. Problem & User Stories (with KPI / SLO table)

**Epic:** The `diranalyze` service must be demonstrably stable, performant, and trustworthy, providing clear insight into its operational health and rapidly recovering from any incidents.

**User Stories (Defender's Perspective):**

1.  **As an SRE/Developer, when a new `diranalyze` version causes a spike in client-side errors, I must be alerted within 5 minutes and have dashboards to quickly correlate the errors with the new version and affected browser types.** (Addresses proactive detection)
2.  **As an SRE/Developer, when analysis success rate drops below 99%, I need clear runbooks to diagnose whether it's a specific input type, a faulty worker process, or a systemic backend issue (telemetry pipeline).** (Addresses triage)
3.  **As a User, when my analysis fails due to a malformed file, the application must clearly indicate the problematic file, continue analyzing others, and offer me a detailed session log for reporting.** (Addresses graceful degradation and user-facing diagnostics, from original proposal)
4.  **As an SRE/Developer, if a deployment introduces a critical regression, I must be able to roll back to the previous stable version within 15 minutes of detection.** (Addresses recovery)
5.  **As the System, when analyzing a folder exceeding the hard-coded limit of 7,500 files, I must immediately abort the operation and inform the user, rather than attempting to process it and inevitably crashing the browser tab.** (From original proposal, addresses input validation)

**Key Performance Indicators (KPIs) / Service Level Objectives (SLOs):**

| SLI Description                                  | Measurement Method (OTEL based)                                                                  | SLO Target             | Notes                                           |
| :----------------------------------------------- | :----------------------------------------------------------------------------------------------- | :--------------------- | :---------------------------------------------- |
| **Availability: Successful Analysis Session Rate** | (1 - (Sessions with `GLOBAL_TIMEOUT_ABORT` or unhandled orchestrator crash) / Total Sessions) \* 100% | > 99.9%                | Via Telemetry Backend                           |
| **Correctness: Graceful File Parse Failure Rate**  | (Files with `FILE_PARSE_ERROR` successfully reported / Total files attempted that are unparseable) \* 100% | 100%                   | Local reporting, aggregated error types via telemetry |
| **Performance: P95 Main Thread Block during Analysis** | Max of `ui.render_update` or `analysis.result_aggregation` span durations on main thread        | < 200 ms               | Via Telemetry Backend                           |
| **Performance: P90 Analysis Task Completion (per file)** | `analysis.file_processing` span duration (for successfully parsed files < 1MB)                  | < 500 ms              | Via Telemetry Backend                           |
| **Responsiveness: P95 "Cancel Analysis" Response Time** | `operation.cancel` span duration until workers confirmed terminated                             | < 2 seconds              | Via Telemetry Backend & local session log       |
| **Error Rate: Unhandled Client-Side Exception Rate** | (Sessions with JS errors not caught by local handlers / Total Sessions) \* 100%                  | < 0.01%                | Via Telemetry Backend                           |
| **MTTD (Mean Time To Detect - Critical Issues)**   | Time from issue start to critical alert firing                                                   | ≤ 5 minutes            | For issues like high unhandled exceptions       |
| **MTTR (Mean Time To Recover - Critical Service Impact)** | Time from critical alert to service restoration (e.g., via rollback)                            | ≤ 30 minutes           | Includes diagnosis, decision, and action        |

---

#### 3. High-Level System Sketch (Resilience & Telemetry Architecture)

```mermaid
graph TD
    subgraph Browser Client (User Session)
        direction LR
        U[User File Input] --> FQ[File Queue & Pre-flight Checks];
        FQ --">7.5k files"--> FG[File Count Gate: Abort + UI Msg];
        FQ --> ORC[Orchestrator (Main Thread)];

        subgraph OTEL_SDK [OpenTelemetry JS SDK]
            direction TB
            ORC -->|spans| OTEL_SDK;
            WW -->|spans| OTEL_SDK;
            OTEL_SDK --> LSL[Local Session Log (Downloadable)];
            OTEL_SDK -- Opt-In --> TC[Telemetry Collector Endpoint];
        end

        ORC --"Posts Task"--> WWPOOL[Web Worker Pool];
        WWPOOL -->|task| WW[Web Worker (Isolated File Processor)];

        subgraph WW
            direction TB
            TRY[try] --> PARSE[acorn.js Parse & Analysis];
            PARSE --"Success"--> RESULT[Return Result];
            PARSE --"Error (e.g. Syntax)"--> CATCH[Catch Exception];
            CATCH --> ERRMSG[Return Error Msg];
        end

        WW --"Message: {status, data/error}"--> ORC;
        ORC --"Updates UI State"--> UI[UI "Truth Map" & Renderer];
        UI --> DISP[Display Results/Errors];

        subgraph GlobalSafeguards
            GTO[Global Timeout (3 min)] -->|Sends Abort Signal| ORC;
            CANCEL[Cancel Button] -->|Sends Abort Signal| ORC;
        end
    end

    subgraph Telemetry Backend (Service Management)
        direction TB
        TC --> COLL[OpenTelemetry Collector / Plausible/Umami];
        COLL --> STORE[Metrics & Logs Storage (e.g., Signoz, Jaeger, ClickHouse)];
        STORE --> DASH[Dashboards (Grafana/Kibana/Internal)];
        STORE --> ALERT[Alerting Engine (Alertmanager)];
        DASH --> DEV[Developer/SRE];
        ALERT -->|Notifications| ONCALL[On-Call Personnel];
    end

    DEV --"Observes/Investigates"--> DASH;
    ONCALL --"Responds/Uses Runbooks"--> RBOOK[Runbook Repository];
    DEV --"Rollback Trigger"--> CICD[CI/CD Pipeline (GitHub Actions)];
    CICD --"Deploys/Rolls Back"--> Browser Client;
```

**Description:** The architecture emphasizes client-side resilience via isolated Web Workers and robust error handling within each worker, managed by a main-thread Orchestrator. The OpenTelemetry JS SDK is central, capturing structured logs and traces. Locally, these populate a downloadable Session Log for user-driven debugging. If telemetry is user-enabled, this data is sent to a backend (e.g., Plausible/Umami initially, evolving to a full OTEL Collector setup) for aggregation, dashboarding (User Experience Overview, Analysis Performance Deep Dive), and alerting on SLO violations. Global safeguards like file count limits and timeouts prevent browser crashes. A CI/CD pipeline with versioning and rollback capabilities ensures service restorability.

---

#### 4. Component Table (Role · Failure Mode · Mitigation · Peak QPS)

*(Peak QPS is less relevant for client-side components in the traditional sense; interpreted as "max operations/sec or events/sec handled internally" or "max concurrent instances")*

| Component                     | Role                                          | Primary Failure Mode(s)                                   | Mitigation Strategy                                                                                               | Peak Operations (Approx.)                 |
| :---------------------------- | :-------------------------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| **File Queue & Pre-flight**   | Accepts user input, initial validation        | User drops >7,500 files                                   | Gate: Count files; if > limit, abort & UI message. Log event.                                                     | 1 check/user action                       |
| **Orchestrator (Main Thread)**| Manages workers, aggregates results, UI updates | Logic error leading to state corruption; Overload         | Careful state management; OTEL tracing for performance; Global timeout; Cancel button.                            | ~100s of messages/sec (from workers)      |
| **Web Worker**                | Parses/analyzes single file                   | Syntax error in file; Pathological input (infinite loop); Resource exhaustion | `try/catch` around parsing; Per-worker timeout monitored by Orchestrator; OTEL tracing of errors & duration.   | 1 file / (target P90: 500ms); ~5-10 concurrent |
| **UI Renderer**               | Displays analysis results and errors          | Rendering massive graph freezes DOM                      | UI Virtualization for large lists/graphs; Main thread block SLO; Clear separation of UI state and rendering.       | Target <200ms block per update           |
| **Local Session Log**         | Provides client-side debug trace              | Log buffer overflow (unlikely for session)                | Structured logging via OTEL SDK; User-downloadable.                                                               | ~10-100 log entries/sec peak            |
| **OpenTelemetry JS SDK**      | Instrumentation, local logging, telemetry export | Misconfiguration; Failure to export to backend           | NoOpExporter if telemetry disabled; Telemetry backend availability alert.                                        | Governed by analysis activity             |
| **Telemetry Collector Endpoint**| Ingests opt-in telemetry data                 | Overload; Unavailability                                  | Scalable endpoint (Plausible/Umami or OTEL Collector); Monitoring & alerting on ingest health & volume.            | **TODO**: Estimate based on adoption rate  |
| **Telemetry Backend Storage** | Stores aggregated metrics & logs              | Data loss; Query performance degradation                  | Standard database resilience (backups, replication for Signoz/Jaeger); Data retention policies.                     | **TODO**: Estimate based on data volume   |
| **Alerting Engine**           | Notifies on SLO breaches, anomalies           | Alert fatigue; Missed alerts                              | Well-defined alert thresholds; Clear runbooks; Regular review of alert efficacy.                                    | Low QPS; high impact                      |
| **CI/CD Pipeline (GitHub Actions)** | Deploys new versions, enables rollback    | Faulty deployment script; Rollback failure                | Versioned deployments; Archived previous versions; Manual rollback trigger; Test rollback procedure.             | Infrequent (deploys, rollbacks)           |

---

#### 5. Assumptions & Constraints

*   **Hostile Input:** Any user-provided file can be malformed, intentionally or unintentionally. The system must not crash.
*   **Stability over Perfection:** A gracefully degraded analysis (e.g., some files unparsed but clearly marked) is preferred over a system crash or hang.
*   **Client-Side Resource Limits:** Browser environments have finite memory and CPU. Hard limits (file count, timeouts) are necessary and must be communicated.
*   **Opt-In Telemetry:** Proactive observability relies on users opting into anonymous telemetry. Adoption rates will impact visibility. Privacy is paramount in telemetry design.
*   **Read-Only Analysis:** The tool performs read-only analysis of local files; no data modification occurs, simplifying data integrity concerns for user files.
*   **Progressive Enhancement for Telemetry:** Initial telemetry will use simpler backends (Plausible/Umami), evolving to more sophisticated OTEL collectors (Signoz/Jaeger) as needed.
*   **Small Initial Team:** Incident response runbooks and on-call rotations will be scaled appropriately for a small development team.

---

#### 6. Cost & Performance Budget

*   **Resilience Overhead:** The performance cost of `try/catch` blocks, worker communication, and timeout checks is accepted as necessary for stability.
*   **Telemetry Overhead (Client):** OpenTelemetry JS SDK impact on client performance must be minimal. Head-sampling or batching will be used if needed. Target <5% overhead on typical analysis tasks.
*   **Telemetry Backend Costs:**
    *   Initial: Self-hosted Plausible/Umami or low-tier Signoz/Jaeger cloud offerings. Budget: **TODO** (e.g., <$50/month).
    *   Growth: Costs will scale with telemetry data volume and retention. This needs monitoring.
*   **Performance SLOs (from Section 2):**
    *   P95 Main Thread Block during Analysis: < 200 ms
    *   P90 Analysis Task Completion (per file < 1MB): < 500 ms
    *   P95 "Cancel Analysis" Response Time: < 2 seconds

---

#### 7. Data-Integrity & Security Plan

*   **User File Integrity:** `diranalyze` operates in a read-only manner on user-selected local files. No modification of user files occurs.
*   **Analysis Integrity:** The UI must transparently reflect the status of each file: successfully parsed, failed to parse (with reason), skipped. This prevents misinterpretation of incomplete results.
*   **Session Log Integrity (Client-Side):** The downloadable session log is for user debugging. Its integrity relies on the user not tampering with it before submission. It will contain no file content.
*   **Telemetry Data Security & Integrity:**
    *   **Anonymization:** No file content, filenames that could be PII, or other user-identifiable data will be transmitted via telemetry by default. Aggregated, anonymous data only.
    *   **Transport Security:** Telemetry data will be transmitted over HTTPS to the backend.
    *   **Backend Security:** The chosen telemetry backend (Plausible/Umami, Signoz/Jaeger) must be configured securely (strong credentials, limited access, regular patching if self-hosted).
    *   **Tamper Evidence (Backend):** Append-only logging for raw ingested events where feasible. Cryptographic checksums for log batches stored separately if full auditability is required (more relevant for high-security environments).
*   **CI/CD Security:** GitHub Actions secrets managed securely. Workflow permissions restricted. Code scanning and dependency checking in place.

---

#### 8. Observability & Incident Response

This section details the proactive observability and incident response framework, building on the revised plan.

*   **Core Observability Pillars:**
    1.  **Client-Side Session Logs:** Rich, structured (OTEL-aligned) logs downloadable by the user for detailed local debugging.
    2.  **Opt-In Telemetry:** Aggregated, anonymized metrics and error reports sent to a central backend.
        *   Initial Backend: Plausible/Umami for ease of setup and privacy focus.
        *   Target Backend: OpenTelemetry Collector -> Signoz/Jaeger for advanced tracing and analytics.
    3.  **OpenTelemetry (OTEL) Instrumentation:** Standardized tracing and logging using OTEL JS SDK. Key spans defined (see audit report for full list, e.g., `analysis.orchestration`, `analysis.file_parse`, `operation.cancel`).

*   **Dashboards (To be built on Telemetry Backend):**
    1.  **User Experience Overview:**
        *   Key SLOs: Successful Analysis Session Rate, P95 Main Thread Block, Cancel Response Time.
        *   Unhandled Client-Side Exception Rate (trend, browser/OS breakdown).
        *   Active "sessions" trend (estimated).
        *   Adoption rate of telemetry.
    2.  **Analysis Performance Deep Dive:**
        *   P50/P90/P99 file processing time (overall, per worker if possible).
        *   Rates of `FILE_PARSE_ERROR`, `WORKER_TIMEOUT`, `GLOBAL_TIMEOUT_ABORT`.
        *   Breakdown of parse error types.
        *   Histogram of files analyzed per session.
    3.  **Telemetry System Health:**
        *   Ingestion rate, errors, latency.
        *   Alerting system health.

*   **Alert Matrix (Initial Set, based on SLOs):**

    | Alert Name                                 | SLI Affected                                      | Threshold (Configurable)                           | Severity | Notification | Runbook Link             |
    | :----------------------------------------- | :------------------------------------------------ | :------------------------------------------------- | :------- | :----------- | :----------------------- |
    | High Unhandled Client-Side Exception Rate  | Unhandled Client-Side Exception Rate              | > 0.1% of sessions over 1hr (sustained)            | Critical | PagerDuty    | `RUNBOOK_UnhandledEx.md` |
    | Analysis Success Rate Degradation          | Availability: Successful Analysis Session Rate    | < 99% over 1hr (sustained, >N sessions/hr)         | Critical | PagerDuty    | `RUNBOOK_SuccessRate.md` |
    | Spike in File Parse Timeouts               | Correctness / Performance (Worker Health)         | >5% of analysis tasks hitting worker timeout / 1hr | Warning  | Slack        | `RUNBOOK_Timeouts.md`    |
    | Telemetry Ingestion Failure                | Telemetry System Health                           | Data volume drops >75% for 30 mins OR error rate >5% | Critical | PagerDuty    | `RUNBOOK_Telemetry.md`   |
    | P95 Main Thread Block Exceeds SLO          | Performance: P95 Main Thread Block                | > 300ms for 15 mins (sustained)                    | Warning  | Slack        | `RUNBOOK_PerfUI.md`      |

*   **Runbook Index (To be created in `ONCALL_RUNBOOK.md` or similar):**
    *   `RUNBOOK_UnhandledEx.md`: Steps to diagnose unhandled exceptions (check browser versions, new code paths, recent deployments).
    *   `RUNBOOK_SuccessRate.md`: Steps to investigate drops in analysis success (common error types, input patterns, version correlations).
    *   `RUNBOOK_Timeouts.md`: Diagnosing worker timeouts (file types, complexity, potential infinite loops, resource contention).
    *   `RUNBOOK_Telemetry.md`: Troubleshooting the telemetry pipeline itself.
    *   `RUNBOOK_PerfUI.md`: Investigating main thread performance regressions.
    *   `RUNBOOK_Rollback.md`: Procedure for executing a deployment rollback via GitHub Actions.

*   **Incident Response Protocol:**
    *   **Detection:** Automated alerts, user reports (via Session Logs), dashboard monitoring.
    *   **Acknowledgement (L1):** Dev team member acknowledges PagerDuty alerts within 15 mins.
    *   **Triage & Diagnosis (L1/L2):** Use dashboards and runbooks. Determine scope and impact.
    *   **Escalation:** If unresolved or high impact, escalate to designated Incident Commander (IC).
    *   **Remediation:** Apply fix (e.g., hotfix, rollback, configuration change).
    *   **Communication:** Internal updates. Public status if widespread user impact (future).
    *   **Post-Mortem:** For critical incidents, conduct a blameless post-mortem to identify root causes and preventative actions.

*   **CI/CD & Rollback:**
    *   GitHub Actions for automated build, test, and deployment.
    *   Versioned deployments (e.g., `v1.2.3`).
    *   Previous version's static assets archived.
    *   Manual "Rollback" GitHub Actions workflow to redeploy previous version quickly. Target RTO for rollback: < 15 minutes post-decision.

---

#### 9. Privacy & Compliance Mapping

*   **User Data Handling:**
    *   `diranalyze` is primarily client-side; user code/files remain local and are not transmitted unless the user explicitly shares them (e.g., for a bug report).
    *   The "Session Log" is generated client-side and is under user control. It is designed to exclude file content by default.
*   **Opt-In Telemetry Privacy:**
    *   **Explicit Consent:** Users will be prompted on first use to opt-into anonymous performance and error reporting. This choice is easily reversible.
    *   **Data Minimization:** Only aggregated, non-identifiable data is collected (e.g., event counts, durations, anonymized error signatures). No file names, paths (beyond generic markers if needed for error categorisation, e.g. `*.test.js`), or file contents are transmitted.
    *   **Anonymization Techniques:** IP addresses anonymized by telemetry backend if possible (Plausible/Umami feature). User IDs are not tracked. Session IDs are random and not linkable across different opt-in sessions if reset.
    *   **Transparency:** A clear privacy policy section will detail what data is collected, why, and how it's used when telemetry is enabled.
    *   **Technology Choice:** Initial use of privacy-focused backends (Plausible/Umami) reinforces this. Any move to Jaeger/Signoz will maintain this strict anonymization policy for data collected from end-users.
*   **Compliance:**
    *   **GDPR/CCPA:** While `diranalyze` as a tool processing local files has minimal direct GDPR/CCPA implications regarding the *content* it analyzes, the opt-in telemetry system must be GDPR/CCPA compliant. This means clear consent, data minimization, right to access/deletion (by clearing settings and not opting back in, or by requesting deletion from backend if any persistent pseudonymous IDs were ever used – current plan avoids this).
    *   **No Sensitive Data Collection by Design:** The system is engineered *not* to collect sensitive information via telemetry.

---

#### 10. UX & Human-Factors Safeguards

*   **No Silent Failures:** The application must always provide feedback. If an analysis step fails, it's reported. If it's progressing, some indication (even basic) is better than a static screen for long operations. (Consideration for future: more granular progress).
*   **Actionable Error Messages (UI):** User-facing errors are simple and direct (e.g., "File X.js could not be analyzed due to a syntax error."). Detailed technical errors are in the Session Log.
*   **Clear Indication of Partial Analysis:** If some files fail, the UI must make it obvious that the presented graph/results are incomplete and specify which parts are missing/problematic.
*   **Easy Access to Debug Information:** The "Download Session Log" feature is crucial for users to report bugs effectively.
*   **Manageable Limits:** Hard limits (file count, timeouts) are communicated clearly, either upfront or when breached.
*   **Responsive "Cancel" Button:** Ensures users can always halt an operation that is taking too long or behaving unexpectedly. SLO: P95 < 2 seconds.
*   **Telemetry Opt-In UX:** The prompt for telemetry will be clear, concise, explain the benefits (improving the tool), and highlight the privacy measures. Opting out or changing settings will be straightforward.

---

#### 11. Reflection & Iteration Hooks

*   **Data-Driven Prioritization:** Aggregated telemetry data (error types, performance bottlenecks, feature usage patterns – if basic usage is tracked) will directly inform development priorities.
*   **Runbook Effectiveness Review:** After each significant incident (or periodically), review the relevant runbook: Was it clear? Accurate? Did it lead to quick resolution?
*   **Alert Tuning:** Regularly review alert thresholds and query definitions. Are alerts too noisy? Are they missing important events?
*   **SLO Review:** Periodically (e.g., quarterly) review SLOs. Are they still appropriate for the user experience and business goals? Are we consistently meeting them?
*   **Post-Mortem Culture:** Foster a blameless post-mortem culture for all significant incidents to extract maximum learning.
*   **User Feedback Loop for Session Logs:** Establish a process for users to submit Session Logs with bug reports and track these issues. The patterns in these logs can highlight areas needing resilience improvements even before telemetry shows a wider trend.
*   **Telemetry Evolution:** Periodically reassess if the current telemetry backend (Plausible/Umami) meets evolving needs, or if migration to a more advanced OTEL backend (Signoz/Jaeger) is warranted and resourced.

---

#### 12. Open Questions & Risks

| Question / Risk                                                                     | Mitigation Path / Current Stance                                                                                                                                                                                            | Severity (if Risk) |
| :---------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| **Telemetry Adoption Rate:** What if too few users opt into telemetry, limiting visibility? | Make the value proposition clear; ensure privacy is robustly protected and communicated. Start with essential, non-invasive metrics. Consider A/B testing opt-in messaging if problematic.                               | Medium             |
| **Complexity of Telemetry Backend Management:** Will self-hosting Signoz/Jaeger become too burdensome for a small team? | Phased approach: Start with simpler Plausible/Umami. Evaluate managed services for Signoz/Jaeger if self-hosting proves too complex/costly relative to benefit.                                              | Medium             |
| **Resource Exhaustion by Single Malicious/Complex File:** Can a single file still overwhelm a worker despite timeouts (e.g., excessive memory before timeout)? | Per-worker timeouts are the primary defense. Monitor worker resource metrics if telemetry allows. Extremely large files may need pre-filtering or specific warnings. Continued vigilance on parser stability.            | Low-Medium         |
| **Accuracy of Client-Side Performance Metrics:** Are client-side OTEL metrics susceptible to too much noise from user's machine? | Focus on trends and P9x aggregates rather than individual noisy readings. Correlate with qualitative user reports. Use relative changes effectively.                                                           | Low                |
| **Scalability of "Manual Rollback":** Will manual rollback be sufficient as deployment frequency or complexity increases? | Sufficient for now. If deployment velocity significantly increases, investigate automated rollback triggers based on critical alert thresholds (e.g., canary analysis failure).                                          | Low (for now)      |
| **Detection of All Dynamic Imports:** Can all dynamic/non-standard module loading be detected by `acorn.js`? | Original proposal: No. UI and documentation must be explicit. Unresolved imports flagged. This remains a known limitation of static analysis.                                                              | Low                |
| **Alert Fatigue:** If alerts are too frequent or not actionable, team may ignore them.  | Start with a minimal set of critical alerts. Tune aggressively based on feedback. Ensure runbooks are genuinely useful. Implement alert silencing rules for known conditions.                                    | Medium             |

---

#### 13. Appendices

*   **Appendix A: Formal Schema for Client-Side Session Log Events (OTEL Aligned)**
    *   *(To be detailed: based on OTEL Log Data Model, including `Timestamp`, `ObservedTimestamp`, `TraceId`, `SpanId`, `SeverityText`, `SeverityNumber`, `Body` (structured message), `Attributes` (key-value pairs for context like `file.path`, `error.type`, `duration_ms`), and `Resource` attributes like `session.id`, `app.version`).*
*   **Appendix B: Defensive Programming Checklist for Analysis Features**
    *   *(To be detailed: includes items like "Wrap all external library calls (e.g., parser) in try/catch," "Validate all inputs from other components/workers," "Implement per-operation timeouts for potentially long tasks," "Ensure all state changes are predictable and logged for OTEL traces").*
*   **Appendix C: Initial On-Call Runbook Structure (`ONCALL_RUNBOOK.md`)**
    *   *(To be detailed: will include sections for each defined alert, diagnostic steps, escalation paths, communication templates, and links to dashboards).*