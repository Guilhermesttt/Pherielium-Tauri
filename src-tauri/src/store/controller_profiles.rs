//! Perfis de controle: um global e, opcionalmente, um por jogo.
//!
//! Precedência: **perfil do jogo > perfil global > padrão de fábrica**. A
//! substituição é do perfil INTEIRO, não campo a campo: um jogo ou tem perfil
//! próprio ou usa o global. É o que a UI promete ("Usar global" limpa o
//! override) e é o que dá para explicar sem ambiguidade.
//!
//! As funções de resolução e de curva são puras e testadas; o acesso ao SQLite
//! fica nas funções que recebem `&Connection`, no mesmo banco por usuário da
//! biblioteca.

use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

/// Curva de resposta dos sticks. Tabela em vez de `if` encadeado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ResponseCurve {
    #[default]
    Linear,
    /// Mais precisão no centro, mesma velocidade máxima.
    Smooth,
    /// Reage cedo; bom para mira rápida.
    Aggressive,
}

impl ResponseCurve {
    /// Expoente aplicado à magnitude normalizada (0..=1).
    fn exponent(self) -> f32 {
        match self {
            ResponseCurve::Linear => 1.0,
            ResponseCurve::Smooth => 1.8,
            ResponseCurve::Aggressive => 0.6,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerSettings {
    pub deadzone_left: f32,
    pub deadzone_right: f32,
    pub curve: ResponseCurve,
    pub sensitivity: f32,
    pub invert_y: bool,
    pub trigger_threshold: f32,
    /// Layout Nintendo: A/B trocados.
    pub swap_ab: bool,
    pub rumble: f32,
    /// Publicar um Xbox 360 virtual pelo ViGEm para o jogo enxergar.
    pub emulate_xinput: bool,
}

/// Padrão de fábrica: o último elo da precedência.
impl Default for ControllerSettings {
    fn default() -> Self {
        Self {
            deadzone_left: 0.08,
            deadzone_right: 0.08,
            curve: ResponseCurve::Linear,
            sensitivity: 1.0,
            invert_y: false,
            trigger_threshold: 0.12,
            swap_ab: false,
            rumble: 0.8,
            emulate_xinput: false,
        }
    }
}

impl ControllerSettings {
    /// Prende cada campo à sua faixa válida. Vale para o que vem do front e para
    /// o que já está gravado: um JSON antigo ou adulterado nunca vira valor absurdo.
    pub fn sanitized(mut self) -> Self {
        let factory = ControllerSettings::default();
        if !self.deadzone_left.is_finite() {
            self.deadzone_left = factory.deadzone_left;
        }
        if !self.deadzone_right.is_finite() {
            self.deadzone_right = factory.deadzone_right;
        }
        if !self.sensitivity.is_finite() {
            self.sensitivity = factory.sensitivity;
        }
        if !self.trigger_threshold.is_finite() {
            self.trigger_threshold = factory.trigger_threshold;
        }
        if !self.rumble.is_finite() {
            self.rumble = factory.rumble;
        }
        self.deadzone_left = self.deadzone_left.clamp(0.0, 0.5);
        self.deadzone_right = self.deadzone_right.clamp(0.0, 0.5);
        self.sensitivity = self.sensitivity.clamp(0.25, 3.0);
        self.trigger_threshold = self.trigger_threshold.clamp(0.0, 0.9);
        self.rumble = self.rumble.clamp(0.0, 1.0);
        self
    }
}

/// De onde veio o perfil em uso. A UI mostra isto para a pessoa saber se está
/// editando o jogo ou o global.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProfileOrigin {
    Game,
    Global,
    Factory,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedProfile {
    pub settings: ControllerSettings,
    pub origin: ProfileOrigin,
}

/// Precedência pura: jogo > global > fábrica.
pub fn resolve(
    game: Option<ControllerSettings>,
    global: Option<ControllerSettings>,
) -> ResolvedProfile {
    match (game, global) {
        (Some(s), _) => ResolvedProfile {
            settings: s.sanitized(),
            origin: ProfileOrigin::Game,
        },
        (None, Some(s)) => ResolvedProfile {
            settings: s.sanitized(),
            origin: ProfileOrigin::Global,
        },
        (None, None) => ResolvedProfile {
            settings: ControllerSettings::default(),
            origin: ProfileOrigin::Factory,
        },
    }
}

// ── Transformações puras de eixo ────────────────────────────────────────────

/// Aplica deadzone radial, curva e sensibilidade a um eixo de stick (-1..=1).
///
/// Radial e não por eixo: com deadzone por eixo o stick "engancha" nas
/// diagonais, porque X e Y são cortados de forma independente. `other` é o
/// companheiro do par (x recebe y e vice-versa).
pub fn apply_axis(
    value: f32,
    other: f32,
    deadzone: f32,
    curve: ResponseCurve,
    sensitivity: f32,
) -> f32 {
    if !value.is_finite() || !other.is_finite() {
        return 0.0;
    }
    let magnitude = (value * value + other * other).sqrt();
    if magnitude <= deadzone || magnitude <= f32::EPSILON {
        return 0.0;
    }
    // Reescala para que o primeiro passo fora da deadzone comece em 0, sem degrau.
    let span = (1.0 - deadzone).max(f32::EPSILON);
    let normalized = ((magnitude - deadzone) / span).clamp(0.0, 1.0);
    let shaped = normalized.powf(curve.exponent());
    let scaled = (value / magnitude) * shaped * sensitivity;
    scaled.clamp(-1.0, 1.0)
}

/// Gatilho (0..=1): abaixo do limiar é zero, acima reescala para a faixa cheia.
pub fn apply_trigger(value: f32, threshold: f32) -> f32 {
    if !value.is_finite() || value <= threshold {
        return 0.0;
    }
    let span = (1.0 - threshold).max(f32::EPSILON);
    ((value - threshold) / span).clamp(0.0, 1.0)
}

// ── Persistência ────────────────────────────────────────────────────────────

const GLOBAL_SCOPE: &str = "__global__";

/// `game_id` nulo = perfil global.
fn scope_key(game_id: Option<&str>) -> String {
    game_id
        .map(|g| g.to_string())
        .unwrap_or_else(|| GLOBAL_SCOPE.to_string())
}

pub(crate) fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS controller_profiles (
            scope_key   TEXT PRIMARY KEY,
            game_id     TEXT,
            settings    TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );",
    )?;
    Ok(())
}

fn now_iso() -> String {
    crate::commands::achievement_util::rfc3339_from_unix(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    )
}

pub fn get(conn: &Connection, game_id: Option<&str>) -> Result<Option<ControllerSettings>> {
    let json: Option<String> = conn
        .query_row(
            "SELECT settings FROM controller_profiles WHERE scope_key = ?1",
            params![scope_key(game_id)],
            |r| r.get(0),
        )
        .optional()?;
    let Some(json) = json else { return Ok(None) };
    // JSON ilegível (versão antiga, gravação truncada) vale como "sem perfil":
    // a precedência cai para o próximo nível em vez de derrubar a leitura.
    Ok(serde_json::from_str::<ControllerSettings>(&json)
        .ok()
        .map(ControllerSettings::sanitized))
}

pub fn save(conn: &Connection, game_id: Option<&str>, settings: &ControllerSettings) -> Result<()> {
    let json = serde_json::to_string(&settings.clone().sanitized())?;
    conn.execute(
        "INSERT INTO controller_profiles (scope_key, game_id, settings, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(scope_key) DO UPDATE SET settings = ?3, updated_at = ?4",
        params![scope_key(game_id), game_id, json, now_iso()],
    )?;
    Ok(())
}

/// Remove o override do jogo ("Usar global"). Sem efeito no global.
pub fn delete(conn: &Connection, game_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM controller_profiles WHERE scope_key = ?1",
        params![scope_key(Some(game_id))],
    )?;
    Ok(())
}

