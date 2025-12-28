//! Data feed module for loading and streaming OHLCV data
//! 
//! Supports loading from:
//! - Parquet files
//! - CSV files
//! - In-memory data

use crate::events::{Bar, EventId, MarketDataEvent};
use chrono::{DateTime, NaiveDateTime, Utc};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataFeedError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("No data available for symbol: {0}")]
    NoData(String),
    
    #[error("Parquet error: {0}")]
    Parquet(String),
}

/// Data feed that streams OHLCV bars
pub struct DataFeed {
    /// Loaded data by symbol
    data: HashMap<String, Vec<Bar>>,
    
    /// Current index for each symbol
    indices: HashMap<String, usize>,
    
    /// Event ID counter
    event_id: EventId,
    
    /// Whether to align timestamps across symbols
    align_timestamps: bool,
}

impl DataFeed {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
            indices: HashMap::new(),
            event_id: 0,
            align_timestamps: true,
        }
    }

    /// Load data from a Parquet file
    pub fn load_parquet(&mut self, path: &str, symbol: &str) -> Result<(), DataFeedError> {
        // For now, we'll implement a simple Parquet reader
        // In production, use arrow-rs Parquet reader
        let file = File::open(path)?;
        
        // Placeholder: In a real implementation, use parquet crate
        // For now, fall back to CSV-like parsing
        log::warn!("Parquet loading not fully implemented, using CSV fallback");
        
        // Try loading as CSV
        self.load_csv(path, symbol)
    }

    /// Load data from a CSV file
    /// Expected format: timestamp,open,high,low,close,volume
    pub fn load_csv(&mut self, path: &str, symbol: &str) -> Result<(), DataFeedError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        
        let mut bars = Vec::new();
        let mut lines = reader.lines();
        
        // Skip header if present
        if let Some(Ok(first_line)) = lines.next() {
            if !first_line.starts_with(|c: char| c.is_ascii_digit()) {
                // This is a header line, skip it
            } else {
                // First line is data, parse it
                if let Some(bar) = self.parse_csv_line(&first_line)? {
                    bars.push(bar);
                }
            }
        }
        
        for line in lines {
            let line = line?;
            if let Some(bar) = self.parse_csv_line(&line)? {
                bars.push(bar);
            }
        }
        
        // Sort by timestamp
        bars.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        
        self.data.insert(symbol.to_string(), bars);
        self.indices.insert(symbol.to_string(), 0);
        
        Ok(())
    }

    fn parse_csv_line(&self, line: &str) -> Result<Option<Bar>, DataFeedError> {
        let parts: Vec<&str> = line.split(',').collect();
        
        if parts.len() < 6 {
            return Ok(None);
        }
        
        let timestamp = self.parse_timestamp(parts[0])?;
        let open = parts[1].trim().parse::<f64>()
            .map_err(|e| DataFeedError::Parse(format!("Invalid open: {}", e)))?;
        let high = parts[2].trim().parse::<f64>()
            .map_err(|e| DataFeedError::Parse(format!("Invalid high: {}", e)))?;
        let low = parts[3].trim().parse::<f64>()
            .map_err(|e| DataFeedError::Parse(format!("Invalid low: {}", e)))?;
        let close = parts[4].trim().parse::<f64>()
            .map_err(|e| DataFeedError::Parse(format!("Invalid close: {}", e)))?;
        let volume = parts[5].trim().parse::<f64>()
            .map_err(|e| DataFeedError::Parse(format!("Invalid volume: {}", e)))?;
        
        Ok(Some(Bar::new(timestamp, open, high, low, close, volume)))
    }

    fn parse_timestamp(&self, s: &str) -> Result<DateTime<Utc>, DataFeedError> {
        let s = s.trim();
        
        // Try parsing as Unix timestamp (milliseconds)
        if let Ok(ts) = s.parse::<i64>() {
            let secs = if ts > 10_000_000_000 { ts / 1000 } else { ts };
            return DateTime::from_timestamp(secs, 0)
                .ok_or_else(|| DataFeedError::Parse("Invalid timestamp".to_string()));
        }
        
        // Try parsing as ISO 8601
        if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
            return Ok(dt.with_timezone(&Utc));
        }
        
        // Try parsing as "YYYY-MM-DD HH:MM:SS"
        if let Ok(dt) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
            return Ok(dt.and_utc());
        }
        
        // Try parsing as "YYYY-MM-DD"
        if let Ok(dt) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", s), "%Y-%m-%d %H:%M:%S") {
            return Ok(dt.and_utc());
        }
        
        Err(DataFeedError::Parse(format!("Cannot parse timestamp: {}", s)))
    }

    /// Load data from in-memory bars
    pub fn load_bars(&mut self, symbol: &str, bars: Vec<Bar>) {
        let mut sorted_bars = bars;
        sorted_bars.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        
        self.data.insert(symbol.to_string(), sorted_bars);
        self.indices.insert(symbol.to_string(), 0);
    }

    /// Get the next bar for a symbol
    pub fn next_bar(&mut self, symbol: &str) -> Option<MarketDataEvent> {
        let bars = self.data.get(symbol)?;
        let index = self.indices.get_mut(symbol)?;
        
        if *index >= bars.len() {
            return None;
        }
        
        let bar = bars[*index].clone();
        *index += 1;
        self.event_id += 1;
        
        Some(MarketDataEvent {
            id: self.event_id,
            symbol: symbol.to_string(),
            bar,
        })
    }

    /// Get all bars aligned by timestamp across all symbols
    pub fn get_aligned_bars(&mut self) -> Vec<MarketDataEvent> {
        let mut events = Vec::new();
        
        // Get all timestamps
        let mut all_timestamps: Vec<DateTime<Utc>> = Vec::new();
        for bars in self.data.values() {
            for bar in bars {
                if !all_timestamps.contains(&bar.timestamp) {
                    all_timestamps.push(bar.timestamp);
                }
            }
        }
        all_timestamps.sort();
        
        // For each timestamp, emit bars for all symbols that have data
        for ts in all_timestamps {
            for (symbol, bars) in &self.data {
                if let Some(bar) = bars.iter().find(|b| b.timestamp == ts) {
                    self.event_id += 1;
                    events.push(MarketDataEvent {
                        id: self.event_id,
                        symbol: symbol.clone(),
                        bar: bar.clone(),
                    });
                }
            }
        }
        
        events
    }

    /// Reset all indices to start
    pub fn reset(&mut self) {
        for index in self.indices.values_mut() {
            *index = 0;
        }
        self.event_id = 0;
    }

    /// Get total number of bars for a symbol
    pub fn len(&self, symbol: &str) -> usize {
        self.data.get(symbol).map(|b| b.len()).unwrap_or(0)
    }

    /// Check if data feed is empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Get all available symbols
    pub fn symbols(&self) -> Vec<String> {
        self.data.keys().cloned().collect()
    }

    /// Get bar at specific index
    pub fn get_bar(&self, symbol: &str, index: usize) -> Option<&Bar> {
        self.data.get(symbol)?.get(index)
    }

    /// Get the current progress as a percentage
    pub fn progress(&self) -> f64 {
        if self.data.is_empty() {
            return 100.0;
        }
        
        let total: usize = self.data.values().map(|b| b.len()).sum();
        let current: usize = self.indices.values().sum();
        
        if total == 0 {
            100.0
        } else {
            (current as f64 / total as f64) * 100.0
        }
    }
}

impl Default for DataFeed {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_bars() {
        let mut feed = DataFeed::new();
        let bars = vec![
            Bar::new(Utc::now(), 100.0, 105.0, 95.0, 102.0, 1000.0),
            Bar::new(Utc::now(), 102.0, 108.0, 100.0, 106.0, 1200.0),
        ];
        
        feed.load_bars("BTC/USD", bars);
        
        assert_eq!(feed.len("BTC/USD"), 2);
        assert!(!feed.is_empty());
    }

    #[test]
    fn test_next_bar() {
        let mut feed = DataFeed::new();
        let now = Utc::now();
        let bars = vec![
            Bar::new(now, 100.0, 105.0, 95.0, 102.0, 1000.0),
        ];
        
        feed.load_bars("BTC/USD", bars);
        
        let event = feed.next_bar("BTC/USD");
        assert!(event.is_some());
        
        let event = feed.next_bar("BTC/USD");
        assert!(event.is_none());
    }
}

