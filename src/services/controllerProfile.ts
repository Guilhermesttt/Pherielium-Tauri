/**
 * Perfis de controle: um global e, opcionalmente, um por jogo.
 *
 * A precedência (jogo > global > fábrica), a validação de faixa e a matemática
 * de deadzone/curva vivem no Rust (`store/controller_profiles.rs`), com testes
 * lá. Este módulo é só a ponte de IPC — nada de reimplementar a regra aqui, ou
 * as duas versões divergem e a UI passa a mostrar algo diferente do que o
 * controle faz.
 */

export type ResponseCurve = "linear" | "smooth" | "aggressive";

/** De onde veio o perfil em uso. */
export type ProfileOrigin = "game" | "global" | "factory";

export interface ControllerSettings {
  deadzoneLeft: number;
  deadzoneRight: number;
  curve: ResponseCurve;
  sensitivity: number;
  invertY: boolean;
  triggerThreshold: number;
  /** Layout Nintendo: A/B trocados. */
  swapAb: boolean;
  rumble: number;
  /** Publicar um Xbox 360 virtual pelo ViGEm para o jogo enxergar. */
  emulateXinput: boolean;
}

export interface ResolvedProfile {
  settings: ControllerSettings;
  origin: ProfileOrigin;
}

export interface VigemStatus {
  installed: boolean;
  supported: boolean;
  detail: string | null;
}

export const CURVE_OPTIONS: ReadonlyArray<{ value: ResponseCurve; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "smooth", label: "Suave" },
  { value: "aggressive", label: "Agressiva" },
];

/** Espelho do `Default` do Rust. Usado só para a UI abrir sem piscar. */
export const FACTORY_SETTINGS: ControllerSettings = {
  deadzoneLeft: 0.08,
  deadzoneRight: 0.08,
  curve: "linear",
  sensitivity: 1,
  invertY: false,
  triggerThreshold: 0.12,
  swapAb: false,
  rumble: 0.8,
  emulateXinput: false,
};

/** Presets do painel rápido. Tabela, não `if` encadeado. */
export const CONTROLLER_PRESETS = {
  padrao: FACTORY_SETTINGS,
  shooter: {
    ...FACTORY_SETTINGS,
    deadzoneRight: 0.05,
    curve: "smooth",
    sensitivity: 1.35,
    triggerThreshold: 0.06,
  },
  corrida: {
    ...FACTORY_SETTINGS,
    deadzoneLeft: 0.04,
    curve: "smooth",
    sensitivity: 0.9,
    triggerThreshold: 0.03,
  },
  plataforma: {
    ...FACTORY_SETTINGS,
    deadzoneLeft: 0.12,
    curve: "aggressive",
    sensitivity: 1.1,
  },
} as const satisfies Record<string, ControllerSettings>;

export type PresetName = keyof typeof CONTROLLER_PRESETS;

export const PRESET_LABELS: Record<PresetName, string> = {
  padrao: "Padrão",
  shooter: "Shooter",
  corrida: "Corrida",
  plataforma: "Plataforma",
};

const hasTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!hasTauri()) {
    throw new Error("Perfis de controle exigem o app desktop.");
  }
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(cmd, args);
};

/** Perfil efetivo. `gameId` ausente = o do launcher. */
export const resolveControllerProfile = (uid: string, gameId?: string) =>
  invoke<ResolvedProfile>("controller_profile_resolve", { uid, gameId: gameId ?? null });

/** O que está gravado num escopo, sem herança. `null` = não há override ali. */
export const getControllerProfile = (uid: string, gameId?: string) =>
  invoke<ControllerSettings | null>("controller_profile_get", {
    uid,
    gameId: gameId ?? null,
  });

export const saveControllerProfile = (
  uid: string,
  settings: ControllerSettings,
  gameId?: string,
) =>
  invoke<ResolvedProfile>("controller_profile_save", {
    uid,
    gameId: gameId ?? null,
    settings,
  });

/** "Usar global": apaga o override do jogo. */
export const clearGameControllerProfile = (uid: string, gameId: string) =>
  invoke<ResolvedProfile>("controller_profile_clear_game", { uid, gameId });

/** "Restaurar padrão": apaga o perfil global. */
export const resetGlobalControllerProfile = (uid: string) =>
  invoke<ResolvedProfile>("controller_profile_reset_global", { uid });

export const listGamesWithControllerProfile = (uid: string) =>
  invoke<string[]>("controller_profile_list_games", { uid });

/** Amostras da curva, calculadas no Rust para não divergir do runtime. */
export const previewCurve = (settings: ControllerSettings, samples = 64) =>
  invoke<number[]>("controller_curve_preview", { settings, samples });

export const previewTrigger = (settings: ControllerSettings, samples = 64) =>
  invoke<number[]>("controller_trigger_preview", { settings, samples });

