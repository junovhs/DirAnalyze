# Research: Signature-First Context Strategy for LLM Interaction

**Date Initiated:** 2025-05-29 (Placeholder)  
**Status:** Test Plan Design - Awaiting Implementation & Benchmarking by DirAnalyze Team

## 1. Initial Hypothesis (Hypothesis 1)

Providing a Language Model (LLM) with a "signature-first" context—a manifest of key code constructs (function names, class names, top-level variables, imports/exports) rather than full file contents—will:

- Significantly reduce the number of tokens required to represent a codebase
- Provide sufficient structural information for the LLM to ask targeted follow-up questions or request specific code sections, improving interaction efficiency

## 2. Experiment 1: Simulated Signature Extraction

**Goal:** Evaluate the potential token reduction by extracting signatures from `diranalyze/js/main.js` using Python and regex.

**Methodology:**
Developed Python script (`signature_extractor_v1.py`) with regexes to identify:
- Standard and async function declarations
- Top-level const and let variable/object literal declarations
- Top-level arrow function assignments
- Import and export statements
- Compared character count of original file vs. generated signature manifest

**Script:** See `signature_extractor_v1.py`

**Key Results:**
- Original `main.js` size: 43,851 characters
- Initial Signature Manifest: 1,659 characters (96.22% reduction)
- Refined Signature Manifest (improved regexes): 1,490 characters (96.60% reduction)
- Demonstrated significant potential for token savings

## 3. AI Auditor Feedback - Phase 1 (Summary)

The initial experiment, while showing high compression, was critiqued for:

- **Underspecified Success Criteria:** Reduction percentage is trivial without LLM reasoning benchmarks
- **Parser Quality:** Regex is fragile for complex JS/TS; AST-based parsing needed for reliability. Missed symbols risk LLM hallucination
- **Context Starvation:** Signatures hide crucial semantics (invariants, side-effects). A fallback to reveal bodies is necessary
- **Security/Privacy Blind Spots:** Token minimization can hide secrets in stripped bodies
- **Weak Measurement Plan:** Character count isn't a proxy for LLM task success
- **Repository Realities:** `main.js` is simpler than real-world JSX, TypeScript, etc.

## 4. Experiment 2 Design (Addressing Initial Feedback)

**Revised Hypothesis:** A manifest can be augmented with (1) basic secret scan warnings and (2) selective inclusion of full bodies for very short, safe files to mitigate context starvation and security risks without nullifying token savings.

**Proposed Methodology** (Conceptual - Not fully simulated due to tool limitations):
- Secret Scan: Regex-based scan for obvious keywords/patterns
- Signature Extraction: Reuse/refine from Experiment 1
- Selective Body Inclusion: Include full content for non-secret, short files (e.g., < 5 lines / < 200 chars)
- Assemble Hybrid Context & Compare Size

## 5. AI Auditor Feedback - Phase 2 (On Experiment 2 Design)

The proposed Experiment 2 design was still deemed insufficient:

- **Secret Scan as "Theater":** Regex is not a real secret scanner. Recommended using production tools (e.g., TruffleHog)
- **Short-File Whitelist Metric:** Line count is poor; gate on entropy, scan results, and size. Log "body reveal" decisions
- **Context Starvation Still Unmeasured:** Need benchmarks to prove LLM reasoning improves with selective bodies
- **False Sense of Safety:** "Content withheld" warning is insufficient for automation; require hard failure or explicit override for secrets

**Recommendation:** Tighten secret scanning and add accuracy benchmarks.

## 6. Pivot: Formal Test Plan Design

Given the limitations of simulating complex tools (AST parsers, real secret scanners, LLM benchmarks) in the "testing chamber," the research pivoted to designing a formal, actionable Test Plan for DirAnalyze to implement and validate the "Signature-First Context Strategy (with Selective Body Reveal & Proper Secret Scanning)."

### Key Components of the Test Plan Design:

### 6.1. Measurability of Parser Accuracy (Signature Extractor)

