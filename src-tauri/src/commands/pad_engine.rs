//! Motor de emulação: lê o controle físico (XInput), aplica o perfil e alimenta o Xbox 360 virtual.
//!
//! Roda em Rust, e não no front, porque a Web Gamepad API só reporta com a janela do launcher em
//! foco — e a emulação precisa funcionar justamente com o JOGO em foco.
//!
//! Ordem de partida (importa): (1) fotografa os controles físicos, (2) esconde-os do jogo pelo
//! HidHide, (3) só então liga o pad virtual. Se o virtual entrasse antes, ele apareceria na lista
//! de controles de jogo e seria escondido junto.
//!
//! Limites conhecidos: só lê controles que falam XInput (Xbox e compatíveis); DualSense/DualShock
//! nativos ainda não. O botão Guide não existe na API pública do XInput. A vibração do jogo não é
//! repassada ao controle físico.

use serde::Serialize;

use super::virtual_pad::PadState;
use crate::store::controller_profiles::{apply_axis, apply_trigger, ControllerSettings};

/// Leitura crua de um controle XInput, antes do perfil.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RawPad {
    pub buttons: u16,
    pub left_trigger: u8,
    pub right_trigger: u8,
    pub left_x: i16,
    pub left_y: i16,
    pub right_x: i16,
    pub right_y: i16,
}

mod mask {
    pub const DPAD_UP: u16 = 0x0001;
    pub const DPAD_DOWN: u16 = 0x0002;
    pub const DPAD_LEFT: u16 = 0x0004;
    pub const DPAD_RIGHT: u16 = 0x0008;
    pub const START: u16 = 0x0010;
    pub const BACK: u16 = 0x0020;
    pub const LEFT_THUMB: u16 = 0x0040;
    pub const RIGHT_THUMB: u16 = 0x0080;
    pub const LEFT_SHOULDER: u16 = 0x0100;
    pub const RIGHT_SHOULDER: u16 = 0x0200;
    pub const A: u16 = 0x1000;
    pub const B: u16 = 0x2000;
    pub const X: u16 = 0x4000;
    pub const Y: u16 = 0x8000;
}

/// i16 do XInput para -1.0..=1.0 (o lado negativo tem um passo a mais, por isso o clamp).
fn axis_to_f32(v: i16) -> f32 {
    (v as f32 / i16::MAX as f32).clamp(-1.0, 1.0)
}

