//! Gamepad Xbox 360 virtual pelo ViGEmBus.
//!
//! O front lê o controle físico (Web Gamepad API), aplica o perfil e manda o
//! estado resultante para cá; aqui ele vira um Xbox 360 que o jogo enxerga.
//!
//! Aviso que vale para quem usa: com o pad virtual ligado o Windows passa a
//! expor DOIS controles (o físico e o virtual). Jogos que leem os dois recebem
//! entrada duplicada. Esconder o físico exige o HidHide, que é outro driver e
//! não entra aqui.
//!
//! `plugin()` recém-feito nem sempre está pronto para receber estado: na
//! primeira vez depois do boot o driver do Xbox 360 ainda está se ligando ao
//! dispositivo, e `wait_ready`/`update` respondem erro. Por isso os dois têm
//! tentativas — medido: segunda execução fica pronta em ~15 ms, a primeira pode
//! falhar de cara.

use serde::{Deserialize, Serialize};
use tauri::command;

/// Estado de um gamepad, já com o perfil aplicado pelo front.
/// Eixos em -1.0..=1.0, gatilhos em 0.0..=1.0.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PadState {
    pub left_x: f32,
    pub left_y: f32,
    pub right_x: f32,
    pub right_y: f32,
    pub left_trigger: f32,
    pub right_trigger: f32,
    pub a: bool,
    pub b: bool,
    pub x: bool,
    pub y: bool,
    pub left_bumper: bool,
    pub right_bumper: bool,
    pub back: bool,
    pub start: bool,
    pub left_thumb: bool,
    pub right_thumb: bool,
    pub dpad_up: bool,
    pub dpad_down: bool,
    pub dpad_left: bool,
    pub dpad_right: bool,
    pub guide: bool,
}

/// Converte -1.0..=1.0 para o i16 do XInput, sem estourar nas pontas.
fn axis_to_i16(v: f32) -> i16 {
    if !v.is_finite() {
        return 0;
    }
    (v.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
}

/// Converte 0.0..=1.0 para o u8 do gatilho.
fn trigger_to_u8(v: f32) -> u8 {
    if !v.is_finite() {
        return 0;
    }
    (v.clamp(0.0, 1.0) * u8::MAX as f32) as u8
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{axis_to_i16, trigger_to_u8, PadState};
    use std::sync::{Arc, Mutex, OnceLock};
    use std::time::Duration;
    use vigem_client::{Client, TargetId, XButtons, XGamepad, Xbox360Wired};

    /// Tentativas na ligação inicial. O driver demora alguns milissegundos para
    /// se ligar ao dispositivo recém-criado; sem isso a primeira ativação
    /// depois do boot falha.
    const READY_ATTEMPTS: u32 = 20;
    const RETRY_DELAY: Duration = Duration::from_millis(150);

    type Pad = Xbox360Wired<Arc<Client>>;

    fn slot() -> &'static Mutex<Option<Pad>> {
        static SLOT: OnceLock<Mutex<Option<Pad>>> = OnceLock::new();
        SLOT.get_or_init(|| Mutex::new(None))
    }

    pub fn is_attached() -> bool {
        slot().lock().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn attach() -> Result<(), String> {
        let mut guard = slot().lock().map_err(|_| "estado do pad virtual travado".to_string())?;
        if guard.is_some() {
            return Ok(()); // idempotente: ligar duas vezes não cria dois pads
        }

        let client = Arc::new(
            Client::connect().map_err(|e| format!("ViGEmBus não respondeu: {e:?}"))?,
        );
        let mut pad = Xbox360Wired::new(client, TargetId::XBOX360_WIRED);
        pad.plugin()
            .map_err(|e| format!("não foi possível criar o controle virtual: {e:?}"))?;

        let mut last = String::new();
        let mut ready = false;
        for _ in 0..READY_ATTEMPTS {
            match pad.wait_ready() {
                Ok(()) => {
                    ready = true;
                    break;
                }
                Err(e) => {
                    last = format!("{e:?}");
                    std::thread::sleep(RETRY_DELAY);
                }
            }
        }
        if !ready {
            // Desfaz o plugin para não deixar um dispositivo pela metade.
            let _ = pad.unplug();
            return Err(format!("o controle virtual não ficou pronto: {last}"));
        }

        *guard = Some(pad);
        Ok(())
    }

    pub fn detach() -> Result<(), String> {
        let mut guard = slot().lock().map_err(|_| "estado do pad virtual travado".to_string())?;
        if let Some(mut pad) = guard.take() {
            pad.unplug()
                .map_err(|e| format!("não foi possível remover o controle virtual: {e:?}"))?;
        }
        Ok(())
    }

    pub fn update(state: &PadState) -> Result<(), String> {
        let mut guard = slot().lock().map_err(|_| "estado do pad virtual travado".to_string())?;
        let Some(pad) = guard.as_mut() else {
            return Err("o controle virtual não está ligado".into());
        };

        let mut buttons = 0u16;
        // Tabela bit a bit: sem `if` encadeado, e fácil de conferir contra o XInput.
        for (on, mask) in [
            (state.a, XButtons::A),
            (state.b, XButtons::B),
            (state.x, XButtons::X),
            (state.y, XButtons::Y),
            (state.left_bumper, XButtons::LB),
            (state.right_bumper, XButtons::RB),
            (state.back, XButtons::BACK),
            (state.start, XButtons::START),
            (state.left_thumb, XButtons::LTHUMB),
            (state.right_thumb, XButtons::RTHUMB),
            (state.dpad_up, XButtons::UP),
            (state.dpad_down, XButtons::DOWN),
            (state.dpad_left, XButtons::LEFT),
            (state.dpad_right, XButtons::RIGHT),
            (state.guide, XButtons::GUIDE),
        ] {
            if on {
                buttons |= mask;
            }
        }

        let gamepad = XGamepad {
            buttons: vigem_client::XButtons { raw: buttons },
            left_trigger: trigger_to_u8(state.left_trigger),
            right_trigger: trigger_to_u8(state.right_trigger),
            thumb_lx: axis_to_i16(state.left_x),
            thumb_ly: axis_to_i16(state.left_y),
            thumb_rx: axis_to_i16(state.right_x),
            thumb_ry: axis_to_i16(state.right_y),
        };

        pad.update(&gamepad)
            .map_err(|e| format!("falha ao enviar o estado ao controle virtual: {e:?}"))
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use super::PadState;

    const UNSUPPORTED: &str = "Controle virtual exige ViGEmBus, que só existe no Windows.";

    pub fn is_attached() -> bool {
        false
    }
    pub fn attach() -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }
    pub fn detach() -> Result<(), String> {
        Ok(())
    }
    pub fn update(_state: &PadState) -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }
}

