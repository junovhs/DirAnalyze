// diranalyze/backend/src/main.rs

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State as AxumState,
    },
    response::IntoResponse,
    routing::{get, get_service, post},
    Json, Router,
};
use reqwest::Client;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::services::ServeDir;
use rusqlite::params; // Added for the new handler

// --- Modules for database and version control ---
mod db_manage;
mod version_control;

// --- Structs for API requests & responses ---
#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct ScannedFileInfo {
    pub path: String,
    pub hash: String,
    pub size: i64,
}

#[derive(Debug, serde::Deserialize)]
pub struct InitialSnapshotRequest {
    pub project_root_name: String,
    pub files: Vec<ScannedFileInfo>,
}

#[derive(Debug, serde::Deserialize)]
pub struct SubsequentSnapshotRequest {
    pub parent_version_id: i64,
    pub description: String,
    pub files: Vec<ScannedFileInfo>,
}

// ** NEW STRUCT for listing versions **
#[derive(Debug, serde::Serialize)]
pub struct ProjectVersionInfo {
    version_id: i64,
    parent_version_id: Option<i64>, // Option because the first version has no parent
    timestamp: String,
    description: String,
}

// --- Application State for Axum ---
#[derive(Clone)]
struct AppState {
    http_client: Client,
    db_pool: Arc<Mutex<rusqlite::Connection>>,
}

// --- Main Application ---
#[tokio::main]
async fn main() {
    dotenvy::dotenv().expect(".env file not found");

    let db_file_path_str = ".diranalyze_db.sqlite3";

    // DB Initialization and Verification Phase (unchanged)
    println!("\n--- DATABASE INITIALIZATION & VERIFICATION PHASE ---");
    let absolute_db_path_for_log = PathBuf::from(db_file_path_str).canonicalize().map_or_else(|_| db_file_path_str.to_string(), |p| p.display().to_string());
    {
        println!("[DB_INIT] Attempting to open database for schema check at: '{}'", absolute_db_path_for_log);
        let conn_for_schema_check = db_manage::open_db_connection_with_path(db_file_path_str).expect("Failed to open DB for schema check");
        println!("[DB_INIT] Database opened for schema check.");
        db_manage::initialize_database(&conn_for_schema_check).expect("Failed to initialize database schema during check");
        println!("[DB_INIT] Schema check connection scope ending, changes should be flushed as connection is dropped.");
    }
    println!("--- DATABASE INITIALIZATION & VERIFICATION PHASE COMPLETE ---\n");

    // Server Setup (unchanged)
    println!("[SERVER_SETUP] Opening new database connection for server operations at: '{}'", absolute_db_path_for_log);
    let db_conn_for_server = db_manage::open_db_connection_with_path(db_file_path_str).expect("Failed to re-open DB connection for server");
    db_manage::initialize_database(&db_conn_for_server).expect("Failed to re-initialize database for server use");
    println!("[SERVER_SETUP] Database connection for server ready.");
    let db_pool = Arc::new(Mutex::new(db_conn_for_server));

    let http_client = Client::new();
    let app_state = AppState { http_client, db_pool };
    let assets_dir = std::path::PathBuf::from("..");

    let app = Router::new()
        .route("/api/llm_proxy", post(llm_proxy_handler))
        .route("/ws", get(websocket_handler))
        .route("/api/snapshot/initial", post(handle_create_initial_snapshot))
        .route("/api/snapshot/create", post(handle_create_subsequent_snapshot))
        // ** NEW ROUTE for listing versions **
        .route("/api/versions", get(list_project_versions_handler))
        .fallback_service(get_service(ServeDir::new(assets_dir)))
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// --- API Handlers ---
async fn llm_proxy_handler( AxumState(state): AxumState<AppState>, Json(payload): Json<Value>) -> Result<Json<Value>, axum::http::StatusCode> {
    // ... (unchanged)
    let api_key = match std::env::var("OPENAI_API_KEY") { Ok(key) => key, Err(_) => { eprintln!("--> ERROR: OPENAI_API_KEY not found in .env file."); return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR); } };
    let api_url = "https://api.openai.com/v1/chat/completions";
    println!("--> LLM_PROXY: Forwarding request to LLM API...");
    let response = state.http_client.post(api_url).bearer_auth(api_key).json(&payload).send().await;
    match response {
        Ok(res) => {
            if res.status().is_success() { println!("--> LLM_PROXY: Success from LLM API"); let body: Value = res.json().await.unwrap_or_else(|_| json!({"error": "Failed to parse LLM response"})); Ok(Json(body)) }
            else { let status = res.status(); let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string()); eprintln!("--> LLM_PROXY: Error from LLM API ({}): {}", status, error_text); Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR) }
        }
        Err(e) => { eprintln!("--> LLM_PROXY: Failed to send request to LLM API: {}", e); Err(axum::http::StatusCode::BAD_GATEWAY) }
    }
}

