use axum::{
    extract::State,
    routing::{get_service, post},
    Json, Router,
};
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
        // Add our new API route.
        .route("/api/llm_proxy", post(llm_proxy_handler))
        // Keep the static file server as a fallback.
        .fallback_service(get_service(ServeDir::new(assets_dir)))
        // Make the HTTP client available to our handlers.
        .with_state(client);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
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
                let body: Value = res.json().await.unwrap_or_else(|_| json!({"error": "Failed to parse LLM response"}));
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
