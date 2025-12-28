//! Benchmarks for the backtest engine

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use backtest_engine::{
    config::BacktestConfig,
    engine::BacktestEngine,
    events::Bar,
    datafeed::DataFeed,
};
use chrono::{Duration, Utc};

fn generate_test_bars(n: usize) -> Vec<Bar> {
    let start = Utc::now();
    (0..n)
        .map(|i| {
            let timestamp = start + Duration::hours(i as i64);
            let base = 50000.0 + (i as f64 * 10.0).sin() * 1000.0;
            Bar::new(
                timestamp,
                base,
                base + 100.0,
                base - 100.0,
                base + 50.0,
                10000.0,
            )
        })
        .collect()
}

fn benchmark_data_loading(c: &mut Criterion) {
    let bars = generate_test_bars(10000);
    
    c.bench_function("load 10k bars", |b| {
        b.iter(|| {
            let mut feed = DataFeed::new();
            feed.load_bars("BTC/USD", black_box(bars.clone()));
        })
    });
}

fn benchmark_engine_run(c: &mut Criterion) {
    let config = BacktestConfig::default();
    let mut engine = BacktestEngine::new(config);
    
    let bars = generate_test_bars(1000);
    let mut feed = DataFeed::new();
    feed.load_bars("BTC/USD", bars);
    
    // Generate alternating signals
    let signals: Vec<(String, i32)> = (0..1000)
        .map(|i| {
            let signal = if i % 10 < 5 { 1 } else { -1 };
            (format!("2024-01-{:02}T00:00:00Z", (i % 28) + 1), signal)
        })
        .collect();
    
    c.bench_function("run 1k bars", |b| {
        b.iter(|| {
            engine.reset();
            let _ = engine.run(black_box(signals.clone()));
        })
    });
}

criterion_group!(benches, benchmark_data_loading, benchmark_engine_run);
criterion_main!(benches);

