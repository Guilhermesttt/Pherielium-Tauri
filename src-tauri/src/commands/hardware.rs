//! Tauri commands: hardware detection (controller battery).
//!
//! O Web Gamepad API não expõe bateria, então ela é lida aqui:
//! - Xbox/XInput: `XInputGetBatteryInformation` (o Windows só informa 4 níveis).
//! - DualSense / DualShock 4: relatório HID de entrada (percentual real).
//!
//! As funções `*_from_*` são puras e testadas; o acesso ao hardware fica nas
//! funções `read_*`, que devolvem `None` quando não há dado (a UI então mostra só
//! "Conectado").

use serde::Serialize;
use tauri::command;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerBattery {
    /// 0..=100, `None` quando o controle não informa (ex.: XInput com fio).
    pub battery_level: Option<i32>,
    pub is_charging: bool,
    /// O Windows não diz se é USB ou Bluetooth de forma confiável: sempre "unknown".
    pub connection_type: String,
    pub device_name: Option<String>,
    /// `true` quando o nível é uma estimativa (XInput só tem 4 degraus).
    pub approximate: bool,
    /// "xinput" | "hid" | "none"
    pub source: String,
}

impl ControllerBattery {
    fn none() -> Self {
        Self {
            battery_level: None,
            is_charging: false,
            connection_type: "unknown".to_string(),
            device_name: None,
            approximate: false,
            source: "none".to_string(),
        }
    }
}

// ── Parsers puros ───────────────────────────────────────────────────────────

/// `BatteryLevel` do XInput (0 vazio, 1 baixo, 2 médio, 3 cheio) → percentual aproximado.
pub fn xinput_level_to_percent(level: u8) -> Option<i32> {
    match level {
        0 => Some(5),
        1 => Some(25),
        2 => Some(60),
        3 => Some(100),
        _ => None,
    }
}

/// Byte de status da bateria do DualSense: nibble baixo = nível (0..=10),
/// nibble alto = 0 descarregando, 1 carregando, 2 cheia. Retorna (percentual, carregando).
pub fn dualsense_status_to_battery(status: u8) -> (i32, bool) {
    let data = (status & 0x0F) as i32;
    match status >> 4 {
        2 => (100, false),
        1 => ((data * 10 + 5).min(100), true),
        _ => ((data * 10 + 5).min(100), false),
    }
}

/// Byte de status do DualShock 4: bit 4 = cabo ligado; nibble baixo = nível
/// (0..=8 na bateria, 0..=11 com cabo, onde 11 = carga completa).
pub fn ds4_status_to_battery(status: u8) -> (i32, bool) {
    let data = (status & 0x0F) as i32;
    if status & 0x10 != 0 {
        if data >= 11 {
            (100, false)
        } else {
            ((data * 10 + 5).min(100), true)
        }
    } else {
        ((data * 10 + 5).min(100), false)
    }
}

// ── XInput (Xbox) ───────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn read_xinput() -> Option<ControllerBattery> {
    use windows::Win32::UI::Input::XboxController::{
        XInputGetBatteryInformation, BATTERY_DEVTYPE_GAMEPAD, XINPUT_BATTERY_INFORMATION,
    };

    for user in 0..4u32 {
        let mut info = XINPUT_BATTERY_INFORMATION::default();
        // SAFETY: `info` é uma struct local válida para escrita.
        let status = unsafe { XInputGetBatteryInformation(user, BATTERY_DEVTYPE_GAMEPAD, &mut info) };
        if status != 0 {
            continue; // slot sem controle
        }
        // 0 = desconectado, 1 = com fio (sem nível útil), 0xFF = desconhecido
        let battery_type = info.BatteryType.0;
        if battery_type == 0 {
            continue;
        }
        let wired = battery_type == 1;
        let level = if wired || battery_type == 0xFF {
            None
        } else {
            xinput_level_to_percent(info.BatteryLevel.0)
        };
        return Some(ControllerBattery {
            battery_level: level,
            // Com fio o controle está recebendo energia; sem nível não dá para saber se "carrega".
            is_charging: wired,
            connection_type: "unknown".to_string(),
            device_name: Some("Controle Xbox".to_string()),
            approximate: level.is_some(),
            source: "xinput".to_string(),
        });
    }
    None
}

