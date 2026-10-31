import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

import phelieriumToastSound from "../sounds/Phelierium Default/Desktop Toast Short.mp3";
import phelieriumChatNotificationSound from "../sounds/Phelierium Default/Steam Chatroom Notification.mp3";
import phelieriumAchievementSound from "../sounds/Phelierium Default/Achievment_Unlock.mp3";
import phelieriumAchievementGoldSound from "../sounds/Phelierium Default/Achievment_Unlock_Gold.mp3";
import phelieriumAchievementPlatinumSound from "../sounds/Phelierium Default/Achievment_Unlock_Platinum.mp3";
import phelieriumScreenshotSound from "../sounds/Phelierium Default/37. Take Screenshot Psfx Take Screen.mp3";
import phelieriumCallEnterSound from "../sounds/Phelierium Default/Recording Start.mp3";


// Tema padrão: os sons "Deck UI" do pacote Phelierium Default (a pasta traz outros sons próprios,
// usados em chat, amizade, notificação, chamada, captura e conquistas).
import deckNavigateSound from "../sounds/Phelierium Default/Deck UI Navigation.mp3";
import deckActivationSound from "../sounds/Phelierium Default/Deck UI Default Activation.mp3";
import deckOutOfDetailSound from "../sounds/Phelierium Default/Deck UI Out Of Game Detail.mp3";
import deckMiscSound from "../sounds/Phelierium Default/Deck UI Misc 10.mp3";
import deckHideModalSound from "../sounds/Phelierium Default/Deck UI Hide Modal.mp3";
import deckSwitchOnSound from "../sounds/Phelierium Default/Deck UI Switch Toggle On.mp3";
import deckSwitchOffSound from "../sounds/Phelierium Default/Deck UI Switch Toggle Off.mp3";
import deckLaunchGameSound from "../sounds/Phelierium Default/Deck UI Launch Game.mp3";
import deckBumperSound from "../sounds/Phelierium Default/Deck UI Bumper End 02.mp3";
import deckTabSound from "../sounds/Phelierium Default/Deck UI Tab Transition 01.mp3";
import deckFlyInSound from "../sounds/Phelierium Default/Deck UI Side Menu Fly In.mp3";
import deckFlyOutSound from "../sounds/Phelierium Default/Deck UI Side Menu Fly Out.mp3";
import deckIntoDetailSound from "../sounds/Phelierium Default/Deck UI Into Game Detail.mp3";
import deckTypingSound from "../sounds/Phelierium Default/Deck UI Typing.mp3";
import deckShowModalSound from "../sounds/Phelierium Default/Deck UI Show Modal.mp3";

import ps5PlusNavigateSound from "../sounds/PS5_Plus/deck_ui_navigation.wav";
import ps5PlusHoverSound from "../sounds/PS5_Plus/deck_ui_slider_down.wav";
import ps5PlusActivationSound from "../sounds/PS5_Plus/deck_ui_default_activation.wav";
import ps5PlusHideModalSound from "../sounds/PS5_Plus/deck_ui_hide_modal.wav";
import ps5PlusSwitchOnSound from "../sounds/PS5_Plus/deck_ui_switch_toggle_on.wav";
import ps5PlusSwitchOffSound from "../sounds/PS5_Plus/deck_ui_switch_toggle_off.wav";
import ps5PlusOutOfGameDetailSound from "../sounds/PS5_Plus/deck_ui_out_of_game_detail.wav";
import ps5PlusLaunchGameSound from "../sounds/PS5_Plus/deck_ui_launch_game.wav";
import ps5PlusShowModalSound from "../sounds/PS5_Plus/deck_ui_show_modal.wav";
import ps5PlusIntoGameDetailSound from "../sounds/PS5_Plus/deck_ui_into_game_detail.wav";
import ps5PlusMessageToastSound from "../sounds/PS5_Plus/deck_ui_message_toast.wav";
import ps5PlusToastSound from "../sounds/PS5_Plus/deck_ui_toast.wav";
import ps5AchievementUnlockSound from "../sounds/PS5_Plus/deck_ui_achievement_toast.wav";
import ps5AchievementPlatinumSound from "../sounds/PS5_Plus/ps5-trophy-platinum.mp3";

