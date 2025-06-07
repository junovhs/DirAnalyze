use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::{get, get_service, post},
    Json, Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use reqwest::Client;
use serde_json::{json, Value};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenvy::dotenv().expect(".env file not found");

    // Create a single, reusable HTTP client.
    let client = Client::new();
    let assets_dir = std::path::PathBuf::from("..");

    let app = Router::new()
        // API route for LLM proxy
        .route("/api/llm_proxy", post(llm_proxy_handler))
        // WebSocket route
        .route("/ws", get(websocket_handler))
        // Static file server as a fallback
        .fallback_service(get_service(ServeDir::new(assets_dir)))
        // Make the HTTP client available to our handlers.
        .with_state(client);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
    println!("--> WebSocket endpoint available at ws://{}/ws", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// This function will handle all requests to `/api/llm_proxy`.
async fn llm_proxy_handler(
    State(client): State<Client>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    // Load the API key from the .env file.
    let api_key = match std::env::var("OPENAI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            eprintln!("--> ERROR: OPENAI_API_KEY not found in .env file.");
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let api_url = "https://api.openai.com/v1/chat/completions";

    println!("--> Forwarding request to LLM API...");

    let response = client
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

// This function will handle WebSocket upgrade requests.
async fn websocket_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

// This function will handle the actual WebSocket connection.
async fn handle_socket(mut socket: WebSocket) {
    println!("--> WebSocket client connected");
    // Simple echo loop
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(t)) => {
                println!("--> Received text message: {}", t);
                // Echo the message back
                if socket.send(Message::Text(format!("You said: {}", t))).await.is_err() {
                    println!("--> WebSocket client disconnected");
                    break;
                }
            }
            Ok(Message::Binary(b)) => {
                println!("--> Received binary message: {} bytes", b.len());
                if socket.send(Message::Binary(b)).await.is_err() {
                    println!("--> WebSocket client disconnected");
                    break;
                }
            }
            Ok(Message::Close(_)) => {
                println!("--> WebSocket client sent close message");
                break;
            }
            Err(e) => {
                println!("--> WebSocket error: {}", e);
                break;
            }
            _ => { // Ping, Pong, etc.
                // axum handles these automatically
            }
        }
    }
    println!("--> WebSocket connection closed");
}