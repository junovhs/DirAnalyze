<!--
AI UPDATE INSTRUCTIONS:
This document ("Current Development Task & Next Steps") is a living snapshot of the project's immediate focus. It's crucial for maintaining continuity between development sessions.

To update this document at the END of a development session:
1.  **Timestamp:** Update the main timestamp at the top to reflect the end of the current session.
2.  **Feature Focus & Relevant Issues:** Ensure these accurately reflect what was worked on and what's next.
3.  **Section 1: Current State of Versioning Feature:**
    *   Move items from "Immediate Next Task" (Section 2) of the *previous* version of this document to "Completed Components" (Section 1.1) if they were successfully implemented in the current session. Be specific about what was done (e.g., "Backend API endpoint X created", "Frontend logic Y in file Z now handles...").
    *   Ensure all sub-sections (1.1, 1.2 - Key State Variables, 1.3 - HTML Structures, etc.) are accurate and reflect the codebase *as it stands at the end of the session*.
4.  **Section 2: Immediate Next Task:**
    *   Clearly define the *very next set of actionable steps* for the *next* development session. This should be detailed enough for another developer (or AI) to pick up with minimal ambiguity.
    *   Break it down into sub-tasks if necessary (e.g., Frontend Changes, Backend Changes).
    *   Specify file locations and function names where changes are expected.
    *   Include pseudo-code or specific logic points if helpful.
5.  **Section 3: Next Major Task (After completing Section 2):**
    *   Briefly outline the subsequent larger piece of work that follows the "Immediate Next Task". This provides context and direction.
6.  **Review for Clarity & Accuracy:** Ensure the entire document is clear, technically accurate, and directly reflects the project's current state and immediate future.
Provide the complete updated Markdown content for this file.
-->

# DirAnalyze: Current Development Task & Next Steps

**Timestamp:** 2025-06-09T03:45:00Z (Note: User to replace with actual timestamp at end of session)
**Feature Focus:** Project Versioning System - Restore Functionality (Phase 1.1: Frontend Interactivity)
**Relevant GitHub Issues:** #23 (UI for Version History - completion), #24 (Core Restore Logic - initial steps)

## 1. Current State of Versioning Feature

### 1.1. Completed Components:
*   **Backend Database Schema:**
    *   `ProjectVersions` table: Stores snapshot metadata (`version_id` PK AUTOINCREMENT, `parent_version_id`, `timestamp`, `description`).
    *   `VersionFiles` table: Stores `project_version_id`, `file_path`, `content_hash` (SHA-256), `file_size` for every file in each snapshot.
    *   `OperationLog` table: General logging; snapshot events are logged here.
    *   Schema is robustly initialized by the Rust backend (`db_manage.rs`, `version_control.rs`).
*   **Backend API - Create Snapshots:**
    *   `POST /api/snapshot/initial`: Accepts `{ project_root_name: String, files: Vec<ScannedFileInfo> }`. Creates `ProjectVersions` entry (parent_id=NULL), populates `VersionFiles`. Logic in `version_control::create_initial_project_snapshot`.
    *   `POST /api/snapshot/create`: Accepts `{ parent_version_id: i64, description: String, files: Vec<ScannedFileInfo> }`. Creates `ProjectVersions` entry (linked to `parent_version_id`), populates `VersionFiles`. Logic in `version_control::create_subsequent_project_snapshot`.
*   **Backend API - List Versions:**
    *   `GET /api/versions`: Queries `ProjectVersions` table, returns JSON array: `Vec<ProjectVersionInfo { version_id, parent_version_id, timestamp, description }>` ordered by `version_id` DESC. Handler in `main.rs`.
*   **Frontend - Snapshot Creation & Triggering:**
    *   On local folder load, `main.js::createInitialSnapshot` calculates SHA-256 hashes (via `utils.js::calculateSHA256`) for all files with `entryHandle` and POSTs to `/api/snapshot/initial`. `appState.currentVersionId` is updated.
    *   After AI Patcher operations, `aiPatcher.js::triggerSubsequentSnapshot` re-hashes all project files (from `appState.fullScanData`, considering editor cache) and POSTs to `/api/snapshot/create` using `appState.currentVersionId` as parent. `appState.currentVersionId` is updated.
