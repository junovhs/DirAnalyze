# DirAnalyze Git Conventions

This document outlines the Git conventions used for the DirAnalyze project. Adhering to these conventions helps maintain a clean, understandable, and manageable commit history, and facilitates collaboration (even with future-you or AI assistants).

## 1. Commit Messages

We follow the **Conventional Commits** specification (v1.0.0). This makes commit history more readable and allows for easier automation of changelogs and versioning.

### Format:

\`\`\`
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
\`\`\`

**`<type>`:** Must be one of the following:
*   **feat:** A new feature (user-facing).
*   **fix:** A bug fix (user-facing).
*   **docs:** Documentation only changes.
*   **style:** Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).
*   **refactor:** A code change that neither fixes a bug nor adds a feature.
*   **perf:** A code change that improves performance.
*   **test:** Adding missing tests or correcting existing tests.
*   **build:** Changes that affect the build system or external dependencies (example scopes: Zig build, npm, packaging).
*   **ci:** Changes to our CI configuration files and scripts.
*   **chore:** Other changes that don't modify `src` or `test` files (e.g., updating `.gitignore`).

**`<scope>` (optional):**
A noun describing the section of the codebase affected.
Examples: `parser`, `ui`, `treeView`, `aiPatcher`, `deps`, `readme`.

**`<subject>`:**
*   Use the imperative, present tense: "add" not "added" nor "adds".
*   Don't capitalize the first letter (unless it's a proper noun/acronym).
*   No dot (`.`) at the end.
*   Keep it concise (ideally under 50 characters, max 72).
*   **Example for AI:** If the AI is asked to "fix the drop zone to accept folders", a good subject might be "fix(dropZone): allow folder drops via input".

**`<body>` (optional):**
*   Use the imperative, present tense.
*   Include motivation for the change and contrast this with previous behavior.
*   Explain *what* and *why* vs. *how*. Use a blank line between the subject and the body.

**`<footer>` (optional):**
*   **Breaking Changes:** Start with `BREAKING CHANGE:` (or `BREAKING-CHANGE:`) followed by a description of the change, justification, and migration notes.
*   **Issue Linking:** Reference issues that this commit closes (e.g., `Closes #123`, `Fixes #456`).

### Examples:

\`\`\`
feat(lang): add polish language
\`\`\`

\`\`\`
fix(css): correct styles for left sidebar resizer

The resizer was previously overlapping content. This commit adjusts
its z-index and ensures proper flex behavior in the app container.
Closes #42
\`\`\`

\`\`\`
refactor(fileSystem): simplify processDirectoryEntryRecursive logic

BREAKING CHANGE: The \`parentAggregator\` parameter is now mandatory
and expects a different structure. See docs for migration.
\`\`\`

## 2. Branching Strategy

We use a simple feature branch workflow based on `main`:

*   **`main`:** This is the primary branch representing the latest stable release or active development state. Direct commits to `main` are highly discouraged. All changes should come through Pull Requests.
*   **Feature Branches:** Create a new branch from `main` for each new feature or significant change.
    *   Naming: `feat/<descriptive-name>` (e.g., `feat/sidebar-resizer`, `feat/ai-briefing-studio`)
*   **Fix Branches:** Create a new branch from `main` for bug fixes.
    *   Naming: `fix/<issue-number-or-description>` (e.g., `fix/123-commit-button-disabled`, `fix/css-overflow-mainview`)
*   **Chore/Docs Branches:** For non-code changes if they are substantial.
    *   Naming: `chore/<description>` or `docs/<area>` (e.g., `docs/update-git-conventions`)

After work is complete on a branch, open a Pull Request to merge it into `main`.

## 3. Pull Requests (PRs)

*   All changes to `main` **must** be made through PRs.
*   PR titles should be clear and ideally follow Conventional Commit subject lines (e.g., `feat(aiPatcher): Implement patch review modal`).
*   PR descriptions should summarize the changes, explain the rationale ("why this change?"), and link to any relevant issues.
*   Ensure code is reasonably tested locally before opening a PR.
*   (For teams) Seek code review. (For solo) Do a self-review before merging.

## 4. Issue Tracking (e.g., GitHub Issues)

*   Use the platform's issue tracker extensively.
*   Create issues for:
    *   Bugs (with steps to reproduce, expected vs. actual behavior).
    *   Feature requests/User stories.
    *   Tasks (e.g., "Refactor statsManager module").
    *   Significant refactors or architectural discussions.
*   Use labels (e.g., `bug`, `feature`, `ui`, `core`, `p1-high`) and milestones to organize and prioritize issues.

## 5. General Principles

*   **Commit Often:** Make small, atomic commits that represent a single logical change.
*   **Test Before Committing:** Don't commit broken code to shared branches. Run relevant tests.
*   **Keep `main` Deployable:** The `main` branch should always be in a state that could (in theory) be released.

---
This document helps ensure consistency. When requesting an AI to generate commit messages or branch names, refer it to these conventions.