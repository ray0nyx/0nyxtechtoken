pub struct PrecisionTimer;

impl PrecisionTimer {
    #[inline(always)]
    pub fn now() -> u64 {
        #[cfg(target_arch = "x86_64")]
        {
            unsafe { std::arch::x86_64::_rdtsc() }
        }
        #[cfg(not(target_arch = "x86_64"))]
        {
            // Fallback to std::time for non-x86_64 architectures
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos() as u64
        }
    }

    /// Convert rdtsc cycles to nanoseconds
    /// Note: This requires calibration which is usually done at startup
    pub fn cycles_to_ns(cycles: u64, frequency_ghz: f64) -> u64 {
        (cycles as f64 / frequency_ghz) as u64
    }
}

pub fn get_cpu_frequency() -> f64 {
    // In a real system, we would calibrate this at startup
    // For now, returning a common value like 3.5 GHz
    3.5
}