*   **Frontend - Version History Display (Basic List):**
    *   "Version History" tab in `index.html` (`versionHistoryTab`).
    *   `js/main.js::fetchAndDisplayVersions` calls `/api/versions` and populates `ul#versionHistoryList` with `<li>` elements (containing `span.version-id`, `span.version-desc`, `span.version-time`).
    *   `js/uiManager.js::activateTab` calls `fetchAndDisplayVersions` when the tab is activated.
    *   The "Refresh List" button (`refreshVersionsBtn`) in this tab also calls `fetchAndDisplayVersions`.

### 1.2. Key Frontend State Variables (in `js/main.js::appState`):
*   `currentVersionId`: Stores the ID of the latest version snapshot.
*   `directoryHandle`: File System Access API handle for the project root (null for scaffolded projects).
*   `fullScanData`: Contains `directoryData` (tree structure) and `allFilesList`.
*   `selectedVersionToRestoreId`: (To be added) Will store the `version_id` selected by the user in the history list.

### 1.3. HTML Structure for Version History Item (generated by `js/main.js::fetchAndDisplayVersions`):

<li data-version-id="[version.version_id]">
    <span class="version-id">Version ID: [version.version_id]</span>(Parent: [version.parent_version_id] or Initial Version)<br>
    <span class="version-desc">[version.description]</span>
    <span class="version-time">Timestamp: [formattedTimestamp]</span>
</li>

### 1.4. HTML for Restore Actions (in index.html, initially hidden):

<div class="button-container" style="display:none;" id="restoreVersionActions">
    <button id="restoreSelectedVersionBtn" class="action-button" disabled>Restore Selected Version</button>
</div>

## 2. Immediate Next Task: Implement Frontend Interactivity for Version Restore (Phase 1.1 of Restore Functionality)

**Goal:** Allow users to click on a version in the "Version History" list, visually indicate the selection, and enable a "Restore Selected Version" button. Clicking this button will currently show a confirmation and log the intent, paving the way for actual restore logic in the next phase.

**Relevant Files:** `js/main.js` (for new state, event listeners, and selection logic), `css/components.css` (or inline in `index.html` for styling).

### 2.1. Detailed Steps for Frontend Implementation:

1.  **Add New State Variable (in `js/main.js`):**
    *   Inside `appState`, add: `selectedVersionToRestoreId: null,`

2.  **Modify `populateElements` (in `js/main.js`):**
    *   Ensure `restoreVersionActions` (the div container) and `restoreSelectedVersionBtn` (the button) are correctly mapped from their IDs in `index.html` to `window.diranalyze.elements`.
        *   `restoreVersionActions: 'restoreVersionActions',`
        *   `restoreSelectedVersionBtn: 'restoreSelectedVersionBtn',`

3.  **Modify `fetchAndDisplayVersions` (in `js/main.js`):**
    *   **Inside the `versions.forEach(version => { ... });` loop:**
        *   After creating the `listItem`, add a `click` event listener to it.
        *   **Click Handler Logic for `listItem`:**
            *   Get all existing `<li>` elements within `els.versionHistoryList`. Loop through them and remove the class `active-version`.
            *   Add the class `active-version` to the currently clicked `listItem`.
            *   Set `appState.selectedVersionToRestoreId = version.version_id;`
            *   Make the restore actions container visible: `els.restoreVersionActions.style.display = 'flex';` (or 'block' if more appropriate for your CSS).
            *   Enable the restore button: `els.restoreSelectedVersionBtn.disabled = false;`

4.  **Modify `setupEventListeners` (in `js/main.js`):**
    *   Add a `click` event listener to `els.restoreSelectedVersionBtn`.
    *   **Click Handler Logic for `restoreSelectedVersionBtn`:**
        *   Check if `appState.selectedVersionToRestoreId` is not `null`. If it's `null`, show a notification ("Please select a version from the list first.") and return.
        *   Display a confirmation dialog:
            ```javascript
            if (confirm(`Are you sure you want to proceed with restoring to Version ${appState.selectedVersionToRestoreId}? Current local files may be overwritten or changed.`)) {
                console.log(`User confirmed restore to version: ${appState.selectedVersionToRestoreId}. Next step: Implement backend call and file operations.`);
                notificationSystem.showNotification(`Preparing to restore Version ${appState.selectedVersionToRestoreId}... (Full restore logic pending)`, { duration: 3500 });
                
                // Placeholder for future actual restore initiation
                // els.loader.textContent = "Initiating restore to Version " + appState.selectedVersionToRestoreId + "...";
                // els.loader.classList.add('visible');
                // await initiateRestore(appState.selectedVersionToRestoreId); // This call will be for the next phase
                // els.loader.classList.remove('visible');
            } else {
                console.log("User cancelled restore operation.");
                // Optionally, clear appState.selectedVersionToRestoreId and deselect UI if desired
            }
            ```

