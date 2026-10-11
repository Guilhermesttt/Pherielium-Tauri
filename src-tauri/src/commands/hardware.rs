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
    /// "usb" | "bluetooth" | "unknown". No HID o ID do relatório já diz qual é
    /// (DualSense 0x01/0x31, DS4 0x01/0x11); no XInput, `BatteryType::WIRED`.
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

/// ID do relatório HID → transporte. É a identificação mais confiável que
/// existe aqui: o controle usa relatórios diferentes em USB e Bluetooth.
/// `is_dualsense` separa as duas famílias porque o ID Bluetooth difere
/// (DualSense 0x31, DualShock 4 0x11).
pub fn hid_report_to_link(report_id: u8, is_dualsense: bool) -> &'static str {
    match (report_id, is_dualsense) {
        (0x01, _) => "usb",
        (0x31, true) => "bluetooth",
        (0x11, false) => "bluetooth",
        _ => "unknown",
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

/// Maior valor do nibble de bateria do DualShock 4 sem cabo.
const DS4_BATTERY_MAX_WIRELESS: i32 = 8;
/// Idem com o cabo ligado (onde 11 = carga completa).
const DS4_BATTERY_MAX_USB: i32 = 11;

/// Byte de status do DualShock 4: bit 4 = cabo ligado; nibble baixo = nível.
///
/// A escala depende do cabo: 0..=8 na bateria e 0..=11 com cabo. O percentual é
/// `nibble * 100 / máximo`. Antes o código usava `nibble * 10 + 5` (a fórmula do
/// DualSense, cuja escala é 0..=10): nibble 4 virava 45 % em vez de 50 %, e a
/// bateria cheia (nibble 8) parava em 85 %, sem nunca chegar a 100 %.
pub fn ds4_status_to_battery(status: u8) -> (i32, bool) {
    let data = (status & 0x0F) as i32;
    if status & 0x10 != 0 {
        if data >= DS4_BATTERY_MAX_USB {
            (100, false)
        } else {
            ((data * 100 / DS4_BATTERY_MAX_USB).min(100), true)
        }
    } else {
        ((data * 100 / DS4_BATTERY_MAX_WIRELESS).min(100), false)
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
            // BatteryType::WIRED (1) é a única informação de transporte que o
            // XInput dá; sem fio ele não distingue dongle de Bluetooth.
            connection_type: if wired { "usb" } else { "unknown" }.to_string(),
            // O slot entra no nome: com dois controles ligados dá para ver qual
            // está sendo reportado em vez de um "Controle Xbox" genérico.
            device_name: Some(format!("Controle Xbox {}", user + 1)),
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
            // Tabela (relatório → parser, conexão). O ID do relatório é a própria
            // identificação do transporte; antes ele era lido e descartado.
            let parsed = if is_ds {
                match (buf[0], n) {
                    (0x01, n) if n >= 54 => Some((dualsense_status_to_battery(buf[53]), hid_report_to_link(0x01, true))),
                    (0x31, n) if n >= 55 => Some((dualsense_status_to_battery(buf[54]), hid_report_to_link(0x31, true))),
                    _ => None,
                }
            } else {
                match (buf[0], n) {
                    (0x01, n) if n >= 32 => Some((ds4_status_to_battery(buf[30]), hid_report_to_link(0x01, false))),
                    (0x11, n) if n >= 34 => Some((ds4_status_to_battery(buf[32]), hid_report_to_link(0x11, false))),
                    _ => None,
                }
            };
            if let Some(((level, charging), link)) = parsed {
                return Some(ControllerBattery {
                    battery_level: Some(level),
                    is_charging: charging,
                    connection_type: link.to_string(),
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

    /// DIAGNÓSTICO NO HARDWARE: lista os dispositivos Sony que o hidapi enxerga,
    /// mostra os primeiros bytes de cada relatório recebido e o que o leitor de
    /// bateria devolve. Serve para descobrir por que a bateria não bate.
    ///
    /// `cargo test --lib battery_on_this_machine -- --ignored --nocapture`
    #[test]
    #[ignore = "depende de um controle conectado a esta máquina"]
    #[cfg(target_os = "windows")]
    fn battery_on_this_machine() {
        let api = hidapi::HidApi::new().expect("hidapi");
        println!("--- dispositivos HID da Sony ---");
        let mut any = false;
        for info in api.device_list() {
            if info.vendor_id() != SONY_VID {
                continue;
            }
            any = true;
            println!(
                "pid={:04x} usage_page={:#06x} usage={:#06x} iface={} path={:?}",
                info.product_id(),
                info.usage_page(),
                info.usage(),
                info.interface_number(),
                info.path()
            );
            if let Ok(device) = info.open_device(&api) {
                let mut buf = [0u8; 128];
                for i in 0..4 {
                    match device.read_timeout(&mut buf, 150) {
                        Ok(0) => println!("   leitura {i}: timeout (0 bytes)"),
                        Ok(n) => println!(
                            "   leitura {i}: {n} bytes, report_id={:#04x}, primeiros={:02x?} | status_bat[usb=30,bt=32]={:#04x}/{:#04x}",
                            buf[0],
                            &buf[..n.min(12)],
                            buf[30],
                            buf[32]
                        ),
                        Err(e) => println!("   leitura {i}: erro {e}"),
                    }
                }
            } else {
                println!("   (não foi possível abrir este dispositivo)");
            }
        }
        if !any {
            println!("(nenhum dispositivo Sony visto pelo hidapi)");
        }
        println!("--- leitor atual ---");
        let result = read_battery_blocking();
        println!("{result:#?}");
    }

    #[test]
    fn hid_report_id_identifies_the_link() {
        assert_eq!(hid_report_to_link(0x01, true), "usb");
        assert_eq!(hid_report_to_link(0x01, false), "usb");
        assert_eq!(hid_report_to_link(0x31, true), "bluetooth");
        assert_eq!(hid_report_to_link(0x11, false), "bluetooth");
        // ID de Bluetooth da outra família não vale: evita rotular errado
        assert_eq!(hid_report_to_link(0x11, true), "unknown");
        assert_eq!(hid_report_to_link(0x31, false), "unknown");
        assert_eq!(hid_report_to_link(0x99, true), "unknown");
    }

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
        // Valor medido no hardware (DualShock 4 por Bluetooth, status cru 0x04).
        assert_eq!(ds4_status_to_battery(0x04), (50, false));
        assert_eq!(ds4_status_to_battery(0x15), (45, true)); // cabo carregando (5/11)
        assert_eq!(ds4_status_to_battery(0x1B), (100, false)); // cabo, cheio
    }

    #[test]
    fn ds4_wireless_scale_reaches_both_ends() {
        // A escala sem fio é 0..=8: o nibble 8 TEM de dar 100 % (antes parava em 85 %).
        assert_eq!(ds4_status_to_battery(0x00), (0, false));
        assert_eq!(ds4_status_to_battery(0x08), (100, false));
        let steps: Vec<i32> = (0..=8u8).map(|n| ds4_status_to_battery(n).0).collect();
        assert_eq!(steps, vec![0, 12, 25, 37, 50, 62, 75, 87, 100]);
        assert!(steps.windows(2).all(|w| w[0] < w[1]), "tem de crescer sempre");
    }

    #[test]
    fn ds4_usb_scale_is_zero_to_eleven() {
        assert_eq!(ds4_status_to_battery(0x10).0, 0);
        // Com cabo, o degrau 10 é 90 %, não 100 % (a escala vai até 11).
        assert_eq!(ds4_status_to_battery(0x1A), (90, true));
        assert_eq!(ds4_status_to_battery(0x1B), (100, false));
        // valor acima do máximo não passa de 100
        assert_eq!(ds4_status_to_battery(0x1F), (100, false));
    }

    #[test]
    fn dualsense_keeps_its_own_scale() {
        // Escala do DualSense é 0..=10 com `nibble * 10 + 5`; não pode herdar a do DS4.
        assert_eq!(dualsense_status_to_battery(0x04), (45, false));
        assert_eq!(dualsense_status_to_battery(0x0A), (100, false));
        assert_eq!(dualsense_status_to_battery(0x14), (45, true));
        assert_eq!(dualsense_status_to_battery(0x20), (100, false));
    }
}
