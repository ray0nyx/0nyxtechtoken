use axum::{
    extract::State,
    response::sse::{Event, Sse},
    routing::get,
    Router,
};
use futures::stream::{self, Stream};
use std::convert::Infallible;

use crate::AppState;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/sse/price/:token_address", get(stream_price_updates))
}

async fn stream_price_updates(
    State(_state): State<AppState>,
    axum::extract::Path(token_address): axum::extract::Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // In a real implementation, this would subscribe to Redis pub/sub
    // For now, return a placeholder stream
    let stream = stream::unfold(0, move |counter| async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        Some((
            Ok(Event::default().data(format!("price_update:{}", counter))),
            counter + 1,
        ))
    });

    Sse::new(stream)
}
