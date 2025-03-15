pub mod logger;
pub mod config;
pub mod profiler;

/// Re-export common utils
pub use anyhow;
pub use log;
pub use serde;
pub use thiserror;

/// The version of the Minecraft clone
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub use logger::*;
pub use config::*;
pub use profiler::*;

/// Initialize the utility components
pub fn init() {
    // Initialize components as needed
    logger::init();
}

/// Module for logging functionality
pub mod logger {
    use log::{info, warn, error, debug, trace};
    
    /// Initialize the logger
    pub fn init() {
        // Configure from environment
        let level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
        std::env::set_var("RUST_LOG", level);
        
        // Initialize the logger
        env_logger::init();
    }
}

/// Module for configuration management
pub mod config {
    use serde::{Serialize, Deserialize};
    use std::path::Path;
    use std::fs;
    use anyhow::Result;
    
    /// Load configuration from a JSON file
    pub fn load_config<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
        let content = fs::read_to_string(path)?;
        let config = serde_json::from_str(&content)?;
        Ok(config)
    }
    
    /// Save configuration to a JSON file
    pub fn save_config<T: Serialize>(config: &T, path: &Path) -> Result<()> {
        let content = serde_json::to_string_pretty(config)?;
        fs::write(path, content)?;
        Ok(())
    }
}

/// Module for performance profiling
pub mod profiler {
    use std::time::{Instant, Duration};
    use std::collections::HashMap;
    use std::sync::Mutex;
    use log::info;
    
    lazy_static::lazy_static! {
        static ref PROFILER: Mutex<Profiler> = Mutex::new(Profiler::new());
    }
    
    /// Get the global profiler instance
    pub fn get() -> &'static Mutex<Profiler> {
        &PROFILER
    }
    
    /// A simple performance profiler
    pub struct Profiler {
        timers: HashMap<String, Instant>,
        measurements: HashMap<String, Vec<Duration>>,
    }
    
    impl Profiler {
        /// Create a new profiler
        pub fn new() -> Self {
            Self {
                timers: HashMap::new(),
                measurements: HashMap::new(),
            }
        }
        
        /// Start timing a section
        pub fn start(&mut self, name: &str) {
            self.timers.insert(name.to_string(), Instant::now());
        }
        
        /// Stop timing a section and record the duration
        pub fn stop(&mut self, name: &str) {
            if let Some(start) = self.timers.remove(name) {
                let duration = start.elapsed();
                self.measurements
                    .entry(name.to_string())
                    .or_insert_with(Vec::new)
                    .push(duration);
            }
        }
        
        /// Print profiling results
        pub fn report(&self) {
            info!("Performance Report:");
            for (name, durations) in &self.measurements {
                if durations.is_empty() {
                    continue;
                }
                
                let total: Duration = durations.iter().sum();
                let avg = total / durations.len() as u32;
                let max = durations.iter().max().unwrap();
                let min = durations.iter().min().unwrap();
                
                info!(
                    "{}: avg={:?}, min={:?}, max={:?}, count={}",
                    name, avg, min, max, durations.len()
                );
            }
        }
        
        /// Clear all measurements
        pub fn reset(&mut self) {
            self.measurements.clear();
        }
    }
} 