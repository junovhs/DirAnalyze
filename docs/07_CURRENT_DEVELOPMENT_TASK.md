# DirAnalyze: Current Development Task & Next Steps

**Timestamp:** 2025-06-09T03:30:00Z (Replace with actual timestamp at end of session)
**Feature Focus:** Project Versioning System – *Restore Functionality*
**Relevant GitHub Issues:** #23 (UI for Version History), #24 (Core Restore Logic), #25 (Diff Storage)

---

## 1. Current State of the Versioning Feature

### 1.1 Completed Components

| Layer           | Component                                                | Status                                                                                           |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Database**    | `ProjectVersions`, `VersionFiles`, `OperationLog` tables | **Done** – created & migrated by Rust backend                                                    |
| **Backend API** | `POST /api/snapshot/initial` (Version 0)                 | **Done** – creates root snapshot                                                                 |
|                 | `POST /api/snapshot/create` (subsequent)                 | **Done** – stores child snapshots                                                                |
|                 | `GET  /api/versions` (list)                              | **Done** – returns ordered JSON of versions                                                      |
| **Frontend**    | *Snapshot creation*                                      | **Done** – initial snapshot after project load; subsequent snapshot after AI patch queue empties |
|                 | *Version History tab*                                    | **Done** – basic list rendering (read‑only)                                                      |

> **Note** — All snapshot creation currently sends the *full file list* with SHA‑256 hashes and sizes, but **not** file contents.  Full‑content storage/diffing will be addressed in Issue #25.

\### 1.2 HTML Template for a Version‑List Item

```html

<li data-version-id="[version.version_id]">
    <span class="version-id">Version ID: [version.version_id]</span>
    (Parent: [version.parent_version_id] or Initial Version)<br/>
    <span class="version-desc">[version.description]</span>
    <span class="version-time">Timestamp: [formattedTimestamp]</span>
</li>
```

\### 1.3 Key Front‑End State Variables

* `appState.currentVersionId` – ID of the latest snapshot for the loaded project.
* `appState.directoryHandle` – File‑System Access API handle for the project root (null for scaffolded projects).
* `appState.fullScanData`    – `{ directoryData, allFilesList }`; each file entry stores its `entryHandle` when the project originates from disk.

---

\## 2. Immediate Next Tasks – *Restore Functionality* (Phase 1)

The rollout is split into two short iterations so that UI work can be merged quickly while backend content‑restore design is still in flux.

\### 2.1 Phase 1.1 – **Front‑End Interactivity**  (#23)

| Goal | Allow users to select a version in the *Version History* tab and press **Restore Selected Version**.  No backend changes yet. |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |

\#### Required Front‑End Changes

1. **Make list items selectable**

   * In `fetchAndDisplayVersions` ( `js/main.js` ):

     * Add a `click` listener to every `<li>`.
     * On click: remove `active-version` class from siblings, add it to the clicked node, set `appState.selectedVersionToRestoreId`.
     * Enable the *Restore* button container `elements.restoreVersionActions`.

2. **Restore button stub**

   * In `setupEventListeners` add handler for `elements.restoreSelectedVersionBtn` that:

     1. Confirms selection exists; if not, alert user.
     2. `confirm("Are you sure … ?")` → if *Yes*: `console.log("User initiated restore …")` (placeholder).

3. **Styling**  (Add to `css/components.css`):

```css
\#versionHistoryList li.active-version {
background-color: var(--accent-color);
color: var(--button-active-text);
border-color: var(--accent-color);
}
\#versionHistoryList li.active-version .version-parent,
\#versionHistoryList li.active-version .version-time {
opacity: 0.85;
}
```

> Phase 1.1 delivers *visible* restore UX without touching data.

\### 2.2 Phase 1.2 – **Backend Restore Endpoint & Minimal Validation**  (#24)

| Goal | Provide an endpoint that returns the file list (+hashes) for a historical version so the front‑end can prune/validate the local project. |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |

\#### New REST Route

* `POST /api/versions/{version_id}/restore`
* **Handler** `handle_restore_version` (Axum) calls:

  * `version_control::get_files_and_hashes_for_version(conn, version_id)` → `Vec<ScannedFileInfo>`.

\#### Response Type

```rust
\#\[derive(Serialize)]
pub struct RestoreResponse {
status: String,                      // "success"
version\_id\_restored: i64,
target\_files: Vec<ScannedFileInfo>,  // path, hash, size
}
```

*No file content is returned yet.*

\#### Front‑End `initiateRestore(versionId)` Draft

1. `fetch('/api/versions/' + versionId + '/restore', { method: 'POST' })`.
2. Iterate `target_files`:

   * Read each local file (if present) via `entryHandle`.
   * Compute SHA‑256; compare to historical hash.
   * Report mismatches/missing files to user.
3. Find any local files **not** present in `target_files`; after confirmation, delete via `entryHandle.remove()`.
4. Refresh `appState.fullScanData`, re‑render tree, then create a **snapshot** with description *"Attempted restore to Version X (prune/validate)"*.

> This delivers partial restore (structure validation).  True content‑level rollback will follow in Phase 2.

---

\## 3. Future Task – *Phase 2: Diff‑Based Content Restore*  (#25)

1. Create `FileDiffs` table storing delta blobs (e.g., binary‑diff or text‑patch).
2. Snapshot creation logic stores **diff** from previous version instead of full content.
3. Restore endpoint reconstructs full file content on demand by replaying diffs from Version 0 → target.
4. Front‑end receives `{ files_to_write, files_to_delete }` with full contents for write‑back (or streams them individually on demand).

---

\## 4. Outstanding Questions / Decisions

1. **Storage Cost vs. Speed** – full content vs. diffs; Evaluate generic binary diff crate (e.g., `bsdiff‑rs`) vs. rolling‑hash chunk store.
2. **Project Root Path** – The backend currently has no direct access to the user’s disk path; all content travels through the client.  Continue client‑only file IO or shift to backend cache for cloud‑hosted projects?
3. **Deletion semantics** – Should a snapshot explicitly record *deleted* files, or is absence from `VersionFiles` sufficient?
4. **Access Control** – multi‑user scenarios & locking during restore.

---

## 5. Quick Reference – State Changes Across Phases

| Phase        | Front‑End Variable                    | When Updated                    |
| ------------ | ------------------------------------- | ------------------------------- |
| Any Snapshot | `appState.currentVersionId`           | After `/api/snapshot/*` success |
| Phase 1.1    | `appState.selectedVersionToRestoreId` | On version‑list click           |
| Phase 1.2    | *n/a* (uses existing vars)            | –                               |

---

## 6. Next Check‑In

*After Phase 1.1 is merged, coordinate with backend team for REST contract review before starting Phase 1.2 implementation.*

---

**End of File**
