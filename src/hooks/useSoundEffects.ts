import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

import phelieriumSelectSound from "../sounds/Phelierium Default/ui_select.wav";
import phelieriumClickSound from "../sounds/Phelierium Default/ui_click.wav";
import phelieriumAlertSound from "../sounds/Phelierium Default/ui_alert.wav";
import phelieriumNotificationSound from "../sounds/Phelierium Default/ui_notification.wav";
import phelieriumFriendshipSound from "../sounds/Phelierium Default/ui_friendship_incomming.wav";
import phelieriumOpenDetailSound from "../sounds/Phelierium Default/ui_open_game_detail.mp3";
import phelieriumCloseDetailSound from "../sounds/Phelierium Default/ui_close_game_detail.mp3";
import phelieriumEditSound from "../sounds/Phelierium Default/ui_edit_game.wav";
import phelieriumDeepSelectSound from "../sounds/Phelierium Default/ui_deep_selection.mp3";
import phelieriumAchievementSound from "../sounds/Phelierium Default/Achievment_Unlock.mp3";
import phelieriumAchievementGoldSound from "../sounds/Phelierium Default/Achievment_Unlock_Gold.mp3";
import phelieriumAchievementPlatinumSound from "../sounds/Phelierium Default/Achievment_Unlock_Platinum.mp3";
import phelieriumUiAchievementSound from "../sounds/Phelierium Default/ui_achievment.mp3";
import phelieriumScreenshotSound from "../sounds/Phelierium Default/37. Take Screenshot Psfx Take Screen.mp3";
import phelieriumCallEnterSound from "../sounds/Phelierium Default/ui_call_enter.mp3";
import phelieriumGameStartSound from "../sounds/Phelierium Default/ui_game_start.wav";
import phelieriumNewChatMessageSound from "../sounds/Phelierium Default/ui_new_chat_message.mp3";

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
import ps2ActivationSound from "../sounds/PS2 System Sounds/deck_ui_default_activation.wav";
import ps2BackSound from "../sounds/PS2 System Sounds/deck_ui_out_of_game_detail.wav";
import ps2EditModalSound from "../sounds/PS2 System Sounds/deck_ui_hide_modal.wav";
import ps2FavoriteOnSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_on.wav";
import ps2FavoriteOffSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_off.wav";
import ps2AchievementSound from "../sounds/PS2 System Sounds/deck_ui_achievement_toast.wav";
import ps2LaunchGameSound from "../sounds/PS2 System Sounds/deck_ui_launch_game.wav";
import ps2ShowModalSound from "../sounds/PS2 System Sounds/deck_ui_show_modal.wav";
import ps2DetailOpenSound from "../sounds/PS2 System Sounds/deck_ui_into_game_detail.wav";
import ps2ToastSound from "../sounds/PS2 System Sounds/deck_ui_toast.wav";

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
    navigate: phelieriumClickSound,
    hover: phelieriumSelectSound,
    select: phelieriumSelectSound,
    back: phelieriumCloseDetailSound,
    edit: phelieriumEditSound,
    modalClose: phelieriumCloseDetailSound,
    favoriteOn: phelieriumClickSound,
    favoriteOff: phelieriumClickSound,
    delete: phelieriumAlertSound,
    play: phelieriumGameStartSound,
    boot: phelieriumGameStartSound,
    search: phelieriumSelectSound,
    detailOpen: phelieriumOpenDetailSound,
    friendRequest: phelieriumFriendshipSound,
    chatSent: phelieriumNewChatMessageSound,
    chatReceived: phelieriumNewChatMessageSound,
    notification: phelieriumNotificationSound,
    callEnter: phelieriumCallEnterSound,
    switchOn: phelieriumClickSound,
    switchOff: phelieriumClickSound,
    screenshot: phelieriumScreenshotSound,
    showModal: phelieriumDeepSelectSound,
    overlayAchievement: phelieriumAchievementSound,
    overlayAchievementGold: phelieriumAchievementGoldSound,
    overlayAchievementPlatinum: phelieriumAchievementPlatinumSound,
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
  ps2: {
    navigate: ps2NavigateSound,
    hover: ps2HoverSound,
    select: ps2ActivationSound,
    back: ps2BackSound,
    edit: ps2EditModalSound,
    modalClose: ps2BackSound,
    favoriteOn: ps2FavoriteOnSound,
    favoriteOff: ps2FavoriteOffSound,
    delete: ps2BackSound,
    play: ps2LaunchGameSound,
    boot: ps2LaunchGameSound,
    search: ps2ShowModalSound,
    detailOpen: ps2DetailOpenSound,
    friendRequest: ps2ToastSound,
    chatSent: ps2ActivationSound,
    chatReceived: ps2ToastSound,
    notification: ps2ToastSound,
    callEnter: ps2DetailOpenSound,
    switchOn: ps2FavoriteOnSound,
    switchOff: ps2FavoriteOffSound,
    screenshot: ps2ToastSound,
    showModal: ps2ShowModalSound,
    overlayAchievement: ps2AchievementSound,
    overlayAchievementGold: ps2AchievementSound,
    overlayAchievementPlatinum: ps2AchievementSound,
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

export type SoundEffectType = keyof (typeof soundThemes)["ps5"];

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
]);

const isGenericClickSoundType = (type: SoundEffectType) => genericClickSoundTypes.has(type);
const isTransitionSoundType = (type: SoundEffectType) => transitionSoundTypes.has(type);

const TRANSITION_SUPPRESSION_WINDOW_MS = 220;
const GENERIC_CLICK_HOLD_MS = 40;

let lastTransitionSoundAt = 0;
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

  const sounds = soundThemes[theme] ?? soundThemes.default;
  const soundPaths = useMemo(() => sounds, [sounds]);

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
      const targetVolume = Math.max(0, Math.min(1, baseVolume * Math.max(0, Math.min(1, volumeMultiplier))));
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
    [notificationVolume, soundPaths, volume],
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