import ps4NavigateSound from "../sounds/PS4/deck_ui_navigation.wav";
import ps4ShowModalSound from "../sounds/PS4/deck_ui_show_modal.wav";
import ps4ReturnSound from "../sounds/PS4/deck_ui_side_menu_fly_out.wav";
import ps4FlyInSound from "../sounds/PS4/deck_ui_side_menu_fly_in.wav";
import ps4OutOfGameDetailSound from "../sounds/PS4/deck_ui_out_of_game_detail.wav";
import ps4LaunchGameSound from "../sounds/PS4/deck_ui_launch_game.wav";
import ps4IntoGameDetailSound from "../sounds/PS4/deck_ui_into_game_detail.wav";
import ps4ToastSound from "../sounds/PS4/deck_ui_toast.wav";
import ps4AchievementSound from "../sounds/PS4/21. Src27 Se Msg Trophy.mp3";
import ps4FriendRequestSound from "../sounds/PS4/02. Src1 Se Morpheus Noti.mp3";

import pspNavigateSound from "../sounds/PSP Sounds/deck_ui_navigation.wav";
import pspHoverSound from "../sounds/PSP Sounds/deck_ui_slider_down.wav";
import pspPositiveSound from "../sounds/PSP Sounds/confirmation_positive.wav";
import pspHideModalSound from "../sounds/PSP Sounds/deck_ui_hide_modal.wav";
import pspSwitchOnSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_on.wav";
import pspSwitchOffSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_off.wav";
import pspOutOfGameDetailSound from "../sounds/PSP Sounds/deck_ui_out_of_game_detail.wav";
import pspLaunchGameSound from "../sounds/PSP Sounds/deck_ui_launch_game.wav";
import pspShowModalSound from "../sounds/PSP Sounds/deck_ui_show_modal.wav";
import pspIntoGameDetailSound from "../sounds/PSP Sounds/deck_ui_into_game_detail.wav";
import pspToastSound from "../sounds/PSP Sounds/deck_ui_toast.wav";
import pspAchievementToastSound from "../sounds/PSP Sounds/deck_ui_achievement_toast.wav";

import xbNavigateSound from "../sounds/Xbox One/deck_ui_navigation.wav";
import xbHoverSound from "../sounds/Xbox One/deck_ui_slider_down.wav";
import xbActivationSound from "../sounds/Xbox One/deck_ui_default_activation.wav";
import xbBackSound from "../sounds/Xbox One/deck_ui_out_of_game_detail.wav";
import xbEditModalSound from "../sounds/Xbox One/deck_ui_hide_modal.wav";
import xbFavoriteOnSound from "../sounds/Xbox One/deck_ui_slider_up.wav";
import xbFavoriteOffSound from "../sounds/Xbox One/deck_ui_slider_down.wav";
import xbDetailOpenSound from "../sounds/Xbox One/deck_ui_into_game_detail.wav";
import xbLaunchGameSound from "../sounds/Xbox One/deck_ui_launch_game.wav";
import xbShowModalSound from "../sounds/Xbox One/deck_ui_show_modal.wav";
import xbToastSound from "../sounds/Xbox One/deck_ui_toast.wav";
import xbAchievementSound from "../sounds/Xbox One/deck_ui_achievement_toast.wav";
import xbAchievementPlatinumSound from "../sounds/Xbox One/xbox-one-rare-achievement.mp3";
import xbFriendJoinSound from "../sounds/Xbox One/ui_steam_smoother_friend_online.m4a";
import xbChatReceivedSound from "../sounds/Xbox One/steam_at_mention.m4a";

import cyberpunkNavigateSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_navigation.wav";
import cyberpunkHoverSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_slider_down.wav";
import cyberpunkActivationSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_default_activation.wav";
import cyberpunkHideModalSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_hide_modal.wav";
import cyberpunkSwitchOnSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_switch_toggle_on.wav";
import cyberpunkSwitchOffSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_switch_toggle_off.wav";
import cyberpunkOutOfGameDetailSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_out_of_game_detail.wav";
import cyberpunkLaunchGameSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_launch_game.wav";
import cyberpunkShowModalSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_show_modal.wav";
import cyberpunkIntoGameDetailSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_into_game_detail.wav";
import cyberpunkToastSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_toast.wav";
import cyberpunkAchievementToastSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_achievement_toast.wav";

