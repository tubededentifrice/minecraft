use env_logger::Builder;
use log::LevelFilter;
use std::io::Write;

/// Initializes the global logger with the specified log level
pub fn init_logger(level: LevelFilter) {
    let mut builder = Builder::new();
    
    builder
        .filter(None, level)
        .format(|buf, record| {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            writeln!(
                buf,
                "[{} {} {}:{}] {}",
                timestamp,
                record.level(),
                record.file().unwrap_or("unknown"),
                record.line().unwrap_or(0),
                record.args()
            )
        })
        .init();
    
    log::info!("Logger initialized with level: {:?}", level);
}

/// Creates a scoped logger with a prefix for the current module or component
pub fn scoped_logger(scope: &str) -> ScopedLogger {
    ScopedLogger::new(scope)
}

/// A logger with a scope prefix to identify the source of log messages
pub struct ScopedLogger {
    scope: String,
}

impl ScopedLogger {
    /// Creates a new scoped logger with the given scope name
    pub fn new(scope: &str) -> Self {
        Self {
            scope: scope.to_string(),
        }
    }
    
    /// Logs a message at the trace level
    pub fn trace(&self, message: &str) {
        log::trace!("[{}] {}", self.scope, message);
    }
    
    /// Logs a message at the debug level
    pub fn debug(&self, message: &str) {
        log::debug!("[{}] {}", self.scope, message);
    }
    
    /// Logs a message at the info level
    pub fn info(&self, message: &str) {
        log::info!("[{}] {}", self.scope, message);
    }
    
    /// Logs a message at the warn level
    pub fn warn(&self, message: &str) {
        log::warn!("[{}] {}", self.scope, message);
    }
    
    /// Logs a message at the error level
    pub fn error(&self, message: &str) {
        log::error!("[{}] {}", self.scope, message);
    }
} 