export interface HidHideStatus {
  installed: boolean;
  supported: boolean;
  detail: string | null;
}

export interface ControllerDriverStatus {
  vigem: VigemStatus;
  hidHide: HidHideStatus;
  /** `true` só quando dá para emular sem duplicar entrada. */
  emulationReady: boolean;
}

/** Estado do driver. Só reporta — a instalação é guiada, nunca silenciosa. */
export const getVigemStatus = () => invoke<VigemStatus>("vigem_status");

export const getHidHideStatus = () => invoke<HidHideStatus>("hidhide_status");

/**
 * Os dois drivers de uma vez. O toggle de emulação só habilita com
 * `emulationReady`: sem o HidHide o jogo lê o controle físico E o virtual, e a
 * entrada chega duplicada.
 */
export const getControllerDriverStatus = () =>
  invoke<ControllerDriverStatus>("controller_driver_status");

/** Páginas oficiais dos instaladores. */
export const VIGEM_RELEASE_URL = "https://github.com/nefarius/ViGEmBus/releases/latest";
export const HIDHIDE_RELEASE_URL = "https://github.com/nefarius/HidHide/releases/latest";

// ── Controle virtual (ViGEmBus) ─────────────────────────────────────────────

/**
 * Estado já processado pelo perfil, pronto para virar um Xbox 360 virtual.
 * Eixos em -1..=1, gatilhos em 0..=1.
 */
export interface PadState {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  leftTrigger: number;
  rightTrigger: number;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  leftBumper: boolean;
  rightBumper: boolean;
  back: boolean;
  start: boolean;
  leftThumb: boolean;
  rightThumb: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  guide: boolean;
}

/**
 * Liga o controle virtual. Idempotente.
 *
 * Atenção ao efeito colateral: com ele ligado o Windows expõe DOIS controles
 * (o físico e o virtual), e jogos que leem os dois recebem entrada duplicada.
 * Esconder o físico exige o HidHide, que é outro driver.
 */
export const attachVirtualPad = () => invoke<void>("virtual_pad_attach");

export const detachVirtualPad = () => invoke<void>("virtual_pad_detach");

export const isVirtualPadAttached = () => invoke<boolean>("virtual_pad_is_attached");

export const updateVirtualPad = (state: PadState) =>
  invoke<void>("virtual_pad_update", { state });

// ── Quando a emulação pode ser ligada ───────────────────────────────────────

/**
 * Existe o motor que lê o controle físico, aplica o perfil e alimenta o pad
 * virtual enquanto o JOGO está em foco?
 *
 * Sim: `pad_engine` (Rust) lê o controle por XInput, esconde o físico do jogo pelo HidHide e
 * alimenta o Xbox 360 virtual (XInput, DualShock 4 e DualSense). Começa ao iniciar um jogo cujo perfil tem `emulateXinput` e
 * termina quando o jogo fecha.
 */
export const EMULATION_ENGINE_READY = true;

export interface PadEngineStatus {
  running: boolean;
  physicalSlot: number | null;
  /** De onde vem a leitura. */
  physicalSource: "xinput" | "dualshock4" | "dualsense" | null;
  physicalHidden: boolean;
}

/**
 * Liga a emulação para o jogo que vai abrir, se o perfil efetivo pedir. Devolve a mensagem de
 * erro quando não deu (o jogo abre assim mesmo, só sem emulação) e `null` quando deu certo ou
 * não era necessário.
 */
export async function startEmulationForGame(uid: string, gameId: string): Promise<string | null> {
  try {
    const { settings } = await resolveControllerProfile(uid, gameId);
    if (!settings.emulateXinput) return null;
    await invoke<void>("pad_engine_start", { settings });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Desliga a emulação e devolve o controle físico. Seguro de chamar sem ela ligada. */
export const stopEmulation = () => invoke<void>("pad_engine_stop");

export const getPadEngineStatus = () => invoke<PadEngineStatus>("pad_engine_status");

export type EmulationBlock = "unknown" | "vigem" | "hidhide" | "engine";

/** Por que a emulação não pode ser ligada agora (ou `null` se pode). */
export function emulationBlock(
  drivers: ControllerDriverStatus | null,
  engineReady: boolean = EMULATION_ENGINE_READY,
): EmulationBlock | null {
  // Primeiro o que a pessoa consegue resolver sozinha (instalar driver).
  if (!drivers) return "unknown";
  if (!drivers.vigem.installed) return "vigem";
  if (!drivers.hidHide.installed) return "hidhide";
  if (!engineReady) return "engine";
  return null;
}

export const EMULATION_BLOCK_HINT: Record<EmulationBlock, string> = {
  unknown: "Disponível apenas no aplicativo desktop.",
  vigem: "Precisa do ViGEmBus instalado.",
  hidhide: "Precisa do HidHide instalado.",
  engine: "O motor de emulação não está disponível nesta versão.",
};