import ps2NavigateSound from "../sounds/PS2 System Sounds/deck_ui_navigation.wav";
import ps2HoverSound from "../sounds/PS2 System Sounds/deck_ui_misc_10.wav";
import ps2ActivationSound from "../sounds/PS2 System Sounds/deck_ui_tab_transition_01.wav";
import ps2BackSound from "../sounds/PS2 System Sounds/deck_ui_out_of_game_detail.wav";
import ps2EditModalSound from "../sounds/PS2 System Sounds/deck_ui_hide_modal.wav";
import ps2FavoriteOnSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_on.wav";
import ps2FavoriteOffSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_off.wav";
import ps2AchievementSound from "../sounds/PS2 System Sounds/deck_ui_achievement_toast.wav";
import ps2LaunchGameSound from "../sounds/PS2 System Sounds/deck_ui_launch_game.wav";
import ps2ShowModalSound from "../sounds/PS2 System Sounds/deck_ui_show_modal.wav";
import ps2DetailOpenSound from "../sounds/PS2 System Sounds/deck_ui_into_game_detail.wav";
import ps2ToastSound from "../sounds/PS2 System Sounds/deck_ui_toast.wav";
import ps2FlyInSound from "../sounds/PS2 System Sounds/deck_ui_side_menu_fly_in.wav";
import ps2FlyOutSound from "../sounds/PS2 System Sounds/deck_ui_side_menu_fly_out.wav";
import ps2VolumeSound from "../sounds/PS2 System Sounds/deck_ui_volume.wav";

import gcNavigateSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_navigation.wav";
import gcHoverSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_slider_down.wav";
import gcActivationSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_default_activation.wav";
import gcFlyOutSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_out.wav";
import gcEditModalSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_hide_modal.wav";
import gcFavoriteSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_misc_10.wav";
import gcDetailOpenSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_in.wav";
import gcOpenPhotosSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_into_game_detail.wav";
import gcClosePhotosSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_out_of_game_detail.wav";
import gcLaunchGameSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_launch_game.wav";
import gcShowModalSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_show_modal.wav";