- **Corpus:** 200 files (100 JS/TS, 60 Python, 40 Zig). C/C++ deferred unless Clang-based extractor used
- **Truth JSON Spec:** `filePath`, `fileSha256` (for corpus drift detection), `signatures: [{type, name, params, async, export}]`
- **Automation:** CI script (`tools/validate_signatures.py`) to compare generated vs. truth
- **CI Failure:** Recall < 0.98 OR F1-Score < 0.95 for any language
- **Rationale:** Prioritize high recall (missed symbols are dangerous for LLM). F1 > 0.95 is a strong initial target. Error analysis of failures to guide threshold refinement

### 6.2. Secret-Scan Policy

- **Default:** Hard-Fail. Halt context generation if high-confidence secret detected
- **Override:** Explicit, logged user action
- **Git Trailer (Machine-Parsable):**

```
AI-Secret-Override: Path="URL_ENCODED_PATH",SHA256="CANONICAL_HEX_DIGEST",Reason="URL_ENCODED_REASON"
AI-Secret-Reviewer: "URL_ENCODED_REVIEWER"
```

- Internal DirAnalyze log entry for session
- **Quarantine Mode:** `--quarantine-mode` flag to disable all LLM calls if secrets present (for CI/unattended runs)
- **Tooling:** Integrate a production-grade secret scanning library

### 6.3. Selective Body Inclusion Logic

- **Criteria:** Must pass secret scan AND (file size < X LOC AND < Y KB)
- **Logging:** Record which files had bodies included and why

### 6.4. Context Package Assembler

Combines global signature manifest, full bodies of safe/short files, warnings/placeholders for secret-laden files (if not hard-failing), and GitHub metadata.

### 6.5. LLM Benchmark Governance

- **Owner:** [GITHUB_HANDLE_OR_TEAM_LEAD_HERE (e.g., @diranalyze-ai-quality-lead)]
- **Tasks:** Q&A, bug location, patch generation. Maintained and version-controlled. Quarterly rotation for task writing/scoring
- **Scoring:** Automated (token count, patch compilation, unit tests) + Human-assisted (rubric for quality/accuracy)
- **Language-Specific Test Commands:** Defined in a `/benchmarks/benchmark_config.json` (e.g., `npm test`, `pytest`, `zig build test_target`)
- **Frequency:** Full suite pre-release; subset nightly/PR
- **Artifact Storage:** Immutable, versioned storage (e.g., S3-style bucket) for prompts, completions, scores

## 7. Micro-Deliverable: Secret Override Trailer Helper

**Purpose:** Generate and parse the machine-readable Git trailers for secret overrides.

**Script:** See `secret_override_trailer_helper.py`

**Key Hardened Features:**
- URL-encoding for Path, Reason, and Reviewer fields for safety
- Path validation (disallows embedded newlines before encoding)
- Mandatory `file_content_for_hash` for SHA256 generation (no placeholders)
- Robust multi-trailer parsing from commit messages, tolerating blank lines between Override and Reviewer pair, and discarding malformed/incomplete pairs
- Canonical SHA256 casing (configurable, defaults to lower)
- Verification function to compare trailer SHA256 against live file content hash

## 8. Current Status & Next Steps for DirAnalyze Team

**Test Plan Design:** This document outlines the plan. Owners and actual target dates for each component need to be assigned by the DirAnalyze team before this plan is formally adopted.

**Immediate Actions (from Auditor):**
- Populate Owner/Date Blanks in this Test Plan
- Implement `tools/validate_signatures.py` skeleton (CLI, SHA drift check, scoring, CI integration)
- Implement `secret_override_trailer_helper.py` (or native equivalent) and integrate into Git hooks / commit validation logic
- Implement `benchmark_config.json` loader and test executor stub
- Begin implementation of the chosen first micro-deliverable

## 9. Future Research Questions / Open Items

- Optimal balance for hybrid context (signatures vs. full bodies vs. dependency teasers)
- Feasibility and performance of AST-based parsers for all supported languages within DirAnalyze (e.g., Zig-native or WASM)
- Actual LLM performance metrics once benchmarks are established
- Impact of different LLMs on context strategy effectiveness
- User interface for managing secret overrides and reviewing AI context packages