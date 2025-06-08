use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State as AxumState, // Renamed to avoid conflict if we use our own State struct
    },
    response::IntoResponse,
    routing::{get, get_service, post},
    Json, Router,
};
use reqwest::Client;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex; // For Arc<Mutex<Connection>>
use tower_http::services::ServeDir;

// --- Modules for database and version control ---
mod db_manage;
mod version_control; // This module should contain ScannedFileInfo and create_initial_project_snapshot

// --- Structs for API requests (if needed directly in main.rs handlers) ---
// Re-defining or aliasing ScannedFileInfo if it's used in request bodies for handlers in this file.
// If version_control::ScannedFileInfo is public, you could also `use crate::version_control::ScannedFileInfo;`
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

// --- Application State for Axum ---
// This will hold shared resources like the HTTP client and DB connection pool.
#[derive(Clone)]
struct AppState {
    http_client: Client,
    db_pool: Arc<Mutex<rusqlite::Connection>>,
}

// --- Main Application ---
#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenvy::dotenv().expect(".env file not found");

    // --- Database Initialization ---
    // Open a single connection. For a web server, a connection pool (like r2d2 or deadpool)
    // is usually better for handling concurrent requests.
    // For simplicity here with rusqlite and Arc<Mutex>, we serialize access.
    let db_conn = db_manage::open_db_connection().expect("Failed to open DB connection");
    db_manage::initialize_database(&db_conn).expect("Failed to initialize database");
    let db_pool = Arc::new(Mutex::new(db_conn)); // Wrap in Arc<Mutex> for sharing
    // --- End Database Initialization ---

    // Create a single, reusable HTTP client.
    let http_client = Client::new();

    // Create the application state
    let app_state = AppState {
        http_client,
        db_pool,
    };

    let assets_dir = std::path::PathBuf::from("..");

    let app = Router::new()
        // API route for LLM proxy
        .route("/api/llm_proxy", post(llm_proxy_handler))
        // WebSocket route
        .route("/ws", get(websocket_handler))
        // New endpoint for creating the initial project snapshot
        .route("/api/snapshot/initial", post(handle_create_initial_snapshot))
        // Static file server as a fallback
        .fallback_service(get_service(ServeDir::new(assets_dir)))
        // Provide the application state to all handlers
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
    println!("--> WebSocket endpoint available at ws://{}/ws", addr);
    println!("--> Database initialized and accessible.");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// --- API Handlers ---

// Handler for LLM Proxy
async fn llm_proxy_handler(
    AxumState(state): AxumState<AppState>, // Use the AxumState extractor with our AppState
    Json(payload): Json<Value>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let api_key = match std::env::var("OPENAI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            eprintln!("--> ERROR: OPENAI_API_KEY not found in .env file.");
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let api_url = "https://api.openai.com/v1/chat/completions";
    println!("--> Forwarding request to LLM API...");

    let response = state.http_client // Use client from AppState
        .post(api_url)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await;

    match response {
        Ok(res) => {
            if res.status().is_success() {
                println!("--> Success from LLM API");
                let body: Value = res
                    .json()
                    .await
                    .unwrap_or_else(|_| json!({"error": "Failed to parse LLM response"}));
                Ok(Json(body))
            } else {
                let status = res.status();
                let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                eprintln!("--> Error from LLM API ({}): {}", status, error_text);
                Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(e) => {
            eprintln!("--> Failed to send request to LLM API: {}", e);
            Err(axum::http::StatusCode::BAD_GATEWAY)
        }
    }
}

// Placeholder handler for creating the initial snapshot
async fn handle_create_initial_snapshot(
    AxumState(state): AxumState<AppState>,
    Json(payload): Json<InitialSnapshotRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    println!(
        "--> Received request to create initial snapshot for project: {}",
        payload.project_root_name
    );
    println!("--> Files to snapshot: {} files", payload.files.len());

    // Convert version_control::ScannedFileInfo to the local version if necessary,
    // or ensure the version_control module uses the same struct definition.
    // For now, assuming InitialSnapshotRequest's ScannedFileInfo is compatible.
    let files_to_snapshot: Vec<version_control::ScannedFileInfo> = payload.files.into_iter().map(|f| {
        version_control::ScannedFileInfo { // Explicitly map to the struct defined in version_control
            path: f.path,
            hash: f.hash,
            size: f.size,
        }
    }).collect();


    // Acquire the database connection lock
    let mut conn_guard = state.db_pool.lock().await;

    match version_control::create_initial_project_snapshot(
        &mut conn_guard, // Pass the locked connection
        &payload.project_root_name,
        &files_to_snapshot, // Pass the correctly typed Vec
    ) {
        Ok(version_id) => {
            println!(
                "--> Successfully created initial snapshot. Version ID: {}",
                version_id
            );
            Ok(Json(json!({
                "message": "Initial snapshot created successfully",
                "version_id": version_id
            })))
        }
        Err(e) => {
            eprintln!("--> Error creating initial snapshot: {:?}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Handler for WebSocket
async fn websocket_handler(
    ws: WebSocketUpgrade,
    AxumState(_state): AxumState<AppState>, // Can access AppState here if needed
) -> impl IntoResponse {
    println!("--> WebSocket upgrade request received.");
    ws.on_upgrade(handle_socket)
}

// Actual WebSocket connection handler
async fn handle_socket(mut socket: WebSocket) {
    println!("--> WebSocket client connected");
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(t)) => {
                println!("--> Received text message via WebSocket: {}", t);
                if socket
                    .send(Message::Text(format!("Echo from backend: {}", t)))
                    .await
                    .is_err()
                {
                    println!("--> WebSocket client disconnected (send error).");
                    break;
                }
            }
            Ok(Message::Binary(b)) => {
                println!("--> Received binary message: {} bytes", b.len());
                // Echo back binary data if needed, or process it
                if socket.send(Message::Binary(b)).await.is_err() {
                     println!("--> WebSocket client disconnected (send error).");
                    break;
                }
            }
            Ok(Message::Close(_)) => {
                println!("--> WebSocket client sent close message.");
                break;
            }
            Err(e) => {
                println!("--> WebSocket error: {}", e);
                break;
            }
            _ => { // Ping, Pong, etc.
                  // axum handles these automatically unless you specify otherwise
                println!("--> Received other WebSocket message type.");
            }
        }
    }
    println!("--> WebSocket connection closed.");
}