/// Jogos que têm perfil próprio, para a lista de "perfis por jogo".
pub fn list_game_ids(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT game_id FROM controller_profiles
         WHERE game_id IS NOT NULL ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Perfil efetivo do jogo (ou do launcher, quando `game_id` é `None`).
pub fn resolve_for(conn: &Connection, game_id: Option<&str>) -> Result<ResolvedProfile> {
    let global = get(conn, None)?;
    let game = match game_id {
        Some(id) => get(conn, Some(id))?,
        None => None,
    };
    Ok(resolve(game, global))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn custom(sensitivity: f32) -> ControllerSettings {
        ControllerSettings {
            sensitivity,
            ..Default::default()
        }
    }

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn precedence_is_game_then_global_then_factory() {
        let g = resolve(Some(custom(2.0)), Some(custom(1.5)));
        assert_eq!(g.origin, ProfileOrigin::Game);
        assert_eq!(g.settings.sensitivity, 2.0);

        let gl = resolve(None, Some(custom(1.5)));
        assert_eq!(gl.origin, ProfileOrigin::Global);
        assert_eq!(gl.settings.sensitivity, 1.5);

        let f = resolve(None, None);
        assert_eq!(f.origin, ProfileOrigin::Factory);
        assert_eq!(f.settings, ControllerSettings::default());
    }

    #[test]
    fn values_out_of_range_are_clamped() {
        let s = ControllerSettings {
            deadzone_left: 9.0,
            deadzone_right: -3.0,
            sensitivity: 99.0,
            trigger_threshold: 5.0,
            rumble: -1.0,
            ..Default::default()
        }
        .sanitized();
        assert_eq!(s.deadzone_left, 0.5);
        assert_eq!(s.deadzone_right, 0.0);
        assert_eq!(s.sensitivity, 3.0);
        assert_eq!(s.trigger_threshold, 0.9);
        assert_eq!(s.rumble, 0.0);
    }

    #[test]
    fn nan_falls_back_to_factory_value() {
        let s = ControllerSettings {
            sensitivity: f32::NAN,
            ..Default::default()
        }
        .sanitized();
        assert_eq!(s.sensitivity, 1.0);
    }

    #[test]
    fn deadzone_is_radial_so_diagonals_do_not_snag() {
        // Dentro da deadzone em ambos os eixos: zera.
        assert_eq!(apply_axis(0.05, 0.05, 0.2, ResponseCurve::Linear, 1.0), 0.0);
        // Cada eixo sozinho é pequeno, mas a magnitude passa: não pode zerar.
        let v = apply_axis(0.2, 0.2, 0.2, ResponseCurve::Linear, 1.0);
        assert!(v > 0.0, "diagonal dentro da faixa foi cortada: {v}");
    }

    #[test]
    fn axis_starts_at_zero_right_outside_the_deadzone() {
        // Sem degrau: logo acima da deadzone o valor sai de ~0, não de 0.3.
        let v = apply_axis(0.301, 0.0, 0.3, ResponseCurve::Linear, 1.0);
        assert!(v.abs() < 0.01, "degrau na saída da deadzone: {v}");
    }

    #[test]
    fn curves_order_by_response_at_half_travel() {
        let smooth = apply_axis(0.5, 0.0, 0.0, ResponseCurve::Smooth, 1.0);
        let linear = apply_axis(0.5, 0.0, 0.0, ResponseCurve::Linear, 1.0);
        let aggressive = apply_axis(0.5, 0.0, 0.0, ResponseCurve::Aggressive, 1.0);
        assert!(smooth < linear, "suave deveria reagir menos no meio");
        assert!(aggressive > linear, "agressiva deveria reagir mais no meio");
    }

    #[test]
    fn axis_never_leaves_minus_one_to_one() {
        let v = apply_axis(1.0, 0.0, 0.0, ResponseCurve::Aggressive, 3.0);
        assert!((-1.0..=1.0).contains(&v), "saiu da faixa: {v}");
    }

    #[test]
    fn trigger_below_threshold_is_zero_and_rescales_above() {
        assert_eq!(apply_trigger(0.1, 0.2), 0.0);
        assert_eq!(apply_trigger(0.2, 0.2), 0.0);
        assert!((apply_trigger(0.6, 0.2) - 0.5).abs() < 1e-6);
        assert!((apply_trigger(1.0, 0.2) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn game_profile_is_saved_read_and_cleared() {
        let conn = mem();
        save(&conn, None, &custom(1.5)).unwrap();
        save(&conn, Some("game-1"), &custom(2.5)).unwrap();

        assert_eq!(
            resolve_for(&conn, Some("game-1")).unwrap().origin,
            ProfileOrigin::Game
        );
        assert_eq!(
            resolve_for(&conn, Some("outro")).unwrap().origin,
            ProfileOrigin::Global
        );
        assert_eq!(list_game_ids(&conn).unwrap(), vec!["game-1".to_string()]);

        // "Usar global": some o override, o global segue de pé.
        delete(&conn, "game-1").unwrap();
        assert_eq!(
            resolve_for(&conn, Some("game-1")).unwrap().origin,
            ProfileOrigin::Global
        );
        assert!(list_game_ids(&conn).unwrap().is_empty());
        assert_eq!(get(&conn, None).unwrap().unwrap().sensitivity, 1.5);
    }

    #[test]
    fn corrupt_json_degrades_to_the_next_level() {
        let conn = mem();
        save(&conn, None, &custom(1.5)).unwrap();
        conn.execute(
            "INSERT INTO controller_profiles (scope_key, game_id, settings, updated_at)
             VALUES ('game-x', 'game-x', 'nao e json', '2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let r = resolve_for(&conn, Some("game-x")).unwrap();
        assert_eq!(
            r.origin,
            ProfileOrigin::Global,
            "JSON ruim deveria cair para o global"
        );
    }
}
