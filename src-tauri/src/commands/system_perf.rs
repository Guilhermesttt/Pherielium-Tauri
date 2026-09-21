//! CPU / RAM snapshot for the in-game and hub performance HUD.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde_json::{json, Value};
use sysinfo::System;

static PERF_SYS: Lazy<Mutex<System>> = Lazy::new(|| {
    let mut sys = System::new();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    Mutex::new(sys)
});

#[tauri::command]
pub fn system_perf_snapshot() -> Result<Value, String> {
    let mut sys = PERF_SYS.lock();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let ram_used = sys.used_memory();
    let ram_total = sys.total_memory().max(1);
    Ok(json!({
        "cpu": sys.global_cpu_usage(),
        "ramUsed": ram_used,
        "ramTotal": ram_total,
        "ramPercent": (ram_used as f64 / ram_total as f64) * 100.0,
    }))
}
