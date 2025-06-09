// diranalyze/backend/src/version_control.rs

use rusqlite::{Connection, Result, params};
use chrono::{Utc};

// Define a simple struct to represent file info coming from the frontend/scanner
#[derive(Debug, serde::Deserialize)] // Deserialize if it comes from an API request
pub struct ScannedFileInfo {
    pub path: String,        // Relative path from project root
    pub hash: String,        // SHA-256 content hash
    pub size: i64,           // File size in bytes
}

/// Creates the initial version (Version 0) of the project in the database.
pub fn create_initial_project_snapshot(
    conn: &mut Connection,
    project_root_name: &str,
    files: &[ScannedFileInfo],
) -> Result<i64> {
    let tx = conn.transaction()?;

    let current_timestamp = Utc::now().to_rfc3339();
    let description = format!("Initial snapshot of project: {}", project_root_name);

    // 1. Insert into ProjectVersions with a NULL parent
    tx.execute(
        "INSERT INTO ProjectVersions (parent_version_id, timestamp, description) VALUES (NULL, ?1, ?2)",
        params![current_timestamp, description],
    )?;
    let version_id = tx.last_insert_rowid();

    // 2. Insert all files into VersionFiles for this version_id
    let mut stmt_vf = tx.prepare(
        "INSERT INTO VersionFiles (project_version_id, file_path, content_hash, file_size) VALUES (?1, ?2, ?3, ?4)"
    )?;
    for file_info in files {
        stmt_vf.execute(params![
            version_id,
            file_info.path,
            file_info.hash,
            file_info.size
        ])?;
    }
    drop(stmt_vf);

    // 3. Log this operation
    let op_details = serde_json::json!({
        "project_name": project_root_name,
        "files_count": files.len(),
    });
    tx.execute(
        "INSERT INTO OperationLog (linked_project_version_id, timestamp, operation_type, target_entity, details_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            version_id,
            current_timestamp,
            "PROJECT_SNAPSHOT_INITIAL",
            project_root_name,
            op_details.to_string()
        ],
    )?;

    tx.commit()?;
    Ok(version_id)
}

/// ** NEW FUNCTION **
/// Creates a subsequent version of the project, linked to a parent version.
pub fn create_subsequent_project_snapshot(
    conn: &mut Connection,
    parent_version_id: i64,
    description: &str,
    files: &[ScannedFileInfo],
) -> Result<i64> {
    let tx = conn.transaction()?;

    let current_timestamp = Utc::now().to_rfc3339();

    // 1. Insert into ProjectVersions, linking to the parent
    tx.execute(
        "INSERT INTO ProjectVersions (parent_version_id, timestamp, description) VALUES (?1, ?2, ?3)",
        params![parent_version_id, current_timestamp, description],
    )?;
    let version_id = tx.last_insert_rowid();

    // 2. Insert all files for this new version.
    // This captures the complete state of the project at this new version.
    let mut stmt_vf = tx.prepare(
        "INSERT INTO VersionFiles (project_version_id, file_path, content_hash, file_size) VALUES (?1, ?2, ?3, ?4)"
    )?;
    for file_info in files {
        stmt_vf.execute(params![
            version_id,
            file_info.path,
            file_info.hash,
            file_info.size
        ])?;
    }
    drop(stmt_vf);

    // 3. Log this subsequent snapshot operation
    let op_details = serde_json::json!({
        "parent_version": parent_version_id,
        "files_count": files.len(),
        "description": description,
    });
    tx.execute(
        "INSERT INTO OperationLog (linked_project_version_id, timestamp, operation_type, target_entity, details_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            version_id,
            current_timestamp,
            "PROJECT_SNAPSHOT_SUBSEQUENT",
            "project", // Target entity is the project itself
            op_details.to_string()
        ],
    )?;

    tx.commit()?;
    Ok(version_id)
}


// --- Example Usage (for testing this module, not for direct API use yet) ---
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db_manage;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
        db_manage::initialize_database(&conn).expect("Failed to initialize test DB schema");
        conn
    }

    #[test]
    fn test_create_initial_snapshot() {
        let mut conn = setup_test_db();
        let project_name = "MyTestProject";
        let files_data = vec![
            ScannedFileInfo { path: "MyTestProject/README.md".to_string(), hash: "abc123readmehash".to_string(), size: 1024 },
            ScannedFileInfo { path: "MyTestProject/src/main.js".to_string(), hash: "def456mainjshash".to_string(), size: 2048 },
        ];
        let version_id = create_initial_project_snapshot(&mut conn, project_name, &files_data).unwrap();
        assert_eq!(version_id, 1);
        let mut stmt_pv = conn.prepare("SELECT parent_version_id FROM ProjectVersions WHERE version_id = 1").unwrap();
        let parent_id: Option<i64> = stmt_pv.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(parent_id, None);
    }

    #[test]
    fn test_create_subsequent_snapshot() {
        let mut conn = setup_test_db();
        let project_name = "MyTestProject";
        let initial_files = vec![
            ScannedFileInfo { path: "MyTestProject/file.txt".to_string(), hash: "hash_v1".to_string(), size: 100 }
        ];
        let initial_version_id = create_initial_project_snapshot(&mut conn, project_name, &initial_files).unwrap();

        let updated_files = vec![
            ScannedFileInfo { path: "MyTestProject/file.txt".to_string(), hash: "hash_v2".to_string(), size: 110 },
            ScannedFileInfo { path: "MyTestProject/new_file.txt".to_string(), hash: "new_hash".to_string(), size: 50 },
        ];
        let description = "Applied a patch";
        
        let subsequent_version_id = create_subsequent_project_snapshot(&mut conn, initial_version_id, description, &updated_files).unwrap();
        
        assert_eq!(subsequent_version_id, 2);

        // Verify parent link
        let mut stmt_pv = conn.prepare("SELECT parent_version_id, description FROM ProjectVersions WHERE version_id = ?1").unwrap();
        let (parent_id, desc_from_db): (i64, String) = stmt_pv.query_row(params![subsequent_version_id], |row| Ok((row.get(0)?, row.get(1)?))).unwrap();
        assert_eq!(parent_id, initial_version_id);
        assert_eq!(desc_from_db, description);

        // Verify file count for the new version
        let mut stmt_vf_count = conn.prepare("SELECT COUNT(*) FROM VersionFiles WHERE project_version_id = ?1").unwrap();
        let file_count: i64 = stmt_vf_count.query_row(params![subsequent_version_id], |row| row.get(0)).unwrap();
        assert_eq!(file_count, 2);
    }
}