export const soundThemes = {
  default: {
    // seleção de jogos (D-pad / setas); o clique de menu (Ajustes) usa o "Navigation"
    navigate: deckMiscSound,
    // o tema padrão não tem som de hover: vazio = silêncio (o notch também fica sem o "reveal")
    hover: "",
    select: deckActivationSound,
    back: deckOutOfDetailSound,
    edit: deckFlyOutSound,
    modalClose: deckHideModalSound,
    favoriteOn: deckSwitchOnSound,
    favoriteOff: deckSwitchOffSound,
    delete: deckFlyOutSound,
    play: deckLaunchGameSound,
    boot: deckBumperSound,
    search: deckTabSound,
    detailOpen: deckIntoDetailSound,
    friendRequest: phelieriumToastSound,
    chatSent: deckNavigateSound,
    chatReceived: phelieriumChatNotificationSound,
    notification: phelieriumToastSound,
    callEnter: phelieriumCallEnterSound,
    switchOn: deckSwitchOnSound,
    switchOff: deckSwitchOffSound,
    screenshot: phelieriumScreenshotSound,
    showModal: deckShowModalSound,
    overlayAchievement: phelieriumAchievementSound,
    overlayAchievementGold: phelieriumAchievementGoldSound,
    overlayAchievementPlatinum: phelieriumAchievementPlatinumSound,
    // papéis de navegação (os outros temas herdam um equivalente: ver THEME_FALLBACK_ROLES)
    menuClick: deckNavigateSound,
    tabSwitch: deckTabSound,
    edgeBump: deckBumperSound,
    sidebarOpen: deckFlyInSound,
    sidebarClose: deckFlyOutSound,
    keyTyping: deckTypingSound,
  },
  ps5: {
    navigate: ps5PlusNavigateSound,
    hover: ps5PlusHoverSound,
    select: ps5PlusActivationSound,
    back: ps5PlusOutOfGameDetailSound,
    edit: ps5PlusHideModalSound,
    modalClose: ps5PlusOutOfGameDetailSound,
    favoriteOn: ps5PlusSwitchOnSound,
    favoriteOff: ps5PlusSwitchOffSound,
    delete: ps5PlusOutOfGameDetailSound,
    play: ps5PlusLaunchGameSound,
    boot: ps5PlusLaunchGameSound,
    search: ps5PlusShowModalSound,
    detailOpen: ps5PlusIntoGameDetailSound,
    friendRequest: ps5PlusMessageToastSound,
    chatSent: ps5PlusActivationSound,
    chatReceived: ps5PlusMessageToastSound,
    notification: ps5PlusMessageToastSound,
    callEnter: ps5PlusShowModalSound,
    switchOn: ps5PlusSwitchOnSound,
    switchOff: ps5PlusSwitchOffSound,
    screenshot: phelieriumScreenshotSound,
    showModal: ps5PlusShowModalSound,
    overlayAchievement: ps5AchievementUnlockSound,
    overlayAchievementGold: ps5AchievementUnlockSound,
    overlayAchievementPlatinum: ps5AchievementPlatinumSound,
  },
  ps4: {
    navigate: ps4NavigateSound,
    hover: ps4NavigateSound,
    select: ps4ShowModalSound,
    back: ps4OutOfGameDetailSound,
    edit: ps4FlyInSound,
    modalClose: ps4OutOfGameDetailSound,
    favoriteOn: ps4FlyInSound,
    favoriteOff: ps4ReturnSound,
    delete: ps4OutOfGameDetailSound,
    play: ps4LaunchGameSound,
    boot: ps4LaunchGameSound,
    search: ps4ShowModalSound,
    detailOpen: ps4IntoGameDetailSound,
    friendRequest: ps4FriendRequestSound,
    chatSent: ps4ShowModalSound,
    chatReceived: ps4ToastSound,
    notification: ps4ToastSound,
    callEnter: ps4ShowModalSound,
    switchOn: ps4FlyInSound,
    switchOff: ps4ReturnSound,
    screenshot: ps4ToastSound,
    showModal: ps4ShowModalSound,
    overlayAchievement: ps4AchievementSound,
    overlayAchievementGold: ps4AchievementSound,
    overlayAchievementPlatinum: ps4AchievementSound,
  },
  psp: {
    navigate: pspNavigateSound,
    hover: pspHoverSound,
    select: pspPositiveSound,
    back: pspOutOfGameDetailSound,
    edit: pspHideModalSound,
    modalClose: pspOutOfGameDetailSound,
    favoriteOn: pspSwitchOnSound,
    favoriteOff: pspSwitchOffSound,
    delete: pspOutOfGameDetailSound,
    play: pspLaunchGameSound,
    boot: pspLaunchGameSound,
    search: pspShowModalSound,
    detailOpen: pspIntoGameDetailSound,
    friendRequest: pspToastSound,
    chatSent: pspPositiveSound,
    chatReceived: pspToastSound,
    notification: pspToastSound,
    callEnter: pspPositiveSound,
    switchOn: pspSwitchOnSound,
    switchOff: pspSwitchOffSound,
    screenshot: pspToastSound,
    showModal: pspShowModalSound,
    overlayAchievement: pspAchievementToastSound,
    overlayAchievementGold: pspAchievementToastSound,
    overlayAchievementPlatinum: pspAchievementToastSound,
  },
  xbox360: {
    navigate: xbNavigateSound,
    hover: xbHoverSound,
    select: xbActivationSound,
    back: xbBackSound,
    edit: xbEditModalSound,
    modalClose: xbBackSound,
    favoriteOn: xbFavoriteOnSound,
    favoriteOff: xbFavoriteOffSound,
    delete: xbBackSound,
    play: xbLaunchGameSound,
    boot: xbLaunchGameSound,
    search: xbShowModalSound,
    detailOpen: xbDetailOpenSound,
    friendRequest: xbFriendJoinSound,
    chatSent: xbActivationSound,
    chatReceived: xbChatReceivedSound,
    notification: xbToastSound,
    callEnter: xbFriendJoinSound,
    switchOn: xbFavoriteOnSound,
    switchOff: xbFavoriteOffSound,
    screenshot: xbToastSound,
    showModal: xbShowModalSound,
    overlayAchievement: xbAchievementSound,
    overlayAchievementGold: xbAchievementSound,
    overlayAchievementPlatinum: xbAchievementPlatinumSound,
  },
  cyberpunk: {
    navigate: cyberpunkNavigateSound,
    hover: cyberpunkHoverSound,
    select: cyberpunkActivationSound,
    back: cyberpunkOutOfGameDetailSound,
    edit: cyberpunkHideModalSound,
    modalClose: cyberpunkOutOfGameDetailSound,
    favoriteOn: cyberpunkSwitchOnSound,
    favoriteOff: cyberpunkSwitchOffSound,
    delete: cyberpunkOutOfGameDetailSound,
    play: cyberpunkLaunchGameSound,
    boot: cyberpunkLaunchGameSound,
    search: cyberpunkShowModalSound,
    detailOpen: cyberpunkIntoGameDetailSound,
    friendRequest: cyberpunkToastSound,
    chatSent: cyberpunkActivationSound,
    chatReceived: cyberpunkToastSound,
    notification: cyberpunkToastSound,
    callEnter: cyberpunkShowModalSound,
    switchOn: cyberpunkSwitchOnSound,
    switchOff: cyberpunkSwitchOffSound,
    screenshot: cyberpunkToastSound,
    showModal: cyberpunkShowModalSound,
    overlayAchievement: cyberpunkAchievementToastSound,
    overlayAchievementGold: cyberpunkAchievementToastSound,
    overlayAchievementPlatinum: cyberpunkAchievementToastSound,
  },
  // PS2: o pacote tem 15 sons e cada um tem um papel (durações medidas em `ps2SoundPack.test.ts`).
  // Curtos (< 0,8 s): misc_10 (toque do cursor), tab_transition_01 (clique suave), switch on/off,
  // launch_game, volume (estalo). Longos, com cauda de eco (1,7–2,8 s): navigation, show/hide_modal,
  // into/out_of_game_detail, side_menu_fly_in/out (abrir/fechar), toast, achievement_toast.
  ps2: {
    navigate: ps2NavigateSound, // mover a seleção
    hover: ps2HoverSound, // passar o mouse: o mais curto e discreto
    select: ps2ActivationSound, // confirmar (clique)
    back: ps2BackSound, // voltar / cancelar
    edit: ps2ActivationSound, // ação de menu de contexto: um clique curto (o modal abre com o seu próprio som)
    modalClose: ps2EditModalSound, // fechar modal: hide_modal, par de show_modal
    favoriteOn: ps2FavoriteOnSound,
    favoriteOff: ps2FavoriteOffSound,
    delete: ps2BackSound, // descartar: o mesmo tom descendente do cancelar
    play: ps2LaunchGameSound,
    boot: ps2LaunchGameSound,
    search: ps2ActivationSound, // abrir a busca: curto, sem a cauda de 2 s do modal
    detailOpen: ps2DetailOpenSound,
    friendRequest: ps2ToastSound,
    chatSent: ps2ActivationSound,
    chatReceived: ps2ToastSound,
    notification: ps2ToastSound,
    callEnter: ps2DetailOpenSound,
    switchOn: ps2FavoriteOnSound,
    switchOff: ps2FavoriteOffSound,
    screenshot: ps2VolumeSound, // estalo seco e alto, como um obturador
    showModal: ps2ShowModalSound,
    overlayAchievement: ps2AchievementSound,
    overlayAchievementGold: ps2AchievementSound,
    overlayAchievementPlatinum: ps2AchievementSound,
    // papéis de navegação que o pacote cobre com arquivo próprio (sem a cauda longa do fallback)
    menuClick: ps2ActivationSound,
    tabSwitch: ps2ActivationSound,
    edgeBump: ps2HoverSound,
    sidebarOpen: ps2FlyInSound,
    sidebarClose: ps2FlyOutSound,
    keyTyping: ps2HoverSound,
  },
  gamecube: {
    navigate: gcNavigateSound,
    hover: gcHoverSound,
    select: gcActivationSound,
    back: gcFlyOutSound,
    edit: gcEditModalSound,
    modalClose: gcFlyOutSound,
    favoriteOn: gcFavoriteSound,
    favoriteOff: gcFavoriteSound,
    delete: gcClosePhotosSound,
    play: gcLaunchGameSound,
    boot: gcLaunchGameSound,
    search: gcShowModalSound,
    detailOpen: gcDetailOpenSound,
    friendRequest: gcShowModalSound,
    chatSent: gcFavoriteSound,
    chatReceived: gcShowModalSound,
    notification: gcShowModalSound,
    callEnter: gcDetailOpenSound,
    switchOn: gcOpenPhotosSound,
    switchOff: gcClosePhotosSound,
    screenshot: gcShowModalSound,
    showModal: gcShowModalSound,
    overlayAchievement: gcLaunchGameSound,
    overlayAchievementGold: gcLaunchGameSound,
    overlayAchievementPlatinum: gcLaunchGameSound,
  },
};