// ── HID (PlayStation) ───────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
const SONY_VID: u16 = 0x054C;
#[cfg(target_os = "windows")]
const DUALSENSE_PIDS: [u16; 2] = [0x0CE6, 0x0DF2];
#[cfg(target_os = "windows")]
const DS4_PIDS: [u16; 2] = [0x05C4, 0x09CC];

#[cfg(target_os = "windows")]
fn read_hid() -> Option<ControllerBattery> {
    let api = hidapi::HidApi::new().ok()?;
    for info in api.device_list() {
        if info.vendor_id() != SONY_VID {
            continue;
        }
        let pid = info.product_id();
        let is_ds = DUALSENSE_PIDS.contains(&pid);
        let is_ds4 = DS4_PIDS.contains(&pid);
        if !is_ds && !is_ds4 {
            continue;
        }
        let Ok(device) = info.open_device(&api) else { continue };

        let mut buf = [0u8; 128];
        // Alguns relatórios Bluetooth só trazem a bateria no modo estendido: pedir o
        // relatório de calibração (0x05 / 0x02) faz o controle trocá-lo.
        if is_ds {
            let mut feature = [0u8; 41];
            feature[0] = 0x05;
            let _ = device.get_feature_report(&mut feature);
        } else {
            let mut feature = [0u8; 37];
            feature[0] = 0x02;
            let _ = device.get_feature_report(&mut feature);
        }

        for _ in 0..6 {
            let Ok(n) = device.read_timeout(&mut buf, 120) else { break };
            if n == 0 {
                continue;
            }
            let parsed = if is_ds {
                match (buf[0], n) {
                    (0x01, n) if n >= 54 => Some(dualsense_status_to_battery(buf[53])), // USB
                    (0x31, n) if n >= 55 => Some(dualsense_status_to_battery(buf[54])), // Bluetooth
                    _ => None,
                }
            } else {
                match (buf[0], n) {
                    (0x01, n) if n >= 32 => Some(ds4_status_to_battery(buf[30])), // USB
                    (0x11, n) if n >= 34 => Some(ds4_status_to_battery(buf[32])), // Bluetooth
                    _ => None,
                }
            };
            if let Some((level, charging)) = parsed {
                return Some(ControllerBattery {
                    battery_level: Some(level),
                    is_charging: charging,
                    connection_type: "unknown".to_string(),
                    device_name: Some(if is_ds { "DualSense" } else { "DualShock 4" }.to_string()),
                    approximate: false,
                    source: "hid".to_string(),
                });
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn read_battery_blocking() -> ControllerBattery {
    // PlayStation primeiro (dá percentual real); depois Xbox.
    read_hid().or_else(read_xinput).unwrap_or_else(ControllerBattery::none)
}

#[cfg(not(target_os = "windows"))]
fn read_battery_blocking() -> ControllerBattery {
    ControllerBattery::none()
}

#[command]
pub async fn controller_get_battery() -> Result<ControllerBattery, String> {
    // A leitura HID bloqueia por alguns ms: fora da thread async.
    tauri::async_runtime::spawn_blocking(read_battery_blocking)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xinput_levels_map_to_four_steps() {
        assert_eq!(xinput_level_to_percent(0), Some(5));
        assert_eq!(xinput_level_to_percent(1), Some(25));
        assert_eq!(xinput_level_to_percent(2), Some(60));
        assert_eq!(xinput_level_to_percent(3), Some(100));
        assert_eq!(xinput_level_to_percent(9), None);
    }

    #[test]
    fn dualsense_status_decodes_level_and_charging() {
        assert_eq!(dualsense_status_to_battery(0x08), (85, false)); // descarregando
        assert_eq!(dualsense_status_to_battery(0x15), (55, true)); // carregando
        assert_eq!(dualsense_status_to_battery(0x2A), (100, false)); // cheia
        assert_eq!(dualsense_status_to_battery(0x0F), (100, false)); // nunca passa de 100
    }

    #[test]
    fn ds4_status_decodes_cable_and_level() {
        assert_eq!(ds4_status_to_battery(0x04), (45, false)); // bateria
        assert_eq!(ds4_status_to_battery(0x15), (55, true)); // cabo carregando
        assert_eq!(ds4_status_to_battery(0x1B), (100, false)); // cabo, cheio
    }
}
