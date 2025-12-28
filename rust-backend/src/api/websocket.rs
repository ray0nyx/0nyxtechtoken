use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
    routing::get,
    Router,
};
use futures::StreamExt;

use crate::AppState;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/ws/trading", get(websocket_handler))
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(_state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket))
}

async fn handle_socket(mut socket: WebSocket) {
    // Send welcome message
    if socket
        .send(Message::Text(
            serde_json::json!({
                "type": "connected",
                "status": "ok"
            })
            .to_string(),
        ))
        .await
        .is_err()
    {
        return;
    }

    // Handle incoming messages
    while let Some(msg) = socket.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Echo back for now
                let _ = socket
                    .send(Message::Text(format!("Echo: {}", text)))
                    .await;
            }
            Ok(Message::Close(_)) => {
                break;
            }
            _ => {}
        }
    }
}
