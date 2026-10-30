//! Motor de emulação: lê o controle físico (XInput), aplica o perfil e alimenta o Xbox 360 virtual.
//!
//! Roda em Rust, e não no front, porque a Web Gamepad API só reporta com a janela do launcher em
//! foco — e a emulação precisa funcionar justamente com o JOGO em foco.
//!
//! Ordem de partida (importa): (1) fotografa os controles físicos, (2) esconde-os do jogo pelo
//! HidHide, (3) só então liga o pad virtual. Se o virtual entrasse antes, ele apareceria na lista
//! de controles de jogo e seria escondido junto.
//!
//! Controles lidos: XInput (Xbox e compatíveis) e, direto por HID, DualShock 4 e DualSense (`pad_hid`).
//! Limites conhecidos: o botão Guide só existe nos controles Sony (o XInput público não o expõe) e a
//! vibração do jogo não é repassada ao controle físico.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

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
    /// Botão Guide/PS. Só os controles lidos por HID informam.
    pub guide: bool,
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
        guide: raw.guide,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PadEngineStatus {
    pub running: bool,
    /// Slot XInput do controle físico em uso (ausente quando a leitura é por HID).
    pub physical_slot: Option<u32>,
    /// De onde vem a leitura: "xinput", "dualshock4" ou "dualsense".
    pub physical_source: Option<&'static str>,
    /// O controle físico foi escondido do jogo (HidHide).
    pub physical_hidden: bool,
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{map_to_pad, PadEngineStatus, RawPad};
    use crate::commands::hidhide_cloak::{self, CloakRecord};
    use crate::commands::pad_hid::SonyPad;
    use crate::commands::virtual_pad;
    use crate::store::controller_profiles::ControllerSettings;
    use std::ffi::CString;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex, OnceLock};
    use std::thread::JoinHandle;
    use std::time::Duration;
    use windows::Win32::Media::{timeBeginPeriod, timeEndPeriod};
    use windows::Win32::UI::Input::XboxController::{XInputGetState, XINPUT_STATE};

    /// ~250 Hz. Mais que isso só gasta CPU: o ViGEm não entrega mais rápido que o jogo lê.
    const POLL_INTERVAL: Duration = Duration::from_millis(4);
    const HID_READ_TIMEOUT_MS: i32 = 4;

    /// Qual controle físico alimenta o motor.
    enum Selected {
        XInput { slot: u32 },
        Sony { pad: SonyPad, path: CString, vendor: u16, product: u16 },
    }

    impl Selected {
        fn label(&self) -> &'static str {
            match self {
                Selected::XInput { .. } => "xinput",
                Selected::Sony { pad: SonyPad::DualShock4, .. } => "dualshock4",
                Selected::Sony { pad: SonyPad::DualSense, .. } => "dualsense",
            }
        }
    }

    /// O que o laço lê, já aberto.
    enum Source {
        XInput(u32),
        Hid { pad: SonyPad, device: hidapi::HidDevice, last: RawPad },
    }

    impl Source {
        /// Leitura atual; `None` = controle desconectado.
        fn read(&mut self) -> Option<RawPad> {
            match self {
                Source::XInput(slot) => {
                    let raw = read_slot(*slot);
                    std::thread::sleep(POLL_INTERVAL);
                    raw
                }
                Source::Hid { pad, device, last } => {
                    let mut buf = [0u8; 128];
                    // Espera até 4 ms pelo próximo relatório e depois esvazia a fila: só o mais
                    // recente importa, e processar atrasados deixaria a entrada arrastada.
                    let mut timeout = HID_READ_TIMEOUT_MS;
                    loop {
                        match device.read_timeout(&mut buf, timeout) {
                            Ok(0) => return Some(*last),
                            Ok(n) => {
                                if let Some(raw) = pad.parse(&buf[..n]) {
                                    *last = raw;
                                }
                                timeout = 0;
                            }
                            Err(_) => {
                                std::thread::sleep(POLL_INTERVAL);
                                return None;
                            }
                        }
                    }
                }
            }
        }
    }

    struct Running {
        stop: Arc<AtomicBool>,
        worker: JoinHandle<()>,
        slot: Option<u32>,
        source: &'static str,
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
            guide: false,
        })
    }

    fn first_connected_slot() -> Option<u32> {
        (0..4u32).find(|slot| read_slot(*slot).is_some())
    }

    /// Controle Sony conectado (USB ou Bluetooth), pelo caminho HID que o hidapi enxerga.
    fn first_sony_pad() -> Option<Selected> {
        let api = hidapi::HidApi::new().ok()?;
        let found = api.device_list().find_map(|info| {
            let pad = SonyPad::from_ids(info.vendor_id(), info.product_id())?;
            // O DualSense/DS4 expõem várias interfaces; só a de gamepad (usage page 1, usage 5) manda estado.
            if info.usage_page() != 0x01 || info.usage() != 0x05 {
                return None;
            }
            Some(Selected::Sony {
                pad,
                path: info.path().to_owned(),
                vendor: info.vendor_id(),
                product: info.product_id(),
            })
        });
        found
    }

    /// Prefere XInput (Xbox e quem emula XInput); sem ele, procura um controle Sony.
    fn select_physical() -> Result<Selected, String> {
        if let Some(slot) = first_connected_slot() {
            return Ok(Selected::XInput { slot });
        }
        first_sony_pad().ok_or_else(|| {
            "Nenhum controle compatível foi encontrado (XInput, DualShock 4 ou DualSense). Confira se ele está conectado."
                .to_string()
        })
    }

    /// Só o controle escolhido é escondido: esconder todos tiraria dos jogos outros controles ligados.
    fn devices_to_hide(selected: &Selected, all: Vec<String>) -> Vec<String> {
        match selected {
            Selected::XInput { .. } => all,
            Selected::Sony { vendor, product, .. } => {
                let needle = format!("VID_{vendor:04X}&PID_{product:04X}");
                all.into_iter().filter(|p| p.to_ascii_uppercase().contains(&needle)).collect()
            }
        }
    }

    fn open_source(selected: Selected) -> Result<(Source, Option<u32>), String> {
        match selected {
            Selected::XInput { slot } => Ok((Source::XInput(slot), Some(slot))),
            Selected::Sony { pad, path, .. } => {
                let api = hidapi::HidApi::new().map_err(|e| format!("hidapi indisponível: {e}"))?;
                let device = api
                    .open_path(&path)
                    .map_err(|e| format!("não foi possível abrir o controle: {e}"))?;
                Ok((Source::Hid { pad, device, last: RawPad::default() }, None))
            }
        }
    }

    pub fn start(settings: ControllerSettings) -> Result<(), String> {
        let mut guard = engine().lock().map_err(|_| "estado do motor travado".to_string())?;
        if guard.is_some() {
            return Ok(()); // idempotente
        }

        // 1) Controle físico ANTES do virtual existir, senão o slot do virtual seria escolhido.
        let selected = select_physical()?;
        let label = selected.label();

        // 2) Esconde o físico do jogo. Falha aqui aborta: sem isso a entrada duplicaria.
        let devices = devices_to_hide(&selected, hidhide_cloak::gaming_devices().map_err(|e| e.to_string())?);
        if devices.is_empty() {
            return Err("O HidHide não listou o controle para esconder do jogo.".into());
        }
        let exe = std::env::current_exe().map_err(|e| format!("executável atual indisponível: {e}"))?;
        let cloak = hidhide_cloak::hide(&devices, &exe).map_err(|e| e.to_string())?;

        // 3) Abre o controle (já escondido: este app está na lista de permitidos) e liga o virtual.
        let (source, slot) = match open_source(selected) {
            Ok(opened) => opened,
            Err(e) => {
                let _ = hidhide_cloak::restore(&cloak);
                return Err(e);
            }
        };
        if let Err(e) = virtual_pad::attach_engine_pad() {
            let _ = hidhide_cloak::restore(&cloak);
            return Err(e);
        }

        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let worker = std::thread::Builder::new()
            .name("pad-engine".into())
            .spawn(move || run_loop(source, settings, worker_stop))
            .map_err(|e| {
                let _ = virtual_pad::detach_engine_pad();
                let _ = hidhide_cloak::restore(&cloak);
                format!("não foi possível iniciar o motor: {e}")
            })?;

        *guard = Some(Running { stop, worker, slot, source: label, cloak: Some(cloak) });
        Ok(())
    }

    fn run_loop(mut source: Source, settings: ControllerSettings, stop: Arc<AtomicBool>) {
        // SAFETY: par timeBeginPeriod/timeEndPeriod com o mesmo valor; sem timer fino o sleep de 4 ms
        // viraria ~15 ms no Windows e a entrada ficaria arrastada.
        unsafe { timeBeginPeriod(1) };
        let mut last = None;
        while !stop.load(Ordering::Relaxed) {
            // Controle desconectado: manda neutro uma vez e espera ele voltar.
            let next = source.read().map(|raw| map_to_pad(&raw, &settings)).unwrap_or_default();
            if last.as_ref() != Some(&next) {
                // Falha de envio não derruba o motor: o próximo quadro tenta de novo.
                let _ = virtual_pad::update_engine_pad(&next);
                last = Some(next);
            }
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

    pub fn is_running() -> bool {
        engine().lock().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn status() -> PadEngineStatus {
        let idle = PadEngineStatus {
            running: false,
            physical_slot: None,
            physical_source: None,
            physical_hidden: false,
        };
        match engine().lock() {
            Ok(guard) => match guard.as_ref() {
                Some(r) => PadEngineStatus {
                    running: true,
                    physical_slot: r.slot,
                    physical_source: Some(r.source),
                    physical_hidden: r.cloak.is_some(),
                },
                None => idle,
            },
            Err(_) => idle,
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
    pub fn is_running() -> bool {
        false
    }
    pub fn status() -> PadEngineStatus {
        PadEngineStatus { running: false, physical_slot: None, physical_source: None, physical_hidden: false }
    }
}

/// Quanto tempo o perfil armado espera o jogo aparecer (atualizações e launchers demoram).
const ARM_TTL: Duration = Duration::from_secs(300);

/// Perfil que vai valer para o jogo que acabou de ser iniciado. A emulação só liga quando o PROCESSO do
/// jogo existe e desliga assim que ele some: antes ela ligava no clique de iniciar e só desligava no fim
/// da sessão, deixando o controle físico escondido do Windows por mais tempo que o jogo.
struct Armed {
    settings: ControllerSettings,
    at: Instant,
}

static ARMED: Mutex<Option<Armed>> = Mutex::new(None);
/// Evita duas partidas ao mesmo tempo: o watcher chama a cada segundo e a partida leva alguns.
static STARTING: AtomicBool = AtomicBool::new(false);

/// O perfil armado, se ainda não venceu. Separado para testar o prazo sem mexer no relógio.
fn live_armed(armed: &Option<Armed>, now: Instant) -> Option<ControllerSettings> {
    armed
        .as_ref()
        .filter(|a| now.saturating_duration_since(a.at) <= ARM_TTL)
        .map(|a| a.settings.clone())
}

fn set_armed(settings: Option<ControllerSettings>) {
    if let Ok(mut guard) = ARMED.lock() {
        *guard = settings.map(|settings| Armed { settings, at: Instant::now() });
    }
}

/// Chamado pelo vigia de jogos a cada rodada: `present` = o processo do jogo existe agora.
pub fn game_presence(app: &AppHandle, present: bool) {
    if present {
        if imp::is_running() {
            return;
        }
        let Some(settings) = ARMED.lock().ok().and_then(|g| live_armed(&g, Instant::now())) else {
            return;
        };
        if STARTING.swap(true, Ordering::AcqRel) {
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(e) = imp::start(settings) {
                eprintln!("[pad-engine] não ligou: {e}");
                let _ = app.emit("pad-engine:error", e);
            }
            STARTING.store(false, Ordering::Release);
        });
    } else if imp::is_running() {
        // o jogo fechou: devolve o controle na hora (o perfil continua armado se for só um launcher passando a vez)
        std::thread::spawn(shutdown);
    }
}

/// A sessão acabou: desliga a emulação e esquece o perfil armado.
pub fn game_ended() {
    set_armed(None);
    std::thread::spawn(shutdown);
}

/// Para o motor e devolve o controle físico (também ao fechar o app).
pub fn shutdown() {
    if let Err(e) = imp::stop() {
        eprintln!("[pad-engine] ao encerrar: {e}");
    }
}

/// Arma a emulação para o jogo que está abrindo: usa o perfil já resolvido pelo front (jogo > global > fábrica).
/// Não liga nada ainda; o vigia liga quando o processo do jogo aparece. Perfil sem emulação desarma.
#[tauri::command]
pub fn pad_engine_arm(settings: ControllerSettings) {
    let settings = settings.sanitized();
    set_armed(settings.emulate_xinput.then_some(settings));
}

/// Liga a emulação agora, sem esperar o jogo (uso manual e testes).
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
    set_armed(None);
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

    /// Ponta a ponta COM controle físico: escolhe o controle, esconde-o pelo HidHide, liga o virtual,
    /// deixa o motor rodar e então desfaz tudo, conferindo que o controle voltou a ficar visível.
    /// Mexe de verdade no HidHide por ~2 s. `cargo test --lib engine_round_trip -- --ignored --nocapture`
    #[test]
    #[ignore = "esconde o controle conectado por alguns segundos"]
    #[cfg(target_os = "windows")]
    fn engine_round_trip_with_real_controller() {
        let settings = ControllerSettings { emulate_xinput: true, ..ControllerSettings::default() };
        imp::start(settings).expect("motor deveria ligar com um controle conectado");
        let status = imp::status();
        println!("status: {status:?}");
        assert!(status.running && status.physical_hidden);
        std::thread::sleep(std::time::Duration::from_millis(1500));
        imp::stop().expect("desligar e restaurar o controle");
        assert!(!imp::status().running);

        let hidden = crate::commands::hidhide_cloak::hidden_devices().expect("--dev-list");
        println!("escondidos depois de parar: {hidden:?}");
        assert!(hidden.is_empty(), "o controle ficou escondido: {hidden:?}");
    }

    fn armed_at(at: Instant) -> Option<Armed> {
        Some(Armed { settings: flat(), at })
    }

    #[test]
    fn armed_profile_is_used_until_it_expires() {
        let start = Instant::now();
        let armed = armed_at(start);
        assert!(live_armed(&armed, start).is_some());
        assert!(live_armed(&armed, start + ARM_TTL).is_some());
        assert!(live_armed(&armed, start + ARM_TTL + Duration::from_secs(1)).is_none());
    }

    #[test]
    fn nothing_armed_means_nothing_to_start() {
        assert!(live_armed(&None, Instant::now()).is_none());
    }

    #[test]
    fn untouched_controller_maps_to_neutral() {
        assert_eq!(map_to_pad(&RawPad::default(), &flat()), PadState::default());
    }
}
