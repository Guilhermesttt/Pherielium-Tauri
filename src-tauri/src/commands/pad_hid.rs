//! Relatórios HID de DualShock 4 e DualSense convertidos para a leitura crua do motor de emulação.
//!
//! O Windows só fala XInput com controles Xbox; os da Sony chegam como HID genérico, então o motor
//! lê o relatório de entrada direto e o traduz para o mesmo `RawPad` do XInput. As posições dos
//! bytes seguem as mesmas que `hardware.rs` já usa para a bateria (USB e Bluetooth diferem só por
//! um deslocamento fixo).
//!
//! Funções puras e sem dependência de plataforma: o que vem do hardware fica em `pad_engine`.

use super::pad_engine::RawPad;

pub const SONY_VID: u16 = 0x054C;
pub const DS4_PIDS: [u16; 2] = [0x05C4, 0x09CC];
pub const DUALSENSE_PIDS: [u16; 2] = [0x0CE6, 0x0DF2];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SonyPad {
    DualShock4,
    DualSense,
}

impl SonyPad {
    pub fn from_ids(vendor: u16, product: u16) -> Option<Self> {
        if vendor != SONY_VID {
            return None;
        }
        if DS4_PIDS.contains(&product) {
            Some(SonyPad::DualShock4)
        } else if DUALSENSE_PIDS.contains(&product) {
            Some(SonyPad::DualSense)
        } else {
            None
        }
    }

    /// Converte um relatório de entrada. `None` quando não é um relatório de estado conhecido
    /// (o controle também manda relatórios de outros tipos, que simplesmente são ignorados).
    pub fn parse(self, report: &[u8]) -> Option<RawPad> {
        match self {
            SonyPad::DualShock4 => parse_ds4(report),
            SonyPad::DualSense => parse_dualsense(report),
        }
    }
}

// Máscaras do XInput que o `RawPad` usa (as mesmas de `pad_engine::mask`).
const X_DPAD_UP: u16 = 0x0001;
const X_DPAD_DOWN: u16 = 0x0002;
const X_DPAD_LEFT: u16 = 0x0004;
const X_DPAD_RIGHT: u16 = 0x0008;
const X_START: u16 = 0x0010;
const X_BACK: u16 = 0x0020;
const X_LEFT_THUMB: u16 = 0x0040;
const X_RIGHT_THUMB: u16 = 0x0080;
const X_LEFT_SHOULDER: u16 = 0x0100;
const X_RIGHT_SHOULDER: u16 = 0x0200;
const X_A: u16 = 0x1000;
const X_B: u16 = 0x2000;
const X_X: u16 = 0x4000;
const X_Y: u16 = 0x8000;

/// Direcional em "hat" (0 = norte, sentido horário, 8 ou mais = solto) para as quatro direções.
fn hat_to_dpad(hat: u8) -> u16 {
    match hat {
        0 => X_DPAD_UP,
        1 => X_DPAD_UP | X_DPAD_RIGHT,
        2 => X_DPAD_RIGHT,
        3 => X_DPAD_DOWN | X_DPAD_RIGHT,
        4 => X_DPAD_DOWN,
        5 => X_DPAD_DOWN | X_DPAD_LEFT,
        6 => X_DPAD_LEFT,
        7 => X_DPAD_UP | X_DPAD_LEFT,
        _ => 0,
    }
}

/// Byte 0..=255 (128 no centro) para i16. O eixo Y da Sony cresce para BAIXO; o do XInput para cima.
fn stick(value: u8, invert: bool) -> i16 {
    let centered = value as i32 - 128;
    let scaled = centered * 256; // -32768..=32512
    let v = if invert { -scaled } else { scaled };
    v.clamp(i16::MIN as i32, i16::MAX as i32) as i16
}

/// Quadrado/Xis/Bolinha/Triângulo no nibble alto do byte de botões.
fn face_buttons(byte: u8) -> u16 {
    let mut b = 0;
    if byte & 0x10 != 0 {
        b |= X_X; // quadrado
    }
    if byte & 0x20 != 0 {
        b |= X_A; // xis
    }
    if byte & 0x40 != 0 {
        b |= X_B; // bolinha
    }
    if byte & 0x80 != 0 {
        b |= X_Y; // triângulo
    }
    b
}

/// Byte de ombros/menus: L1, R1, (L2, R2 digitais — o analógico vem à parte), Share, Options, L3, R3.
fn shoulder_buttons(byte: u8) -> u16 {
    let mut b = 0;
    if byte & 0x01 != 0 {
        b |= X_LEFT_SHOULDER;
    }
    if byte & 0x02 != 0 {
        b |= X_RIGHT_SHOULDER;
    }
    if byte & 0x10 != 0 {
        b |= X_BACK;
    }
    if byte & 0x20 != 0 {
        b |= X_START;
    }
    if byte & 0x40 != 0 {
        b |= X_LEFT_THUMB;
    }
    if byte & 0x80 != 0 {
        b |= X_RIGHT_THUMB;
    }
    b
}

/// DualShock 4. USB: relatório 0x01 (≥ 10 bytes). Bluetooth: 0x11, mesmo layout com 2 bytes a mais
/// no começo. O relatório 0x01 reduzido do Bluetooth tem os mesmos primeiros bytes.
fn parse_ds4(report: &[u8]) -> Option<RawPad> {
    let base = match report.first()? {
        0x01 => 1,
        0x11 => 3,
        _ => return None,
    };
    let d = report.get(base..base + 9)?;
    // d: [LX, LY, RX, RY, botões+hat, ombros, PS/touchpad, L2, R2]
    Some(RawPad {
        buttons: hat_to_dpad(d[4] & 0x0F) | face_buttons(d[4]) | shoulder_buttons(d[5]),
        left_trigger: d[7],
        right_trigger: d[8],
        left_x: stick(d[0], false),
        left_y: stick(d[1], true),
        right_x: stick(d[2], false),
        right_y: stick(d[3], true),
        guide: d[6] & 0x01 != 0,
    })
}