export type SoundEffectType = keyof (typeof soundThemes)["default"];

/**
 * Papéis de navegação que só o tema padrão tem arquivo próprio. Nos outros temas cada um toca o
 * efeito equivalente que o pacote já traz.
 */
const THEME_FALLBACK_ROLES: Partial<Record<SoundEffectType, SoundEffectType>> = {
  menuClick: "select",
  tabSwitch: "navigate",
  edgeBump: "navigate",
  sidebarOpen: "showModal",
  sidebarClose: "modalClose",
  keyTyping: "navigate",
};

/** Todos os efeitos do tema, completando com o equivalente os papéis que o pacote não tem. */
export function resolveThemeSounds(theme: string | undefined): Record<SoundEffectType, string> {
  const packs = soundThemes as Record<string, Partial<Record<SoundEffectType, string>>>;
  const pack = packs[theme ?? "default"] ?? packs.default;
  const resolved: Partial<Record<SoundEffectType, string>> = { ...pack };
  for (const [role, fallback] of Object.entries(THEME_FALLBACK_ROLES) as [SoundEffectType, SoundEffectType][]) {
    resolved[role] ??= resolved[fallback] ?? packs.default[role];
  }
  return resolved as Record<SoundEffectType, string>;
}

/**
 * Ganho por tema e por efeito, aplicado por cima do volume do usuário. Serve para nivelar um
 * arquivo que é bem mais alto que o resto do pacote. Hoje nenhum tema precisa de ajuste.
 */
