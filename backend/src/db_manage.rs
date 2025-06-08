use rusqlite::{Connection, Result};

pub fn initialize_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "BEGIN;
        -- Table to store overall project versions or snapshots
        CREATE TABLE IF NOT EXISTS ProjectVersions (
            version_id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_version_id INTEGER,           -- NULL for initial version (v0)
            timestamp TEXT NOT NULL,             -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSZ)
            description TEXT,                    -- e.g., \"Initial load\", \"Applied patch: Fix login bug\"
            CONSTRAINT fk_parent_version
                FOREIGN KEY (parent_version_id)
                REFERENCES ProjectVersions (version_id)
                ON DELETE CASCADE
        );

        -- Table to store the state of each file at a particular project version
        CREATE TABLE IF NOT EXISTS VersionFiles (
            version_file_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_version_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,             -- Relative path within the project
            content_hash TEXT NOT NULL,          -- SHA-256 hash of the file content at this version
            file_size INTEGER NOT NULL,          -- Original size of the file at this version
            CONSTRAINT fk_project_version
                FOREIGN KEY (project_version_id)
                REFERENCES ProjectVersions (version_id)
                ON DELETE CASCADE,
            UNIQUE (project_version_id, file_path) -- Ensures one entry per file per version
        );

        -- Planned Log Table (from your signature_first_context_strategy/README.md, slightly adapted)
        -- This table is for more granular logging of operations.
        CREATE TABLE IF NOT EXISTS OperationLog (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            linked_project_version_id INTEGER, -- Optional: Link to a ProjectVersion snapshot if this op contributed to it
            timestamp TEXT NOT NULL,            -- Timestamp of the individual operation
            operation_type TEXT NOT NULL,       -- e.g., 'PROJECT_LOAD_SCAN', 'FILE_WRITE_PATCH', 'LLM_PROXY_REQUEST'
            target_entity TEXT,                 -- e.g., file path for file ops, or 'LLM_API_ENDPOINT' for prompts
            content_hash_before TEXT,           -- SHA-256 of content before op (if applicable)
            content_hash_after TEXT,            -- SHA-256 of content after op (if applicable)
            details_json TEXT                   -- JSON blob for additional info (e.g., prompt, patch instruction, diff snippet)
        );
        COMMIT;"
    )?;
    Ok(())
}

// Helper to open a connection (you might centralize this)
pub fn open_db_connection() -> Result<Connection> {
    // Store the database in the project's root, inside a .diranalyze_meta folder (or similar)
    // For now, let's put it relative to the backend's execution path.
    // You'll need to decide the final location.
    let db_path = ".diranalyze_db.sqlite3";
    Connection::open(db_path)
}