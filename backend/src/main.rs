use axum::{routing::get_service, Router};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    // Serve frontend files from the parent directory (the project root)
    let assets_dir = std::path::PathBuf::from("..");
    let app = Router::new().nest_service("/", get_service(ServeDir::new(assets_dir)));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}