5.  **Add CSS Styling (e.g., in `css/components.css` or an inline `<style>` block in `index.html`):**
    *   Define a style for the selected version item:
        ```css
        #versionHistoryList li.active-version {
            background-color: var(--accent-color) !important; /* Use important if other hovers conflict */
            color: var(--button-active-text) !important;
            border-color: var(--accent-color) !important;
        }
        #versionHistoryList li.active-version .version-parent,
        #versionHistoryList li.active-version .version-time,
        #versionHistoryList li.active-version .version-desc { /* Ensure all text inside becomes readable */
            color: var(--button-active-text) !important;
            opacity: 0.9;
        }
        ```

6.  **Update `resetUIForProcessing` (in `js/main.js`):**
    *   When a new project is loaded or the current one is cleared, reset the restore UI state:
        *   Set `appState.selectedVersionToRestoreId = null;`
        *   If `els.restoreVersionActions` exists, set `els.restoreVersionActions.style.display = 'none';`
        *   If `els.restoreSelectedVersionBtn` exists, set `els.restoreSelectedVersionBtn.disabled = true;`
        *   Ensure any `active-version` class is removed from `versionHistoryList` items if the list is not cleared entirely. (Clearing innerHTML of `versionHistoryList` is already done, which handles this).

### 2.2. Backend Changes for this Specific Sub-Task (Phase 1.1):
*   None. The existing `GET /api/versions` endpoint is sufficient for this phase.

## 3. Next Major Task (After completing Phase 1.1 above): Implement Restore Logic - Phase 1.2 (Backend Endpoint & Basic Frontend Restore Action)

*   **Backend (`version_control.rs` and `main.rs`):**
    *   Create new function `get_files_and_hashes_for_version(conn: &Connection, version_id: i64) -> Result<Vec<ScannedFileInfo>, rusqlite::Error>` in `version_control.rs`. This will query `VersionFiles` and return a vector of structs containing `path`, `content_hash`, and `file_size` for all files associated with the given `version_id`.
    *   In `main.rs`, create a new Axum handler `handle_restore_version(State(app_state), Path(version_id): Path<i64>)`.
    *   This handler will call `get_files_and_hashes_for_version`.
    *   Define a new response struct `RestoreInfoResponse { status: String, version_id_restored: i64, target_files: Vec<ScannedFileInfo> }`.
    *   Add a new route `POST /api/versions/:version_id/restore` mapped to this handler.
*   **Frontend (`js/main.js`):**
    *   Implement the `initiateRestore(versionId)` function.
    *   It will `fetch` the `POST /api/versions/:version_id/restore` endpoint.
    *   On successful response, it will receive `target_files`.
    *   **Initial Restore Action (Simplified):**
        *   For each file in `appState.fullScanData.allFilesList` (current local files):
            *   If its path is NOT in `restoreData.target_files`: Confirm with user and then (if `appState.directoryHandle` exists) use `fileInfo.entryHandle.remove()`. Update `appState.fullScanData` and tree view.
        *   For each file in `restoreData.target_files`:
            *   Attempt to read the current local file content using its `entryHandle`.
            *   Calculate its SHA-256 hash.
            *   If the local file doesn't exist: Notify user "File X listed in Version Y is missing locally. Cannot recreate."
            *   If hashes differ: Notify user "File X has been modified since Version Y. Content restore not yet implemented."
            *   If hashes match: Notify user "File X matches Version Y."
        *   After processing all files, re-scan the project (`processDirectoryEntryRecursive` if disk-based, or rebuild from cache if scaffold).
        *   Trigger a new snapshot with a description like "Restored to Version X (validation & prune only)". Update `appState.currentVersionId`.
        *   Refresh the version history display.