/// Aplica o perfil do jogo à leitura crua. Função pura: tudo que o motor decide está aqui.
///
/// "Inverter eixo Y" vale para o stick direito (o da câmera/mira), que é onde esse ajuste é usado.
pub fn map_to_pad(raw: &RawPad, settings: &ControllerSettings) -> PadState {
    let (lx, ly) = (axis_to_f32(raw.left_x), axis_to_f32(raw.left_y));
    let (rx, ry) = (axis_to_f32(raw.right_x), axis_to_f32(raw.right_y));
    let stick = |value: f32, other: f32, deadzone: f32| {
        apply_axis(value, other, deadzone, settings.curve, settings.sensitivity)
    };
    let right_y = stick(ry, rx, settings.deadzone_right);
    let held = |bit: u16| raw.buttons & bit != 0;
    let (a, b) = if settings.swap_ab {
        (held(mask::B), held(mask::A))
    } else {
        (held(mask::A), held(mask::B))
    };

    PadState {
        left_x: stick(lx, ly, settings.deadzone_left),
        left_y: stick(ly, lx, settings.deadzone_left),
        right_x: stick(rx, ry, settings.deadzone_right),
        right_y: if settings.invert_y { -right_y } else { right_y },
        left_trigger: apply_trigger(raw.left_trigger as f32 / 255.0, settings.trigger_threshold),
        right_trigger: apply_trigger(raw.right_trigger as f32 / 255.0, settings.trigger_threshold),
        a,
        b,
        x: held(mask::X),
        y: held(mask::Y),
        left_bumper: held(mask::LEFT_SHOULDER),
        right_bumper: held(mask::RIGHT_SHOULDER),
        back: held(mask::BACK),
        start: held(mask::START),
        left_thumb: held(mask::LEFT_THUMB),
        right_thumb: held(mask::RIGHT_THUMB),
        dpad_up: held(mask::DPAD_UP),
        dpad_down: held(mask::DPAD_DOWN),
        dpad_left: held(mask::DPAD_LEFT),
        dpad_right: held(mask::DPAD_RIGHT),
        guide: false,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PadEngineStatus {
    pub running: bool,
    /// Slot XInput do controle físico em uso.
    pub physical_slot: Option<u32>,
    /// O controle físico foi escondido do jogo (HidHide).
    pub physical_hidden: bool,
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{map_to_pad, PadEngineStatus, RawPad};
    use crate::commands::hidhide_cloak::{self, CloakRecord};
    use crate::commands::virtual_pad;
    use crate::store::controller_profiles::ControllerSettings;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex, OnceLock};
    use std::thread::JoinHandle;
    use std::time::Duration;
    use windows::Win32::Media::{timeBeginPeriod, timeEndPeriod};
    use windows::Win32::UI::Input::XboxController::{XInputGetState, XINPUT_STATE};

    /// ~250 Hz. Mais que isso só gasta CPU: o ViGEm não entrega mais rápido que o jogo lê.
    const POLL_INTERVAL: Duration = Duration::from_millis(4);

    struct Running {
        stop: Arc<AtomicBool>,
        worker: JoinHandle<()>,
        physical_slot: u32,
        cloak: Option<CloakRecord>,
    }

    fn engine() -> &'static Mutex<Option<Running>> {
        static ENGINE: OnceLock<Mutex<Option<Running>>> = OnceLock::new();
        ENGINE.get_or_init(|| Mutex::new(None))
    }

    fn read_slot(slot: u32) -> Option<RawPad> {
        let mut state = XINPUT_STATE::default();
        // SAFETY: `state` é uma struct local válida para escrita durante a chamada.
        let status = unsafe { XInputGetState(slot, &mut state) };
        if status != 0 {
            return None; // slot sem controle
        }
        let pad = state.Gamepad;
        Some(RawPad {
            buttons: pad.wButtons.0,
            left_trigger: pad.bLeftTrigger,
            right_trigger: pad.bRightTrigger,
            left_x: pad.sThumbLX,
            left_y: pad.sThumbLY,
            right_x: pad.sThumbRX,
            right_y: pad.sThumbRY,
        })
    }

    fn first_connected_slot() -> Option<u32> {
        (0..4u32).find(|slot| read_slot(*slot).is_some())
    }

    pub fn start(settings: ControllerSettings) -> Result<(), String> {
        let mut guard = engine().lock().map_err(|_| "estado do motor travado".to_string())?;
        if guard.is_some() {
            return Ok(()); // idempotente
        }

        // 1) Controle físico ANTES do virtual existir, senão o slot do virtual seria escolhido.
        let physical_slot = first_connected_slot().ok_or_else(|| {
            "Nenhum controle compatível com XInput foi encontrado (controles PlayStation nativos ainda não são suportados pela emulação)."
                .to_string()
        })?;

        // 2) Esconde o físico do jogo. Falha aqui aborta: sem isso a entrada duplicaria.
        let devices = hidhide_cloak::gaming_devices().map_err(|e| e.to_string())?;
        if devices.is_empty() {
            return Err("O HidHide não listou nenhum controle de jogo para esconder.".into());
        }
        let exe = std::env::current_exe().map_err(|e| format!("executável atual indisponível: {e}"))?;
        let cloak = hidhide_cloak::hide(&devices, &exe).map_err(|e| e.to_string())?;

        // 3) Liga o pad virtual; se falhar, devolve o físico antes de reportar.
        if let Err(e) = virtual_pad::attach_engine_pad() {
            let _ = hidhide_cloak::restore(&cloak);
            return Err(e);
        }

        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let worker = std::thread::Builder::new()
            .name("pad-engine".into())
            .spawn(move || run_loop(physical_slot, settings, worker_stop))
            .map_err(|e| {
                let _ = virtual_pad::detach_engine_pad();
                let _ = hidhide_cloak::restore(&cloak);
                format!("não foi possível iniciar o motor: {e}")
            })?;

        *guard = Some(Running { stop, worker, physical_slot, cloak: Some(cloak) });
        Ok(())
    }

    fn run_loop(slot: u32, settings: ControllerSettings, stop: Arc<AtomicBool>) {
        // SAFETY: par timeBeginPeriod/timeEndPeriod com o mesmo valor; sem timer fino o sleep de 4 ms
        // viraria ~15 ms no Windows e a entrada ficaria arrastada.
        unsafe { timeBeginPeriod(1) };
        let mut last = None;
        while !stop.load(Ordering::Relaxed) {
            // Controle desconectado: manda neutro uma vez e espera ele voltar.
            let next = read_slot(slot).map(|raw| map_to_pad(&raw, &settings)).unwrap_or_default();
            if last.as_ref() != Some(&next) {
                // Falha de envio não derruba o motor: o próximo quadro tenta de novo.
                let _ = virtual_pad::update_engine_pad(&next);
                last = Some(next);
            }
            std::thread::sleep(POLL_INTERVAL);
        }
        // Solta tudo para o jogo não ficar com botão "preso" ao encerrar.
        let _ = virtual_pad::update_engine_pad(&Default::default());
        // SAFETY: par do timeBeginPeriod acima.
        unsafe { timeEndPeriod(1) };
    }

    pub fn stop() -> Result<(), String> {
        let running = engine().lock().map_err(|_| "estado do motor travado".to_string())?.take();
        let Some(mut running) = running else { return Ok(()) };

        running.stop.store(true, Ordering::Relaxed);
        let _ = running.worker.join();

        let mut problems = Vec::new();
        if let Err(e) = virtual_pad::detach_engine_pad() {
            problems.push(e);
        }
        if let Some(cloak) = running.cloak.take() {
            if let Err(e) = hidhide_cloak::restore(&cloak) {
                problems.push(e.to_string());
            }
        }
        if problems.is_empty() {
            Ok(())
        } else {
            Err(problems.join("; "))
        }
    }

    pub fn status() -> PadEngineStatus {
        match engine().lock() {
            Ok(guard) => match guard.as_ref() {
                Some(r) => PadEngineStatus {
                    running: true,
                    physical_slot: Some(r.physical_slot),
                    physical_hidden: r.cloak.is_some(),
                },
                None => PadEngineStatus { running: false, physical_slot: None, physical_hidden: false },
            },
            Err(_) => PadEngineStatus { running: false, physical_slot: None, physical_hidden: false },
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use super::PadEngineStatus;
    use crate::store::controller_profiles::ControllerSettings;

    pub fn start(_settings: ControllerSettings) -> Result<(), String> {
        Err("A emulação de controle só existe no Windows.".into())
    }
    pub fn stop() -> Result<(), String> {
        Ok(())
    }
    pub fn status() -> PadEngineStatus {
        PadEngineStatus { running: false, physical_slot: None, physical_hidden: false }
    }
}

/// Para o motor e devolve o controle físico (chamado também ao fechar o app e quando o jogo termina).
pub fn shutdown() {
    if let Err(e) = imp::stop() {
        eprintln!("[pad-engine] ao encerrar: {e}");
    }
}

/// Liga a emulação para o jogo: usa o perfil já resolvido pelo front (jogo > global > fábrica).
///
/// Assíncrono + `spawn_blocking`: a partida chama o CLI do HidHide e espera o driver do pad
/// virtual, o que passa de 1 s na primeira vez.
#[tauri::command]
pub async fn pad_engine_start(settings: ControllerSettings) -> Result<(), String> {
    let settings = settings.sanitized();
    if !settings.emulate_xinput {
        return Ok(()); // perfil sem emulação: nada a fazer, não é erro
    }
    tauri::async_runtime::spawn_blocking(move || imp::start(settings))
        .await
        .map_err(|e| format!("motor de emulação interrompido: {e}"))?
}

#[tauri::command]
pub async fn pad_engine_stop() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(imp::stop)
        .await
        .map_err(|e| format!("motor de emulação interrompido: {e}"))?
}

#[tauri::command]
pub fn pad_engine_status() -> PadEngineStatus {
    imp::status()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::controller_profiles::ResponseCurve;

    fn flat() -> ControllerSettings {
        ControllerSettings {
            deadzone_left: 0.0,
            deadzone_right: 0.0,
            curve: ResponseCurve::Linear,
            sensitivity: 1.0,
            invert_y: false,
            trigger_threshold: 0.0,
            swap_ab: false,
            rumble: 1.0,
            emulate_xinput: true,
        }
    }

    #[test]
    fn buttons_pass_through_one_to_one() {
        let raw = RawPad { buttons: mask::A | mask::LEFT_SHOULDER | mask::DPAD_UP | mask::START, ..Default::default() };
        let pad = map_to_pad(&raw, &flat());
        assert!(pad.a && pad.left_bumper && pad.dpad_up && pad.start);
        assert!(!pad.b && !pad.x && !pad.y && !pad.right_bumper && !pad.dpad_down && !pad.back);
    }

    #[test]
    fn swap_ab_exchanges_only_those_two() {
        let mut settings = flat();
        settings.swap_ab = true;
        let pad = map_to_pad(&RawPad { buttons: mask::A | mask::X, ..Default::default() }, &settings);
        assert!(pad.b && !pad.a && pad.x);
    }

    #[test]
    fn deadzone_zeroes_small_stick_movement() {
        let mut settings = flat();
        settings.deadzone_left = 0.2;
        let small = RawPad { left_x: (i16::MAX as f32 * 0.1) as i16, ..Default::default() };
        let pad = map_to_pad(&small, &settings);
        assert_eq!((pad.left_x, pad.left_y), (0.0, 0.0));
        let big = RawPad { left_x: i16::MAX, ..Default::default() };
        assert!((map_to_pad(&big, &settings).left_x - 1.0).abs() < 1e-3);
    }

    #[test]
    fn invert_y_flips_only_the_right_stick() {
        let mut settings = flat();
        settings.invert_y = true;
        let raw = RawPad { left_y: i16::MAX, right_y: i16::MAX, ..Default::default() };
        let pad = map_to_pad(&raw, &settings);
        assert!(pad.left_y > 0.99);
        assert!(pad.right_y < -0.99);
    }

    #[test]
    fn minimum_axis_value_does_not_overflow() {
        // i16::MIN / i16::MAX passaria de -1.0 sem o clamp.
        let pad = map_to_pad(&RawPad { left_x: i16::MIN, ..Default::default() }, &flat());
        assert!(pad.left_x >= -1.0);
    }

    #[test]
    fn trigger_threshold_cuts_light_presses() {
        let mut settings = flat();
        settings.trigger_threshold = 0.5;
        let light = map_to_pad(&RawPad { right_trigger: 100, ..Default::default() }, &settings);
        assert_eq!(light.right_trigger, 0.0);
        let full = map_to_pad(&RawPad { right_trigger: 255, ..Default::default() }, &settings);
        assert!((full.right_trigger - 1.0).abs() < 1e-3);
    }

    /// Ponta a ponta do lado virtual, sem controle físico nem HidHide: liga o pad virtual, manda um
    /// estado e confere que o XInput do Windows o enxerga. Depende do ViGEmBus instalado.
    /// `cargo test --lib virtual_pad_is_seen_by_xinput -- --ignored --nocapture`
    #[test]
    #[ignore = "depende do ViGEmBus instalado nesta máquina"]
    #[cfg(target_os = "windows")]
    fn virtual_pad_is_seen_by_xinput() {
        use crate::commands::virtual_pad::{attach_engine_pad, detach_engine_pad, update_engine_pad};
        use windows::Win32::UI::Input::XboxController::{XInputGetState, XINPUT_STATE};

        attach_engine_pad().expect("ViGEmBus precisa estar instalado");
        let sent = PadState { a: true, right_trigger: 1.0, left_x: 1.0, ..Default::default() };
        let mut seen = None;
        for _ in 0..50 {
            update_engine_pad(&sent).expect("enviar estado");
            std::thread::sleep(std::time::Duration::from_millis(20));
            for slot in 0..4u32 {
                let mut state = XINPUT_STATE::default();
                // SAFETY: `state` é local e válido para escrita.
                if unsafe { XInputGetState(slot, &mut state) } == 0 && state.Gamepad.wButtons.0 & mask::A != 0 {
                    seen = Some(state.Gamepad);
                }
            }
            if seen.is_some() {
                break;
            }
        }
        detach_engine_pad().expect("remover pad virtual");
        let pad = seen.expect("o XInput não enxergou o botão A do pad virtual");
        assert_eq!(pad.bRightTrigger, 255);
        assert!(pad.sThumbLX > 32000);
    }

    #[test]
    fn untouched_controller_maps_to_neutral() {
        assert_eq!(map_to_pad(&RawPad::default(), &flat()), PadState::default());
    }
}