/// Liga o controle virtual. Idempotente: chamar de novo não cria um segundo.
///
/// Recusa sem o HidHide. A aba já trava o toggle, mas um perfil gravado quando
/// o HidHide existia continuaria pedindo emulação depois de ele ser removido —
/// e aí o jogo receberia entrada duplicada sem ninguém ter escolhido isso.
#[command]
pub fn virtual_pad_attach() -> Result<(), String> {
    let drivers = super::controller_config::controller_driver_status();
    if !drivers.vigem.installed {
        return Err(drivers
            .vigem
            .detail
            .unwrap_or_else(|| "ViGEmBus não está instalado.".into()));
    }
    if !drivers.hid_hide.installed {
        return Err(
            "O HidHide não está instalado: sem ele o jogo lê o controle físico e o virtual ao mesmo tempo, duplicando a entrada."
                .into(),
        );
    }
    imp::attach()
}

/// Entradas do motor de emulação (`pad_engine`): ele já validou os drivers e esconde o físico,
/// então aqui não repete a checagem do HidHide feita por `virtual_pad_attach`.
pub fn attach_engine_pad() -> Result<(), String> {
    imp::attach()
}

pub fn detach_engine_pad() -> Result<(), String> {
    imp::detach()
}

pub fn update_engine_pad(state: &PadState) -> Result<(), String> {
    imp::update(state)
}

/// Desliga o controle virtual. Sem efeito se já estava desligado.
#[command]
pub fn virtual_pad_detach() -> Result<(), String> {
    imp::detach()
}

#[command]
pub fn virtual_pad_is_attached() -> bool {
    imp::is_attached()
}

/// Envia o estado já processado pelo perfil.
#[command]
pub fn virtual_pad_update(state: PadState) -> Result<(), String> {
    imp::update(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn axis_maps_the_full_range_without_wrapping() {
        assert_eq!(axis_to_i16(0.0), 0);
        assert_eq!(axis_to_i16(1.0), i16::MAX);
        assert_eq!(axis_to_i16(-1.0), -i16::MAX);
        // Fora da faixa não pode dar a volta e virar o sinal oposto.
        assert_eq!(axis_to_i16(9.0), i16::MAX);
        assert_eq!(axis_to_i16(-9.0), -i16::MAX);
        assert_eq!(axis_to_i16(f32::NAN), 0);
    }

    #[test]
    fn trigger_maps_zero_to_full() {
        assert_eq!(trigger_to_u8(0.0), 0);
        assert_eq!(trigger_to_u8(1.0), u8::MAX);
        assert_eq!(trigger_to_u8(2.0), u8::MAX);
        assert_eq!(trigger_to_u8(-1.0), 0);
        assert_eq!(trigger_to_u8(f32::NAN), 0);
    }
}
