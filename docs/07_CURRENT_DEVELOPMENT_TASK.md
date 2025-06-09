# DirAnalyze: Current Development Task & Next Steps

**Timestamp:** 2025-06-09T03:00:00Z (Note: Replace with actual timestamp at end of session)
**Feature Focus:** Project Versioning System - Restore Functionality
**Relevant GitHub Issues:** #23 (UI for Version History - partially done), #24 (Core Restore Logic)

## 1. Current State of Versioning Feature

### 1.1. Completed Components:
*   **Backend Database Schema:**
    *   `ProjectVersions` table: Stores snapshot metadata (`version_id`, `parent_version_id`, `timestamp`, `description`). `AUTOINCREMENT` on `version_id`.
    *   `VersionFiles` table: Stores `project_version_id`, `file_path`, `content_hash` (SHA-256), `file_size` for every file in each snapshot.
    *   `OperationLog` table: For general logging; snapshot events are logged here.
    *   Schema is initialized by the Rust backend (`db_manage.rs`, `version_control.rs`).
*   **Backend API - Initial Snapshot (Version 0):**
    *   Endpoint: `POST /api/snapshot/initial`
    *   Accepts: `{ project_root_name: String, files: [{ path: String, hash: String, size: i64 }] }`
    *   Action: Creates `ProjectVersions` entry (parent_id=NULL), populates `VersionFiles`.
    *   File: `backend/src/main.rs` (handler: `handle_create_initial_snapshot`), `backend/src/version_control.rs` (logic: `create_initial_project_snapshot`).
*   **Backend API - Subsequent Snapshots:**
    *   Endpoint: `POST /api/snapshot/create`
    *   Accepts: `{ parent_version_id: i64, description: String, files: [{ path: String, hash: String, size: i64 }] }`
    *   Action: Creates `ProjectVersions` entry (linked to `parent_version_id`), populates `VersionFiles` for the new state.
    *   File: `backend/src/main.rs` (handler: `handle_create_subsequent_snapshot`), `backend/src/version_control.rs` (logic: `create_subsequent_project_snapshot`).
*   **Backend API - List Versions:**
    *   Endpoint: `GET /api/versions`
    *   Action: Queries `ProjectVersions` table, returns JSON array: `[{ version_id, parent_version_id, timestamp, description }]` ordered by `version_id` DESC.
    *   File: `backend/src/main.rs` (handler: `list_project_versions_handler`).
*   **Frontend - Initial Snapshot Trigger:**
    *   After local folder processing, `main.js` (`verifyAndProcessDirectory` -> `createInitialSnapshot`) iterates `appState.fullScanData.allFilesList`.
    *   For each file with an `entryHandle`: reads content, calculates SHA-256 hash using `crypto.subtle.digest` (via `utils.js/calculateSHA256`).
    *   Sends payload to `/api/snapshot/initial`.
    *   `appState.currentVersionId` is set from the response.
    *   Files: `js/main.js`, `js/utils.js`.
*   **Frontend - Subsequent Snapshot Trigger (AI Patcher):**
    *   After AI patches are applied and the review modal queue is empty, `aiPatcher.js` (`closeDiffModalAndProceed` -> `triggerSubsequentSnapshot`) re-scans/re-hashes all files from `appState.fullScanData` (using current content from editor cache or disk via `fileSystem.readFileContent`).
    *   Sends payload (including current `appState.currentVersionId` as `parent_version_id`) to `/api/snapshot/create`.
    *   `appState.currentVersionId` is updated with the new version ID from the response.
    *   Files: `js/aiPatcher.js`, `js/main.js` (for `appState.currentVersionId`).
*   **Frontend - Version History Display (Basic):**
    *   New "Version History" tab added in `index.html`.
    *   `js/main.js` (`populateElements`) identifies `versionHistoryList` (ul) and `refreshVersionsBtn`.
    *   `js/main.js` (`fetchAndDisplayVersions`) calls `/api/versions` and populates `versionHistoryList` with `<li>` elements showing version details.
    *   `js/uiManager.js` (`activateTab`) calls `fetchAndDisplayVersions` when the "Version History" tab is activated.
    *   Files: `index.html`, `js/main.js`, `js/uiManager.js`.