/// DualSense. USB: relatório 0x01. Bluetooth: 0x31, com 1 byte a mais no começo.
fn parse_dualsense(report: &[u8]) -> Option<RawPad> {
    let base = match report.first()? {
        0x01 => 1,
        0x31 => 2,
        _ => return None,
    };
    let d = report.get(base..base + 10)?;
    // d: [LX, LY, RX, RY, L2, R2, contador, botões+hat, ombros, PS/touchpad]
    Some(RawPad {
        buttons: hat_to_dpad(d[7] & 0x0F) | face_buttons(d[7]) | shoulder_buttons(d[8]),
        left_trigger: d[4],
        right_trigger: d[5],
        left_x: stick(d[0], false),
        left_y: stick(d[1], true),
        right_x: stick(d[2], false),
        right_y: stick(d[3], true),
        guide: d[9] & 0x01 != 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Relatório USB do DS4 em repouso: sticks no meio, direcional solto (8).
    fn ds4_idle() -> Vec<u8> {
        let mut r = vec![0u8; 64];
        r[0] = 0x01;
        r[1..5].copy_from_slice(&[128, 128, 128, 128]);
        r[5] = 0x08;
        r
    }

    #[test]
    fn identifies_sony_pads_only() {
        assert_eq!(SonyPad::from_ids(0x054C, 0x05C4), Some(SonyPad::DualShock4));
        assert_eq!(SonyPad::from_ids(0x054C, 0x0CE6), Some(SonyPad::DualSense));
        assert_eq!(SonyPad::from_ids(0x045E, 0x05C4), None);
        assert_eq!(SonyPad::from_ids(0x054C, 0x0001), None);
    }

    #[test]
    fn ds4_at_rest_is_neutral() {
        let pad = SonyPad::DualShock4.parse(&ds4_idle()).unwrap();
        assert_eq!(pad, RawPad::default());
    }

    #[test]
    fn ds4_buttons_map_to_the_xbox_layout() {
        let mut r = ds4_idle();
        r[5] = 0x20 | 0x02; // xis + direcional leste
        r[6] = 0x01 | 0x20; // L1 + options
        r[7] = 0x01; // PS
        r[8] = 200;
        let pad = SonyPad::DualShock4.parse(&r).unwrap();
        assert_ne!(pad.buttons & X_A, 0, "xis vira A");
        assert_ne!(pad.buttons & X_DPAD_RIGHT, 0);
        assert_ne!(pad.buttons & X_LEFT_SHOULDER, 0);
        assert_ne!(pad.buttons & X_START, 0, "options vira Start");
        assert_eq!(pad.buttons & X_B, 0);
        assert_eq!(pad.left_trigger, 200);
        assert!(pad.guide);
    }

    #[test]
    fn ds4_y_axis_is_flipped_to_the_xinput_convention() {
        let mut r = ds4_idle();
        r[2] = 0; // stick esquerdo todo para CIMA no hardware da Sony
        let up = SonyPad::DualShock4.parse(&r).unwrap();
        assert_eq!(up.left_y, i16::MAX);
        r[2] = 255; // todo para baixo
        let down = SonyPad::DualShock4.parse(&r).unwrap();
        assert!(down.left_y < -32000);
    }

    #[test]
    fn diagonal_hat_presses_two_directions() {
        let mut r = ds4_idle();
        r[5] = 0x05; // sudoeste
        let pad = SonyPad::DualShock4.parse(&r).unwrap();
        assert_eq!(pad.buttons & (X_DPAD_DOWN | X_DPAD_LEFT), X_DPAD_DOWN | X_DPAD_LEFT);
        assert_eq!(pad.buttons & (X_DPAD_UP | X_DPAD_RIGHT), 0);
    }

    #[test]
    fn ds4_bluetooth_report_is_shifted_by_two_bytes() {
        let mut r = vec![0u8; 78];
        r[0] = 0x11;
        r[3..7].copy_from_slice(&[128, 128, 128, 128]);
        r[7] = 0x08 | 0x40; // bolinha
        let pad = SonyPad::DualShock4.parse(&r).unwrap();
        assert_ne!(pad.buttons & X_B, 0);
    }

    #[test]
    fn dualsense_usb_layout() {
        let mut r = vec![0u8; 64];
        r[0] = 0x01;
        r[1..5].copy_from_slice(&[128, 128, 128, 128]);
        r[5] = 255; // L2
        r[8] = 0x08 | 0x80; // triângulo
        r[9] = 0x02; // R1
        let pad = SonyPad::DualSense.parse(&r).unwrap();
        assert_eq!(pad.left_trigger, 255);
        assert_ne!(pad.buttons & X_Y, 0);
        assert_ne!(pad.buttons & X_RIGHT_SHOULDER, 0);
    }

    #[test]
    fn unknown_or_short_reports_are_ignored() {
        assert!(SonyPad::DualShock4.parse(&[]).is_none());
        assert!(SonyPad::DualShock4.parse(&[0x01, 1, 2]).is_none());
        assert!(SonyPad::DualShock4.parse(&[0x05; 64]).is_none());
        assert!(SonyPad::DualSense.parse(&[0x01, 1, 2]).is_none());
    }

    #[test]
    fn stick_never_overflows() {
        assert_eq!(stick(0, false), i16::MIN);
        assert_eq!(stick(255, false), 127 * 256);
        assert_eq!(stick(0, true), i16::MAX);
    }
}