const SOUND_TYPE_GAIN: Partial<Record<SoundTheme, Partial<Record<SoundEffectType, number>>>> = {};

export const soundTypeGain = (theme: string | undefined, type: SoundEffectType): number =>
  SOUND_TYPE_GAIN[(theme ?? "default") as SoundTheme]?.[type] ?? 1;

// ─── Tipos de som que são notificações ─────────────────────────────────────────
const notificationSoundTypes = new Set<SoundEffectType>([
  "friendRequest",
  "chatReceived",
  "chatSent",
  "notification",
  "callEnter",
]);

const isNotificationSoundType = (type: SoundEffectType) =>
  notificationSoundTypes.has(type);

// ─── Tipos de som que nunca devem ser descartados quando a janela perde foco ─────
// (ex: início de jogo quando o executável rouba o foco da tela ou conquistas desbloqueadas)
const alwaysAllowedSoundTypes = new Set<SoundEffectType>([
  "play",
  "boot",
  "overlayAchievement",
  "overlayAchievementGold",
  "overlayAchievementPlatinum",
  "friendRequest",
  "chatReceived",
  "chatSent",
  "notification",
  "callEnter",
]);

const isAlwaysAllowedSoundType = (type: SoundEffectType) =>
  alwaysAllowedSoundTypes.has(type);

// ─── Anti-cacofonia: clique genérico vs. som de transição (abrir/fechar) ───────
// Vários componentes tocam seu próprio som ao abrir/fechar (modal, detalhe do
// jogo, contexto, etc.). Se o clique que disparou essa transição também tocar
// seu próprio "tec" genérico, os dois sons se sobrepõem e ficam poluídos.
// Regra: sons de transição sempre têm prioridade; um som de clique genérico é
// adiado por um instante e cancelado se uma transição disparar logo em
// seguida (ex: abrir um modal), e também é ignorado se uma transição acabou
// de tocar há pouco (ex: fechar algo e o foco mudar para o próximo item).
// "hover" fica de fora de propósito: é um som ambiente de passagem do mouse,
// não uma ação que costuma abrir/fechar algo, então toca sempre na hora.
const genericClickSoundTypes = new Set<SoundEffectType>([
  "navigate",
  "select",
  "favoriteOn",
  "favoriteOff",
  "switchOn",
  "switchOff",
]);

const transitionSoundTypes = new Set<SoundEffectType>([
  "showModal",
  "detailOpen",
  "modalClose",
  "back",
  "search",
  "delete",
  "edit",
  "sidebarOpen",
  "sidebarClose",
]);