### 1.2. Current HTML Structure for Version History Item (in `js/main.js` `fetchAndDisplayVersions`):
```html
<li data-version-id="[version.version_id]">
    <span class="version-id">Version ID: [version.version_id]</span>(Parent: [version.parent_version_id] or Initial Version)<br>
    <span class="version-desc">[version.description]</span>
    <span class="version-time">Timestamp: [formattedTimestamp]</span>
</li>```

### 1.3. Key State Variables:
*   `appState.currentVersionId` (in `js/main.js`): Holds the ID of the most recently created version for the currently loaded project. Crucial for linking subsequent snapshots.
*   `appState.directoryHandle`: Browser File System Access API handle for the root project directory. Null for scaffolded projects.
*   `appState.fullScanData`: Contains `directoryData` (tree structure) and `allFilesList`. `allFilesList` items have `entryHandle` if loaded from disk.

## 2. Immediate Next Task: Implement Restore Functionality - Phase 1 (Frontend Interaction & Backend Endpoint Setup)

**Goal:** Allow users to select a version from the "Version History" tab and initiate a restore process. This phase focuses on the UI interaction and setting up the backend endpoint, with a simplified content retrieval strategy for now.

### 2.1. Frontend Changes (Issue #23 continuation, leading into #24)

**Location:** `js/main.js` (event handling, restore initiation), `index.html` (button enabling).

*   **Make Version List Items Clickable & Track Selection:**
    *   In `fetchAndDisplayVersions` (inside `js/main.js`):
        *   When creating each `<li>` for a version, add an event listener to it.
        *   On click:
            *   Visually highlight the selected `<li>` (e.g., add an 'active-version' class). Remove highlighting from previously selected items.
            *   Store the `version.version_id` of the clicked item in a new `appState` variable, e.g., `appState.selectedVersionToRestoreId`.
            *   Enable the "Restore Selected Version" button (`restoreSelectedVersionBtn`).
*   **"Restore Selected Version" Button Logic:**
    *   In `setupEventListeners` (inside `js/main.js`):
        *   Add a click listener to `elements.restoreSelectedVersionBtn`.
        *   On click:
            1.  Check if `appState.selectedVersionToRestoreId` is set. If not, do nothing or notify user to select a version.
            2.  Show a confirmation dialog (e.g., `if (confirm("Are you sure you want to restore to Version " + appState.selectedVersionToRestoreId + "? This will overwrite local files if a project is loaded from disk.")) { ... }`).
            3.  If confirmed:
                *   Change loader text: `elements.loader.textContent = "Restoring to Version " + appState.selectedVersionToRestoreId + "..."; elements.loader.classList.add('visible');`
                *   Call a new function, e.g., `initiateRestore(appState.selectedVersionToRestoreId)`.
*   **New Function: `initiateRestore(versionId)` (in `js/main.js`):**
    *   This function will call the new backend restore endpoint (to be created).
    *   `const response = await fetch('/api/versions/' + versionId + '/restore', { method: 'POST' });`
    *   Handle response:
        *   If not `response.ok`: Show error notification, log details.
        *   If `response.ok`:
            *   `const restoreData = await response.json();` This `restoreData` should contain `{ status: 'success', version_id_restored: X, files_to_write: [{ path: String, content: String }] }` (see backend spec below).
            *   Loop through `restoreData.files_to_write`.
            *   For each file:
                *   If `appState.directoryHandle` exists (project loaded from disk):
                    *   Use `fileSystem.writeFileContent(appState.directoryHandle, fileData.path, fileData.content);`
                    *   Update editor cache: `fileEditor.updateFileInEditorCache(fileData.path, fileData.content, fileData.content, false);` (mark as not patched, not unsaved initially after restore).
                *   Else (scaffolded project):
                    *   Just update editor cache: `fileEditor.updateFileInEditorCache(fileData.path, fileData.content, fileData.content, false);`
            *   **File Deletion Handling (Simplified for now):** The current `VersionFiles` table only tracks *existing* files for a version. If a restore means some current files should be deleted because they didn't exist in the target version, the backend needs to provide this info, or the frontend needs to diff the file lists. For this immediate step, we might defer complex deletion or assume backend sends all files for the target version and frontend replaces/creates, but doesn't explicitly delete non-listed files.
            *   After all files are processed:
                *   Call `fileSystem.processDirectoryEntryRecursive` again on `appState.directoryHandle` (if it exists) to refresh `appState.fullScanData` with the restored state. If no `directoryHandle` (scaffold), this step needs to be adapted to rebuild `fullScanData` from the `fileEditor` cache.
                *   Call `treeView.renderTree` and `uiManager.refreshAllUI`.
                *   **Trigger a new snapshot:** Call backend API `/api/snapshot/create` with `parent_version_id: appState.currentVersionId` (which *was* the ID before restore) and description like "Restored to Version X". Update `appState.currentVersionId` with the new ID from this snapshot.
                *   Fetch and display versions again to show the new "Restored to..." entry.
                *   Show success notification.
            *   Finally: `elements.loader.classList.remove('visible');`

