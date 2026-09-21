//! Tauri commands: hardware detection (controller battery)
//! Substitui electron/hardware/controller-battery.cjs (~9 KB)

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerBattery {
    pub battery_level: Option<i32>,
    pub is_charging: bool,
    pub connection_type: String,
    pub device_name: Option<String>,
}

#[command]
pub async fn controller_get_battery() -> Result<ControllerBattery, String> {
    Ok(ControllerBattery {
        battery_level: None,
        is_charging: false,
        connection_type: "unknown".to_string(),
        device_name: None,
    })
}