async fn handle_create_initial_snapshot(
    AxumState(state): AxumState<AppState>,
    Json(payload): Json<InitialSnapshotRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    // ... (unchanged)
    println!("--> API_SNAPSHOT: Received request for project: {}", payload.project_root_name);
    let files_to_snapshot_for_vc_mod: Vec<version_control::ScannedFileInfo> = payload.files.into_iter().map(|f| {
        version_control::ScannedFileInfo { path: f.path, hash: f.hash, size: f.size }
    }).collect();
    let mut conn_guard = state.db_pool.lock().await;
    let version_id_result = version_control::create_initial_project_snapshot(&mut conn_guard, &payload.project_root_name, &files_to_snapshot_for_vc_mod);
    match version_id_result {
        Ok(version_id) => {
            println!("--> API_SNAPSHOT: Successfully created initial snapshot. Version ID: {}", version_id);
            Ok(Json(json!({ "message": "Initial snapshot created successfully", "version_id": version_id })))
        }
        Err(e) => {
            eprintln!("--> API_SNAPSHOT: Error creating initial snapshot: {:?}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn handle_create_subsequent_snapshot(
    AxumState(state): AxumState<AppState>,
    Json(payload): Json<SubsequentSnapshotRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    // ... (unchanged)
    println!("--> API_SNAPSHOT: Received request to create subsequent snapshot linked to parent version: {}", payload.parent_version_id);
    let files_to_snapshot_for_vc_mod: Vec<version_control::ScannedFileInfo> = payload.files.into_iter().map(|f| {
        version_control::ScannedFileInfo { path: f.path, hash: f.hash, size: f.size }
    }).collect();
    let mut conn_guard = state.db_pool.lock().await;
    let version_id_result = version_control::create_subsequent_project_snapshot(&mut conn_guard, payload.parent_version_id, &payload.description, &files_to_snapshot_for_vc_mod);
    match version_id_result {
        Ok(version_id) => {
            println!("--> API_SNAPSHOT: Successfully created subsequent snapshot. New Version ID: {}", version_id);
            Ok(Json(json!({ "message": "Subsequent snapshot created successfully", "version_id": version_id })))
        }
        Err(e) => {
            eprintln!("--> API_SNAPSHOT: Error creating subsequent snapshot: {:?}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// ** NEW HANDLER FUNCTION for listing versions **
async fn list_project_versions_handler(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<Vec<ProjectVersionInfo>>, axum::http::StatusCode> {
    println!("--> API_VERSIONS: Received request to list project versions.");

    let conn_guard = state.db_pool.lock().await;

    let mut stmt = match conn_guard.prepare("SELECT version_id, parent_version_id, timestamp, description FROM ProjectVersions ORDER BY version_id DESC") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("--> API_VERSIONS: Error preparing SQL statement: {:?}", e);
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let versions_iter = match stmt.query_map([], |row| {
        Ok(ProjectVersionInfo {
            version_id: row.get(0)?,
            parent_version_id: row.get(1)?,
            timestamp: row.get(2)?,
            description: row.get(3).unwrap_or_else(|_| String::from("No description")), // Provide default if NULL
        })
    }) {
        Ok(iter) => iter,
        Err(e) => {
            eprintln!("--> API_VERSIONS: Error executing query: {:?}", e);
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let mut versions = Vec::new();
    for version_result in versions_iter {
        match version_result {
            Ok(version_info) => versions.push(version_info),
            Err(e) => {
                eprintln!("--> API_VERSIONS: Error processing row: {:?}", e);
                // Optionally skip problematic rows or return an error
            }
        }
    }
    
    println!("--> API_VERSIONS: Successfully retrieved {} versions.", versions.len());
    Ok(Json(versions))
}


async fn websocket_handler( ws: WebSocketUpgrade, AxumState(_state): AxumState<AppState>) -> impl IntoResponse {
    // ... (unchanged)
    println!("--> WS: Upgrade request received.");
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) { 
    // ... (unchanged)
    println!("--> WS: Client connected");
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(t)) => { if socket.send(Message::Text(format!("Echo: {}", t))).await.is_err() { break; } }
            _ => { /* do nothing */ }
        }
    }
    println!("--> WS: Connection closed.");
}