### 2.2. Backend Changes (Issue #24)

**Location:** `backend/src/main.rs` (new handler and route), `backend/src/version_control.rs` (new logic function).

*   **New Struct for Restore Response (in `main.rs`):**
    ```rust
    #[derive(Debug, serde::Serialize)]
    pub struct FileContentInfo {
        path: String,
        content: String, // For simplicity, sending full content for now
    }

    #[derive(Debug, serde::Serialize)]
    pub struct RestoreResponse {
        status: String,
        version_id_restored: i64,
        files_to_write: Vec<FileContentInfo>,
        // Later: files_to_delete: Vec<String>
    }
    ```
*   **New Function: `get_files_for_version(conn: &Connection, version_id: i64) -> Result<Vec<ScannedFileInfo>>` (in `version_control.rs`):**
    *   This function will query the `VersionFiles` table for a given `version_id`.
    *   It will return a `Vec<ScannedFileInfo>` (path, hash, size).
    *   **Crucial Content Retrieval Logic (Placeholder/Simplification for this step):**
        *   For this immediate implementation, the backend **cannot yet reconstruct historical file content** because we are only storing hashes in `VersionFiles` and have not implemented diffs (Issue #25) or a separate content store for Version 0 files that might have been modified on disk.
        *   **Temporary Strategy:** The backend will send the list of `ScannedFileInfo` (path, hash, size) that *defined* the target version. The frontend will be responsible for finding/reading these files (which is problematic if they've changed or been deleted since that version was made).
        *   **A better temporary strategy (more work but feasible):** When the `/api/versions/{version_id}/restore` endpoint is hit, the backend would:
            1. Fetch the `VersionFiles` (path, hash, size) for the requested `version_id`.
            2. For each file path, it would then attempt to read the *current content* from disk (if the project is on disk and the backend had a path to it – this is a current limitation as the Rust backend doesn't directly access user files).
            3. **This implies a shift: if restoring, the backend might need to be *told* the project root path by the frontend, or the frontend handles all file reading for restore based on the hash list.**
            4. **Revised Temporary Strategy for Backend (simplest for backend, pushes work to frontend or defers full content restore):** The backend will *only* return the list of `ScannedFileInfo` (path, hash, size) for the target `version_id`. The `RestoreResponse` struct will be:
                ```rust
                #[derive(Debug, serde::Serialize)]
                pub struct RestoreResponse {
                    status: String,
                    version_id_restored: i64,
                    target_file_states: Vec<ScannedFileInfo>, // Path, HASH, Size
                }
                ```
               The frontend's `initiateRestore` will then have to:
               a. Iterate `target_file_states`.
               b. For each file, *attempt* to read its content from `appState.directoryHandle` (if available).
               c. Calculate the hash of the currently read content.
               d. **This strategy is flawed for true restore to a past state if files changed.** We are essentially just re-validating current files against an old manifest.
        *   **Best approach for now (to make restore somewhat meaningful without diffs yet):** When a version is created (initial or subsequent), the *backend* needs to store the full content of *all* files for *that specific version* if it's Version 0, or the diffs for subsequent versions. Since diffs aren't done, and we want to enable restore, let's assume a temporary, inefficient strategy for the backend:
            *   **New Table (Conceptual, or extend `VersionFiles`):** `VersionFileContents(version_file_id PK, content BLOB)`.
            *   When `create_initial_project_snapshot` is called, the frontend must send file content along with hash/size. Backend stores this.
            *   When `create_subsequent_project_snapshot` is called, frontend sends new content of all files. Backend stores this.
            *   **This is highly inefficient for storage but allows restore.**
            *   **Alternative if frontend sends content for restore only:**
                *   For the `POST /api/versions/{version_id}/restore` endpoint:
                    *   The backend retrieves the list of files (`file_path`) from `VersionFiles` for that `version_id`.
                    *   The `RestoreResponse` will then be: `files_to_reconstruct: Vec<{path: String}>`.
                    *   The frontend receives this list. For each path, it reads the current file content, and *sends it back to the backend* on a *new endpoint* like `POST /api/files/get_historical_content?version_id=X&path=Y`. This is overly chatty.

Let's choose a pragmatic path for this phase that enables some form of restore without full content storage in DB yet:
**Revised Backend Restore Logic (Minimal Change, Focus on Frontend):**
*   `version_control.rs` will have a function `get_file_paths_for_version(conn: &Connection, version_id: i64) -> Result<Vec<String>>` returning just file paths.
*   The `/api/versions/{version_id}/restore` handler in `main.rs` will call this.
*   `RestoreResponse` will be:
    ```rust
    #[derive(Debug, serde::Serialize)]
    pub struct RestoreResponse {
        status: String,
        version_id_restored: i64,
        file_paths_in_version: Vec<String>, // List of file paths that existed in that version
    }
    ```
*   **Frontend `initiateRestore`:**
    1.  Gets `file_paths_in_version`.
    2.  Compares with `appState.fullScanData.allFilesList`.
    3.  Files in current scan but NOT in `file_paths_in_version` should be marked for deletion (frontend uses `entryHandle.remove()`).
    4.  Files in `file_paths_in_version`: Frontend **cannot actually restore their historical content with this backend strategy yet**. It can only ensure these paths exist. If a file from the list is missing locally, it cannot recreate it.
    5.  This makes "Restore" more of a "Prune to version's file list and re-scan". This is not a true content restore.

This is a tricky point. A true restore needs content. Storing all content for all versions is too much. Diffs are the way.
For **this immediate task**, let's make the backend return the *hashes* for the files in that version. The frontend can then check if local files still match those hashes. It's still not a full restore, but it's a step.

**Final Revised Backend Restore Logic for this Phase:**
*   `version_control.rs`: `get_files_and_hashes_for_version(conn: &Connection, version_id: i64) -> Result<Vec<ScannedFileInfo>>` (returns path, hash, size for the target version).
*   `/api/versions/{version_id}/restore` handler in `main.rs` calls this.
*   `RestoreResponse`:
    ```rust
    #[derive(Debug, serde::Serialize)]
    pub struct RestoreResponse {
        status: String,
        version_id_restored: i64,
        target_files: Vec<ScannedFileInfo>, // path, hash, size
    }
    ```
*   **Frontend `initiateRestore`:**
    1. Gets `target_files`.
    2. For each file in `target_files`:
        * Reads current local content using `entryHandle`.
        * Hashes it.
        * If hashes differ, notify user: "File X has changed since Version Y. Restore cannot revert content yet."
        * If file doesn't exist locally: Notify "File X from Version Y is missing. Restore cannot recreate it yet."
    3. Files in current local scan NOT in `target_files`:
        * If `appState.directoryHandle` exists, use `entryHandle.remove()` after confirmation.
        * Update `appState.fullScanData` and UI.
    4. After "processing", trigger a new snapshot: `description: "Attempted restore to Version X. Files pruned/validated."`.
    5. This is still not a content restore but sets up the UI flow.

*   **New Route (in `main.rs`):**
    *   Path: `/api/versions/{version_id}/restore` (using Axum path extractor for `version_id`).
    *   Method: `POST` (as it's an action, though no body needed from frontend for this strategy).
*   **Handler Logic (`handle_restore_version` in `main.rs`):**
    1.  Extract `version_id` from path.
    2.  Lock DB pool.
    3.  Call `version_control::get_files_and_hashes_for_version(&conn, version_id)`.
    4.  Construct `RestoreResponse` with the list of `ScannedFileInfo`.
    5.  Return JSON response.

### 2.3. Error Handling and User Feedback
*   Clear notifications for success, failure, files changed since versioning, files missing.

This is a substantial but logical next chunk of work. The key challenge here is the content retrieval for restore, which we are simplifying for this phase, focusing on setting up the mechanisms. True content restore will depend on implementing Issue #25 (diffs).