const isGenericClickSoundType = (type: SoundEffectType) => genericClickSoundTypes.has(type);
const isTransitionSoundType = (type: SoundEffectType) => transitionSoundTypes.has(type);

const TRANSITION_SUPPRESSION_WINDOW_MS = 220;
const GENERIC_CLICK_HOLD_MS = 40;

let lastTransitionSoundAt = 0;
const lastModalSoundAt = new Map<SoundEffectType, number>();
const MODAL_SOUND_DEDUPE_MS = 120;
let lastEdgeBumpAt = 0;
// um toque na borda por vez: o analógico segurado (ou com drift) repete o aperto a cada ~80 ms
const EDGE_BUMP_MIN_MS = 800;
let pendingGenericClickToken = 0;

// ─── Motor de Áudio Web Audio API (Latência Zero & Zero Bugs de Promise) ──────
let globalAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    void globalAudioCtx.resume().catch(() => { });
  }
  return globalAudioCtx;
};

// Cache de buffers decodificados em memória
const audioBufferCache = new Map<string, AudioBuffer>();
const AUDIO_BUFFER_CACHE_MAX = 50;
const pendingFetches = new Map<string, Promise<AudioBuffer | null>>();
const preloadedUrls = new Set<string>();

const loadAudioBuffer = async (url: string): Promise<AudioBuffer | null> => {
  if (audioBufferCache.has(url)) return audioBufferCache.get(url)!;
  if (pendingFetches.has(url)) return pendingFetches.get(url)!;

  const fetchPromise = (async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return null;
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      audioBufferCache.set(url, decoded);
      if (audioBufferCache.size > AUDIO_BUFFER_CACHE_MAX) {
        const oldestKey = audioBufferCache.keys().next().value;
        if (oldestKey !== undefined) audioBufferCache.delete(oldestKey);
      }
      return decoded;
    } catch {
      return null;
    } finally {
      pendingFetches.delete(url);
    }
  })();

  pendingFetches.set(url, fetchPromise);
  return fetchPromise;
};

// Fallback HTML5 Audio Pool (caso WebAudio falhe)
const htmlAudioPool = new Map<string, HTMLAudioElement[]>();
const getHtmlAudio = (path: string, volume: number): HTMLAudioElement => {
  const pool = htmlAudioPool.get(path) ?? [];
  let audio = pool.find((a) => a.paused || a.ended);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = "auto";
    if (pool.length < 5) pool.push(audio);
    htmlAudioPool.set(path, pool);
  }
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.currentTime = 0;
  return audio;
};

