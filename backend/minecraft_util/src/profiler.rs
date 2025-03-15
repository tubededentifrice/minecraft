use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// A simple profiler for measuring performance metrics
#[derive(Clone)]
pub struct Profiler {
    measurements: Arc<Mutex<HashMap<String, Vec<Duration>>>>,
}

impl Profiler {
    /// Creates a new profiler
    pub fn new() -> Self {
        Self {
            measurements: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Creates a new profiling session with the given name
    pub fn measure<'a>(&'a self, name: &'a str) -> ProfilingSession<'a> {
        ProfilingSession {
            profiler: self,
            name,
            start: Instant::now(),
        }
    }
    
    /// Records a measurement with the given name and duration
    fn record(&self, name: &str, duration: Duration) {
        let mut measurements = self.measurements.lock().unwrap();
        measurements.entry(name.to_string()).or_default().push(duration);
    }
    
    /// Returns a summary of all measurements
    pub fn summary(&self) -> HashMap<String, ProfilerMetrics> {
        let measurements = self.measurements.lock().unwrap();
        let mut summary = HashMap::new();
        
        for (name, durations) in measurements.iter() {
            if durations.is_empty() {
                continue;
            }
            
            let min = durations.iter().min().cloned().unwrap_or_default();
            let max = durations.iter().max().cloned().unwrap_or_default();
            let total: Duration = durations.iter().sum();
            let avg = total / durations.len() as u32;
            let count = durations.len();
            
            summary.insert(name.clone(), ProfilerMetrics { min, max, avg, total, count });
        }
        
        summary
    }
    
    /// Clears all measurements
    pub fn clear(&self) {
        let mut measurements = self.measurements.lock().unwrap();
        measurements.clear();
    }
    
    /// Returns the summary as a formatted string
    pub fn summary_string(&self) -> String {
        let summary = self.summary();
        let mut result = String::new();
        
        result.push_str("Performance Metrics:\n");
        result.push_str("====================\n");
        
        for (name, metrics) in summary.iter() {
            result.push_str(&format!(
                "{}: avg={:.2}ms, min={:.2}ms, max={:.2}ms, total={:.2}ms, count={}\n",
                name,
                metrics.avg.as_secs_f64() * 1000.0,
                metrics.min.as_secs_f64() * 1000.0,
                metrics.max.as_secs_f64() * 1000.0,
                metrics.total.as_secs_f64() * 1000.0,
                metrics.count
            ));
        }
        
        result
    }
}

impl Default for Profiler {
    fn default() -> Self {
        Self::new()
    }
}

/// A session for measuring a specific operation
pub struct ProfilingSession<'a> {
    profiler: &'a Profiler,
    name: &'a str,
    start: Instant,
}

impl<'a> Drop for ProfilingSession<'a> {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        self.profiler.record(self.name, duration);
    }
}

/// Metrics for a specific measurement
#[derive(Debug, Clone)]
pub struct ProfilerMetrics {
    /// The minimum duration
    pub min: Duration,
    /// The maximum duration
    pub max: Duration,
    /// The average duration
    pub avg: Duration,
    /// The total duration
    pub total: Duration,
    /// The number of measurements
    pub count: usize,
} 