// Desbloqueia o AudioContext no primeiro gesto do usuário
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (globalAudioCtx && globalAudioCtx.state === "suspended") {
      void globalAudioCtx.resume().catch(() => { });
    }
  };
  window.addEventListener("pointerdown", unlockAudio, { capture: true, once: true });
  window.addEventListener("keydown", unlockAudio, { capture: true, once: true });
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export const useSoundEffects = (
  volume = 0.35,
  theme: SoundTheme = "default",
  notificationVolume = 0.4,
) => {
  const lastNavigateAtRef = useRef(0);
  const lastHoverAtRef = useRef(0);
  const activeAudiosRef = useRef<Set<HTMLAudioElement>>(new Set());

  const soundPaths = useMemo(() => resolveThemeSounds(theme), [theme]);

  // Pré-carrega buffers de áudio na memória (once per URL across all hook instances)
  useEffect(() => {
    const paths = Array.from(new Set(Object.values(soundPaths)));
    paths.forEach((url) => {
      if (!preloadedUrls.has(url)) {
        preloadedUrls.add(url);
        void loadAudioBuffer(url);
      }
    });
  }, [soundPaths]);

  // Silencia efeitos sonoros ativos comuns quando a janela perde o foco,
  // mas preserva sons críticos que continuam tocando quando um jogo é iniciado (play/boot)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBlur = () => {
      const remainingAudios = new Set<HTMLAudioElement>();
      activeAudiosRef.current.forEach((audio) => {
        if ((audio as any)._keepOnBlur) {
          remainingAudios.add(audio);
        } else {
          try {
            audio.pause();
          } catch { }
        }
      });
      activeAudiosRef.current = remainingAudios;
    };
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const playSoundNow = useCallback(
    (type: SoundEffectType, volumeMultiplier = 1) => {
      const path = soundPaths[type];
      if (!path) return;

      const isNotification = isNotificationSoundType(type);
      const isAlwaysAllowed = isAlwaysAllowedSoundType(type);
      if (
        typeof document !== "undefined" &&
        !isAlwaysAllowed &&
        !document.hasFocus()
      ) {
        return;
      }

      const baseVolume = isNotification ? notificationVolume : volume;
      const targetVolume = Math.max(
        0,
        Math.min(1, baseVolume * soundTypeGain(theme, type) * Math.max(0, Math.min(1, volumeMultiplier))),
      );
      if (targetVolume <= 0) return;

      // Rate-limit para navegações ultra-rápidas
      const now = performance.now();
      if (type === "navigate") {
        if (lastNavigateAtRef.current > 0 && now - lastNavigateAtRef.current < 45) return;
        lastNavigateAtRef.current = now;
      }
      if (type === "hover") {
        if (lastHoverAtRef.current > 0 && now - lastHoverAtRef.current < 40) return;
        lastHoverAtRef.current = now;
      }
      // Abrir/fechar modal pode ser pedido por mais de um lugar no mesmo gesto: toca uma vez só.
      if (type === "showModal" || type === "modalClose") {
        const last = lastModalSoundAt.get(type) ?? -Infinity;
        if (now - last < MODAL_SOUND_DEDUPE_MS) return;
        lastModalSoundAt.set(type, now);
      }
      // Bater na borda repetidas vezes (D-pad segurado) não vira metralhadora.
      if (type === "edgeBump") {
        if (now - lastEdgeBumpAt < EDGE_BUMP_MIN_MS) return;
        lastEdgeBumpAt = now;
      }

      if (isTransitionSoundType(type)) {
        lastTransitionSoundAt = now;
        // Uma transição (abrir/fechar) sempre vence: invalida qualquer
        // clique genérico que ainda esteja esperando para tocar.
        pendingGenericClickToken += 1;
      }

      const ctx = getAudioContext();
      const cachedBuffer = audioBufferCache.get(path);

      if (ctx && cachedBuffer && ctx.state === "running") {
        try {
          const source = ctx.createBufferSource();
          source.buffer = cachedBuffer;

          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(targetVolume, ctx.currentTime);

          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start(0);
          return;
        } catch {
          // fallback abaixo
        }
      } else if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => { });
      }

      // Se não estava no cache ou WebAudio falhou, usa HTMLAudio fallback
      try {
        const audio = getHtmlAudio(path, targetVolume);
        (audio as any)._keepOnBlur = isAlwaysAllowed;
        if (!isNotification) {
          activeAudiosRef.current.add(audio);
        }
        const onEnded = () => {
          activeAudiosRef.current.delete(audio);
        };
        audio.addEventListener("ended", onEnded, { once: true });
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            activeAudiosRef.current.delete(audio);
          });
        }
      } catch {
        // silencioso
      }

      // Se ainda não estava em cache, tenta decodificar para o próximo toque
      if (!cachedBuffer) {
        void loadAudioBuffer(path);
      }
    },
    [notificationVolume, soundPaths, theme, volume],
  );

  const playSound = useCallback(
    (type: SoundEffectType, volumeMultiplier = 1) => {
      // Sons de transição (abrir/fechar modal, detalhe, etc.) sempre tocam
      // na hora — eles já carregam a identidade sonora da ação.
      if (!isGenericClickSoundType(type)) {
        playSoundNow(type, volumeMultiplier);
        return;
      }

      // Uma transição acabou de tocar (ex: fechou um modal e o foco pulou
      // para o próximo item) — o "tec" genérico ficaria redundante em cima
      // dela, então é descartado.
      if (performance.now() - lastTransitionSoundAt < TRANSITION_SUPPRESSION_WINDOW_MS) {
        return;
      }

      // Adia o clique genérico por um instante: se o mesmo gesto disparar
      // uma transição (ex: abrir um modal) antes desse prazo, o clique é
      // cancelado e só o som de abertura toca.
      const token = ++pendingGenericClickToken;
      window.setTimeout(() => {
        if (pendingGenericClickToken !== token) return;
        playSoundNow(type, volumeMultiplier);
      }, GENERIC_CLICK_HOLD_MS);
    },
    [playSoundNow],
  );

  return { playSound };
};
