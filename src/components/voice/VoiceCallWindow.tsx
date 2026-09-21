import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Scan,
  Scaling,
  PictureInPicture2,
  Minimize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MonitorOff,
  PhoneOff,
} from "lucide-react";
import type { SocialFriend, UserProfile, VoiceCallSession, CallState } from "../../types/domain";
import type { CallRoomConfig } from "../../types/voice-governance";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { ChannelInviteModal } from "./ChannelInviteModal";
import { CallPrivacyPanel } from "./CallPrivacyPanel";
import { CreateChannelModal } from "./CreateChannelModal";

// Modular Presentation Components
import { CallHeader } from "./call-window/CallHeader";
import { CallStage } from "./call-window/CallStage";
import { ParticipantFilmstrip } from "./call-window/ParticipantFilmstrip";
import { CallControlDock } from "./call-window/CallControlDock";
import { CallSettingsPopover } from "./call-window/CallSettingsPopover";
import { VideoRenderer } from "./call-window/VideoRenderer";
import { OrbloomCustomizerModal } from "./call-window/OrbloomCustomizerModal";

export type CallFeedId =
  | "remote-screen"
  | "remote-camera"
  | "remote-user"
  | "local-screen"
  | "local-camera"
  | "local-user"
  | string;

export interface CallFeed {
  id: CallFeedId;
  peerId?: string;
  type: "video" | "voice";
  stream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  title: string;
  subtitle?: string;
  tag?: string;
  avatar?: string | null;
  color?: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isScreen?: boolean;
  isCamera?: boolean;
  isRinging?: boolean;
  isConnecting?: boolean;
  isDisconnected?: boolean;
}

interface VoiceCallWindowProps {
  isOpen: boolean;
  onClose: () => void;
  session: VoiceCallSession | null;
  userProfile: UserProfile | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  localCameraStream?: MediaStream | null;
  localScreenStream?: MediaStream | null;
  duration: number;
  callState?: CallState;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  isSpeakingRemote: boolean;
  isRemoteMuted?: boolean;
  isRemoteDeafened?: boolean;
  isCameraOn?: boolean;
  isRemoteCameraOn?: boolean;
  isSharingScreen: boolean;
  isRemoteSharingScreen: boolean;
  remoteVolume?: number;
  onChangeRemoteVolume?: (val: number) => void;
  peerVolumes?: Record<string, number>;
  onSetPeerVolume?: (peerId: string, val: number) => void;
  isReconnecting?: boolean;
  inputMode?: "voice-activity" | "push-to-talk";
  setInputMode?: (mode: "voice-activity" | "push-to-talk") => void;
  pushToTalkKey?: string;
  setPushToTalkKey?: (key: string) => void;
  isPttPressed?: boolean;
  isMicMonitoring?: boolean;
  onChangeMicMonitoring?: (val: boolean) => void;
  audioInputDevices?: MediaDeviceInfo[];
  audioOutputDevices?: MediaDeviceInfo[];
  videoInputDevices?: MediaDeviceInfo[];
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  selectedVideoInput?: string;
  onChangeAudioInputDevice?: (deviceId: string) => void;
  onChangeAudioOutputDevice?: (deviceId: string) => void;
  onChangeVideoInputDevice?: (deviceId: string) => void;
  voiceSensitivity?: number;
  onChangeVoiceSensitivity?: (val: number) => void;
  echoCancellation?: boolean;
  onChangeEchoCancellation?: (val: boolean) => void;
  noiseSuppression?: boolean;
  onChangeNoiseSuppression?: (val: boolean) => void;
  advancedNoiseSuppression?: boolean;
  onChangeAdvancedNoiseSuppression?: (val: boolean) => void;
  autoGainControl?: boolean;
  onChangeAutoGainControl?: (val: boolean) => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onHangUp?: () => void;
  onKickParticipant?: (targetUserId: string) => void;
  onUpdateRoomPrivacy?: (isPrivate: boolean, password?: string) => Promise<void> | void;
  onUpdateRoomAppearance?: (config: CallRoomConfig) => Promise<void> | void;
  onEndCallForEveryone?: () => void;
  socialFriends?: SocialFriend[];
  roomConfig?: CallRoomConfig | null;
  notify?: (msg: string, type: "success" | "error" | "info") => void;
  remoteSpeakingStates?: Map<string, boolean>;
  remoteStreams?: Map<string, MediaStream>;
  remoteScreenStreams?: Map<string, MediaStream>;
  remoteStatesMap?: Map<string, any>;
  micGain?: number;
  onChangeMicGain?: (val: number) => void;
  noiseGateEnabled?: boolean;
  onChangeNoiseGateEnabled?: (val: boolean) => void;
  onCalibrateNoise?: () => Promise<any>;
  isCalibratingNoise?: boolean;
  currentNoiseFloor?: number;
}

export const VoiceCallWindow: React.FC<VoiceCallWindowProps> = ({
  isOpen,
  onClose,
  session,
  userProfile,
  remoteStream,
  localStream,
  localCameraStream,
  localScreenStream,
  duration,
  callState,
  isMuted,
  isDeafened,
  isSpeakingLocal,
  isSpeakingRemote,
  isRemoteMuted = false,
  isRemoteDeafened = false,
  isCameraOn = false,
  isRemoteCameraOn = false,
  isSharingScreen,
  isRemoteSharingScreen,
  remoteVolume = 100,
  onChangeRemoteVolume,
  peerVolumes = {},
  onSetPeerVolume,
  isReconnecting = false,
  inputMode = "voice-activity",
  setInputMode,
  pushToTalkKey = "F8",
  setPushToTalkKey,
  isPttPressed = false,
  isMicMonitoring = false,
  onChangeMicMonitoring,
  audioInputDevices = [],
  audioOutputDevices = [],
  videoInputDevices = [],
  selectedAudioInput = "default",
  selectedAudioOutput = "default",
  selectedVideoInput = "default",
  onChangeAudioInputDevice,
  onChangeAudioOutputDevice,
  onChangeVideoInputDevice,
  voiceSensitivity = 35,
  onChangeVoiceSensitivity,
  echoCancellation = true,
  onChangeEchoCancellation,
  noiseSuppression = true,
  onChangeNoiseSuppression,
  advancedNoiseSuppression = true,
  onChangeAdvancedNoiseSuppression,
  autoGainControl = true,
  onChangeAutoGainControl,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onKickParticipant,
  onHangUp,
  socialFriends = [],
  roomConfig,
  onUpdateRoomPrivacy,
  onUpdateRoomAppearance,
  notify = () => { },
  remoteSpeakingStates,
  remoteStreams,
  remoteScreenStreams,
  remoteStatesMap,
  micGain,
  onChangeMicGain,
  onCalibrateNoise,
  isCalibratingNoise,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeVideoElRef = useRef<HTMLVideoElement | null>(null);

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isEditAppearanceModalOpen, setIsEditAppearanceModalOpen] = useState(false);
  const [isOrbloomModalOpen, setIsOrbloomModalOpen] = useState(false);

  // Focus & View state
  const [isStreamFocused, setIsStreamFocused] = useState(true);
  const [devMockParticipants, setDevMockParticipants] = useState<CallFeed[]>([]);
  const [focusedFeedId, setFocusedFeedId] = useState<CallFeedId | null>(null);
  const [videoFitMode, setVideoFitMode] = useState<"contain" | "cover">("contain");
  const [isStreamFullscreen, setIsStreamFullscreen] = useState(false);
  const [showControlsInStreamFullscreen, setShowControlsInStreamFullscreen] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Live mic RMS VU meter level for settings popover
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    feed: CallFeed;
  } | null>(null);
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
  const [locallyMutedFeeds, setLocallyMutedFeeds] = useState<Record<string, boolean>>({});
  const [watchedStreams, setWatchedStreams] = useState<Record<string, boolean>>({
    "local-screen": true,
    "local-camera": true,
  });

  const handleStreamMouseMove = () => {
    setShowControlsInStreamFullscreen(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControlsInStreamFullscreen(false);
    }, 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreamFullscreen) {
        setIsStreamFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreamFullscreen]);

  // Sync native Electron fullscreen state on mount
  useEffect(() => {
    if (window.electronAPI?.isFullScreen) {
      void window.electronAPI.isFullScreen().then((full) => {
        setIsFullscreen(Boolean(full));
      });
    }
  }, [isOpen]);

  // Micro-animação de desconexão: fecha a janela com fade/scale antes de
  // chamar hangUp (que zera a session e impediria o AnimatePresence de sair).
  const DISCONNECT_EXIT_MS = 420;
  const beginDisconnect = React.useCallback(() => {
    if (isDisconnecting || !onHangUp) return;
    setIsDisconnecting(true);
    window.setTimeout(() => {
      onHangUp();
    }, DISCONNECT_EXIT_MS);
  }, [isDisconnecting, onHangUp]);

  useEffect(() => {
    if (isOpen) setIsDisconnecting(false);
  }, [isOpen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsStreamFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Auto-Focus when remote user starts sharing screen
  const prevRemoteSharingRef = useRef(isRemoteSharingScreen);
  useEffect(() => {
    if (!prevRemoteSharingRef.current && isRemoteSharingScreen) {
      setFocusedFeedId("remote-screen");
      setIsStreamFocused(true);
    } else if (prevRemoteSharingRef.current && !isRemoteSharingScreen) {
      if (focusedFeedId === "remote-screen") {
        setFocusedFeedId(null);
        setIsStreamFocused(false);
      }
    }
    prevRemoteSharingRef.current = isRemoteSharingScreen;
  }, [isRemoteSharingScreen, focusedFeedId]);

  // Auto-focus the local screen as soon as Transmitir starts, so the tile
  // "Focar tela" is not the only way to enter the stage.
  const prevLocalSharingRef = useRef(isSharingScreen);
  useEffect(() => {
    if (!prevLocalSharingRef.current && isSharingScreen) {
      setFocusedFeedId("local-screen");
      setIsStreamFocused(true);
    } else if (prevLocalSharingRef.current && !isSharingScreen) {
      if (focusedFeedId === "local-screen") {
        setFocusedFeedId(null);
        setIsStreamFocused(false);
      }
    }
    prevLocalSharingRef.current = isSharingScreen;
  }, [isSharingScreen, focusedFeedId]);

  // Clear focus when focused feed turns off
  useEffect(() => {
    if (focusedFeedId === "local-screen" && !isSharingScreen) {
      setFocusedFeedId(null);
    }
    if (focusedFeedId === "remote-screen" && !isRemoteSharingScreen) {
      setFocusedFeedId(null);
    }
  }, [focusedFeedId, isRemoteSharingScreen, isSharingScreen]);

  // Live Microphone Test Level inside Settings
  useEffect(() => {
    if (!isSettingsOpen || !localStream) {
      setMicVolumeLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let animId: number | null = null;
    let isCancelled = false;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        source = ctx.createMediaStreamSource(localStream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (isCancelled || !analyser) return;
          analyser.getFloatTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            sumSquares += data[i] * data[i];
          }
          const rms = Math.sqrt(sumSquares / data.length);
          const level = Math.min(100, Math.round(rms * 700));
          setMicVolumeLevel(level);
          animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
      }
    } catch (e) {
      console.warn("[VoiceCallWindow] Mic test analyser error:", e);
    }

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try {
          source.disconnect();
        } catch { }
      }
      if (analyser) {
        try {
          analyser.disconnect();
        } catch { }
      }
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => { });
      }
      setMicVolumeLevel(0);
    };
  }, [isSettingsOpen, localStream]);

  // Active feeds computation
  const activeFeeds: CallFeed[] = useMemo(() => {
    if (!session) return [];
    const feeds: CallFeed[] = [];

    const isRoom = Boolean(
      session.roomName || (session.participants && session.participants.length > 0)
    );
    const isRingingOut = callState === "ringing-out";
    const isConnecting = callState === "connecting";

    if (isRoom) {
      const activeUids = new Set<string>();
      (session.participants || []).forEach((p) => {
        if (p.uid && p.uid !== userProfile?.uid) activeUids.add(p.uid);
      });
      if (remoteStreams && remoteStreams instanceof Map) {
        remoteStreams.forEach((stream, peerId) => {
          if (
            peerId &&
            peerId !== userProfile?.uid &&
            peerId !== "local-user" &&
            stream &&
            stream.active
          ) {
            activeUids.add(peerId);
          }
        });
      }
      if (remoteScreenStreams && remoteScreenStreams instanceof Map) {
        remoteScreenStreams.forEach((stream, peerId) => {
          if (
            peerId &&
            peerId !== userProfile?.uid &&
            peerId !== "local-user" &&
            stream &&
            stream.active
          ) {
            activeUids.add(peerId);
          }
        });
      }

      const participantList = Array.from(activeUids).map((uid) => {
        const explicit = (session.participants || []).find((p) => p.uid === uid);
        const social = socialFriends?.find(
          (f) => f.id === uid || f.id === `cp-friend:${uid}`
        );
        return {
          uid,
          name:
            explicit?.name ||
            social?.name ||
            (uid === session.friendUid ? session.friendName : `Jogador ${uid.slice(0, 4)}`),
          avatar:
            explicit?.avatar ||
            social?.avatar ||
            (uid === session.friendUid ? session.friendAvatar : undefined),
          color:
            (explicit as any)?.themeColor ||
            (social as any)?.themeColor ||
            (uid === session.adminId ? session.themeColor : undefined),
        };
      });

      participantList.forEach((p) => {
        const stream =
          remoteStreams?.get(p.uid) ||
          (p.uid === session.friendUid ? remoteStream : null);
        const screenStream = remoteScreenStreams?.get(p.uid) || null;
        const isSpeaking = remoteSpeakingStates?.get(p.uid) ?? false;
        const remoteState = remoteStatesMap?.get(p.uid);
        const peerSharingScreen = Boolean(remoteState?.isSharingScreen || screenStream);

        feeds.push({
          id: `remote-user:${p.uid}`,
          peerId: p.uid,
          type: "voice",
          title: p.name,
          subtitle: isRingingOut
            ? "Chamando…"
            : isConnecting
              ? "Conectando…"
              : isSpeaking
                ? "Falando…"
                : "Conectado",
          avatar: p.avatar,
          color: p.color,
          stream,
          cameraStream: remoteState?.isCameraOn ? stream : null,
          isLocal: false,
          isSpeaking,
          isMuted: remoteState?.isMuted ?? false,
          isDeafened: remoteState?.isDeafened ?? false,
          isCamera: remoteState?.isCameraOn ?? false,
          isRinging: isRingingOut,
          isConnecting: isConnecting,
        });

        if (peerSharingScreen && screenStream) {
          feeds.push({
            id: `remote-screen:${p.uid}`,
            peerId: p.uid,
            type: "video",
            stream: screenStream,
            title: `Tela de ${p.name}`,
            subtitle: "Transmissão de Tela",
            tag: "AO VIVO",
            isLocal: false,
            isSpeaking,
            isMuted: remoteState?.isMuted ?? false,
            isDeafened: remoteState?.isDeafened ?? false,
            isScreen: true,
          });
        }
      });
    } else if (session.friendUid && session.friendUid !== userProfile?.uid) {
      // 1:1 call
      const oneToOneScreen =
        remoteScreenStreams?.get(session.friendUid) ||
        (isRemoteSharingScreen ? remoteStream : null);
      feeds.push({
        id: "remote-user",
        peerId: session.friendUid,
        type: "voice",
        title: session.friendName,
        subtitle: isRingingOut
          ? "Chamando…"
          : isConnecting
            ? "Conectando…"
            : isSpeakingRemote
              ? "Falando…"
              : "Conectado",
        avatar: session.friendAvatar,
        color: session.themeColor,
        cameraStream: isRemoteCameraOn ? remoteStream : null,
        isLocal: false,
        isSpeaking: isSpeakingRemote,
        isMuted: isRemoteMuted,
        isDeafened: isRemoteDeafened,
        isCamera: isRemoteCameraOn,
        isRinging: isRingingOut,
        isConnecting: isConnecting,
      });

      if (isRemoteSharingScreen && oneToOneScreen) {
        feeds.push({
          id: "remote-screen",
          peerId: session.friendUid,
          type: "video",
          stream: oneToOneScreen,
          title: `Tela de ${session.friendName}`,
          subtitle: "Transmissão de Tela",
          tag: "AO VIVO",
          isLocal: false,
          isSpeaking: isSpeakingRemote,
          isMuted: isRemoteMuted,
          isDeafened: isRemoteDeafened,
          isScreen: true,
        });
      }
    }

    // Remote Screen Share Feed (room-level fallback when peer-specific feeds were not added)
    if (
      isRemoteSharingScreen &&
      remoteStream &&
      !feeds.some((f) => f.isScreen && !f.isLocal)
    ) {
      feeds.push({
        id: "remote-screen",
        peerId: session.friendUid,
        type: "video",
        stream: remoteStream,
        title: isRoom ? "Transmissão da Sala" : `Tela de ${session.friendName}`,
        subtitle: "Transmissão de Tela",
        tag: "AO VIVO",
        isLocal: false,
        isSpeaking: isSpeakingRemote,
        isMuted: isRemoteMuted,
        isDeafened: isRemoteDeafened,
        isScreen: true,
      });
    }

    // Local Screen Share Feed
    if (isSharingScreen && localScreenStream) {
      feeds.push({
        id: "local-screen",
        type: "video",
        stream: localScreenStream,
        title: "Sua Transmissão",
        subtitle: "Visualização da sua tela",
        tag: "AO VIVO • VOCÊ",
        isLocal: true,
        isSpeaking: isSpeakingLocal,
        isMuted,
        isDeafened,
        isScreen: true,
      });
    }

    // Local Participant Voice Card
    feeds.push({
      id: "local-user",
      peerId: userProfile?.uid,
      type: "voice",
      title: userProfile?.displayName || "Você",
      subtitle: isConnecting
        ? "Conectando…"
        : isSpeakingLocal
          ? "Falando…"
          : "Conectado",
      avatar: userProfile?.photoURL,
      color: (userProfile as any)?.themeColor || (session.adminId === userProfile?.uid ? session.themeColor : undefined),
      cameraStream: isCameraOn ? localCameraStream : null,
      isLocal: true,
      isSpeaking: isSpeakingLocal,
      isMuted,
      isDeafened,
      isCamera: isCameraOn,
      isConnecting,
    });

    // Injetar participantes do modo Dev (respeitando limite de 10 pessoas no total)
    if (devMockParticipants.length > 0) {
      const currentPeopleCount = feeds.filter((f) => !f.isScreen).length;
      const slotsLeft = Math.max(0, 10 - currentPeopleCount);
      devMockParticipants.slice(0, slotsLeft).forEach((mock) => {
        feeds.push(mock);
      });
    }

    return feeds;
  }, [
    session,
    callState,
    devMockParticipants,
    isRemoteSharingScreen,
    remoteStream,
    remoteStreams,
    remoteScreenStreams,
    remoteStatesMap,
    remoteSpeakingStates,
    isSpeakingRemote,
    isRemoteMuted,
    isRemoteDeafened,
    isRemoteCameraOn,
    isSharingScreen,
    localScreenStream,
    isSpeakingLocal,
    isMuted,
    isDeafened,
    isCameraOn,
    localCameraStream,
    userProfile?.displayName,
    userProfile?.photoURL,
    userProfile?.uid,
    socialFriends,
  ]);

  const remoteParticipantsCount = activeFeeds.filter(
    (f) => !f.isLocal && !f.isScreen && !f.isRinging && !f.isConnecting
  ).length;
  const isOnlyOnePerson = remoteParticipantsCount === 0;

  // Toggle Feed focus
  const handleSelectFeed = (feedId: string) => {
    if (focusedFeedId === feedId && isStreamFocused) {
      setFocusedFeedId(null);
      setIsStreamFocused(false);
      return;
    }
    setFocusedFeedId(feedId);
    setIsStreamFocused(true);
    setWatchedStreams((prev) => ({ ...prev, [feedId]: true }));
  };

  const handleFeedContextMenu = (e: React.MouseEvent, feed: CallFeed) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      feed,
    });
  };

  const handleTogglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (!document.pictureInPictureEnabled) {
        notify?.("Picture-in-picture não é suportado neste WebView.", "info");
        return;
      }
      if (!activeVideoElRef.current) {
        notify?.("Nenhum vídeo disponível para o mini-player.", "info");
        return;
      }
      await activeVideoElRef.current.requestPictureInPicture();
    } catch (err) {
      console.warn("[VoiceCallWindow] PiP failed:", err);
      notify?.("Não foi possível abrir o mini-player.", "info");
    }
  };

  const handleRequestStreamFullscreen = async () => {
    const el = activeVideoElRef.current || containerRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsStreamFullscreen(false);
        return;
      }
      if (el && typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
        return;
      }
      if (window.electronAPI?.toggleFullScreen) {
        const isFull = await window.electronAPI.toggleFullScreen();
        setIsFullscreen(Boolean(isFull));
        return;
      }
      notify?.("Tela cheia não disponível neste WebView.", "info");
    } catch (err) {
      console.warn("[VoiceCallWindow] Fullscreen failed:", err);
      notify?.("Não foi possível entrar em tela cheia.", "info");
    }
  };

  const toggleFullscreen = async () => {
    if (window.electronAPI?.toggleFullScreen) {
      const isFull = await window.electronAPI.toggleFullScreen();
      setIsFullscreen(Boolean(isFull));
      return;
    }
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isDevMode = Boolean(
    import.meta.env.DEV ||
    session?.chatId === "test-echo-session" ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
  );

  const handleAddDevMockParticipant = () => {
    const currentPeople = activeFeeds.filter((f) => !f.isScreen).length;
    if (currentPeople >= 10) {
      notify?.("Limite de 10 participantes atingido", "info");
      return;
    }
    const DEV_MOCKS = [
      { name: "Lucas", color: "#22D3EE" },
      { name: "Beatriz", color: "#EC4899" },
      { name: "Rafael", color: "#10B981" },
      { name: "Matheus", color: "#3B82F6" },
      { name: "Camila", color: "#F59E0B" },
      { name: "Felipe", color: "#8B5CF6" },
      { name: "Larissa", color: "#84CC16" },
      { name: "Thiago", color: "#F97316" },
      { name: "Sofia", color: "#06B6D4" },
    ];
    const existingTitles = new Set(activeFeeds.map((f) => f.title));
    const nextMock = DEV_MOCKS.find((m) => !existingTitles.has(m.name)) || {
      name: `Jogador ${devMockParticipants.length + 2}`,
      color: "#A855F7",
    };
    const mockId = `dev-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMockFeed: CallFeed = {
      id: mockId,
      peerId: mockId,
      type: "voice",
      title: nextMock.name,
      subtitle: "Conectado",
      color: nextMock.color,
      isLocal: false,
      isSpeaking: false,
      isMuted: false,
      isDeafened: false,
    };
    setDevMockParticipants((prev) => [...prev, newMockFeed]);
    notify?.(`Participante ${nextMock.name} adicionado (${currentPeople + 1}/10)`, "success");
  };

  const handleRemoveDevMockParticipant = () => {
    if (devMockParticipants.length === 0) return;
    const removed = devMockParticipants[devMockParticipants.length - 1];
    setDevMockParticipants((prev) => prev.slice(0, -1));
    notify?.(`Participante ${removed.title} removido`, "info");
  };

  if (!session) return null;

  const isRoomSession = Boolean(
    session.roomName || (session.participants && session.participants.length > 0)
  );
  const canEditRoom = Boolean(
    session.adminId === userProfile?.uid ||
    roomConfig?.adminId === userProfile?.uid ||
    !session.adminId
  );

  const focusedFeed = activeFeeds.find((f) => f.id === focusedFeedId) || null;

  return (
    <AnimatePresence>
      {isOpen && !isDisconnecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-9 inset-x-0 bottom-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-2xl select-none"
        >
          {/* Main Call Window Container — Apple minimalist, solid surface bg-[#0F0F0F]/80 with border #161616 */}
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.96, opacity: 0, y: 18, filter: "blur(6px)" }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ scale: 0.94, opacity: 0, y: 28, filter: "blur(8px)" }}
            transition={{ type: "spring", bounce: 0.12, duration: 0.42 }}
            style={{
              cornerShape: "squircle",
            } as React.CSSProperties}
            className="relative flex flex-col w-full max-w-6xl h-[88vh] overflow-hidden rounded-[28px] bg-[#0F0F0F] border border-[#161616] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            {/* AREA 1: HEADER */}
            <CallHeader
              session={session}
              callState={callState}
              duration={duration}
              participantsCount={activeFeeds.filter((f) => !f.isScreen).length}
              isReconnecting={isReconnecting}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
              onClose={onClose}
              onOpenInvite={() => setIsInviteModalOpen(true)}
              onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
              onOpenAppearance={() => setIsEditAppearanceModalOpen(true)}
              canEditRoom={canEditRoom}
              roomConfig={roomConfig}
              isDevMode={isDevMode}
              onAddDevMockParticipant={handleAddDevMockParticipant}
              onRemoveDevMockParticipant={handleRemoveDevMockParticipant}
            />

            {/* AREA 2: MAIN STAGE */}
            <main className="relative flex-1 w-full min-h-0 overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center">
              <CallStage
                feeds={activeFeeds}
                focusedFeedId={focusedFeedId}
                videoFitMode={videoFitMode}
                onToggleFitMode={() =>
                  setVideoFitMode((prev) => (prev === "contain" ? "cover" : "contain"))
                }
                onTogglePip={() => void handleTogglePip()}
                onRequestFullscreen={() => void handleRequestStreamFullscreen()}
                onSelectFeed={handleSelectFeed}
                isStreamFocused={isStreamFocused}
                onToggleStreamFocus={() => setIsStreamFocused((prev) => !prev)}
                onOpenInvite={() => setIsInviteModalOpen(true)}
                streamerVolume={remoteVolume}
                onChangeStreamerVolume={onChangeRemoteVolume}
                localScreenStream={localScreenStream}
                notify={notify}
                localStream={localStream}
                remoteStream={remoteStream}
                callState={callState}
                onContextMenu={handleFeedContextMenu}
                activeMenuFeedId={contextMenu?.isOpen ? contextMenu.feed.id : null}
                onVideoElement={(el) => {
                  activeVideoElRef.current = el;
                }}
              />
            </main>

            {/* AREA 3: PARTICIPANT FILMSTRIP */}
            {isStreamFocused && focusedFeedId && (
              <AnimatePresence>
                <motion.div
                  key="filmstrip"
                  initial={{ opacity: 0, height: 0, y: 8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: 8 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden shrink-0"
                >
                  <ParticipantFilmstrip
                    feeds={activeFeeds}
                    focusedFeedId={focusedFeedId}
                    onSelectFeed={handleSelectFeed}
                    onContextMenu={handleFeedContextMenu}
                    onShowAll={() => {
                      setFocusedFeedId(null);
                      setIsStreamFocused(false);
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            )}

            {/* AREA 4: CONTROL DOCK (Floating bottom center) */}
            <footer className="relative w-full pb-4 flex items-center justify-center z-30 shrink-0">
              <CallControlDock
                isMuted={isMuted}
                isDeafened={isDeafened}
                isCameraOn={isCameraOn}
                isSharingScreen={isSharingScreen}
                isSettingsOpen={isSettingsOpen}
                isOnlyOnePerson={isOnlyOnePerson}
                onToggleMute={onToggleMute}
                onToggleDeafen={onToggleDeafen}
                onToggleCamera={onToggleCamera}
                onToggleScreenShare={onToggleScreenShare}
                onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
                onOpenInvite={() => setIsInviteModalOpen(true)}
                onOpenOrbloomCustomizer={() => setIsOrbloomModalOpen(true)}
                onHangUp={beginDisconnect}
              />
            </footer>

            {/* Context Menu for Participants */}
            {contextMenu && contextMenu.isOpen && (
              <ParticipantContextMenu
                feed={{
                  ...contextMenu.feed,
                  isScreenLiveAvailable: contextMenu.feed.id === "remote-screen",
                  isCurrentlyWatched: Boolean(watchedStreams[contextMenu.feed.id]),
                }}
                x={contextMenu.x}
                y={contextMenu.y}
                volume={(() => {
                  if (contextMenu.feed.isLocal) return 100;
                  const feedId = contextMenu.feed.id;
                  if (userVolumes[feedId] !== undefined) return userVolumes[feedId];
                  if (peerVolumes[feedId] !== undefined) return peerVolumes[feedId];
                  const rawId = feedId
                    .replace(/^remote-user:/, "")
                    .replace(/^remote-screen:/, "");
                  if (peerVolumes[rawId] !== undefined) return peerVolumes[rawId];
                  return remoteVolume ?? 100;
                })()}
                isLocallyMuted={locallyMutedFeeds[contextMenu.feed.id]}
                isLocalAdmin={Boolean(
                  isRoomSession &&
                  (session?.adminId === userProfile?.uid ||
                    roomConfig?.adminId === userProfile?.uid ||
                    (!session?.adminId && !session?.friendUid))
                )}
                onVolumeChange={(newVol) => {
                  setUserVolumes((prev) => ({
                    ...prev,
                    [contextMenu.feed.id]: newVol,
                  }));
                  const rawPeerId = contextMenu.feed.id.startsWith("remote-screen:")
                    ? `screen:${contextMenu.feed.id.replace("remote-screen:", "")}`
                    : contextMenu.feed.id === "remote-screen"
                      ? "remote-screen"
                      : contextMenu.feed.id.startsWith("remote-user:")
                        ? contextMenu.feed.id.replace("remote-user:", "")
                        : contextMenu.feed.id;

                  if (onSetPeerVolume) {
                    onSetPeerVolume(rawPeerId, newVol);
                    onSetPeerVolume(contextMenu.feed.id, newVol);
                    if (contextMenu.feed.id === "remote-user" && session?.friendUid) {
                      onSetPeerVolume(session.friendUid, newVol);
                    }
                  }
                  if (
                    !contextMenu.feed.isLocal &&
                    onChangeRemoteVolume &&
                    (contextMenu.feed.id === "remote-user" || !contextMenu.feed.id.includes(":"))
                  ) {
                    onChangeRemoteVolume(newVol);
                  }
                }}
                onToggleLocalMute={() => {
                  const nextMuted = !locallyMutedFeeds[contextMenu.feed.id];
                  setLocallyMutedFeeds((prev) => ({
                    ...prev,
                    [contextMenu.feed.id]: nextMuted,
                  }));
                  const rawPeerId = contextMenu.feed.id.startsWith("remote-screen:")
                    ? `screen:${contextMenu.feed.id.replace("remote-screen:", "")}`
                    : contextMenu.feed.id === "remote-screen"
                      ? "remote-screen"
                      : contextMenu.feed.id.startsWith("remote-user:")
                        ? contextMenu.feed.id.replace("remote-user:", "")
                        : contextMenu.feed.id;
                  const currVol =
                    userVolumes[contextMenu.feed.id] ??
                    (contextMenu.feed.isLocal ? 100 : remoteVolume ?? 100);
                  if (onSetPeerVolume) {
                    onSetPeerVolume(rawPeerId, nextMuted ? 0 : currVol);
                    onSetPeerVolume(contextMenu.feed.id, nextMuted ? 0 : currVol);
                  }
                }}
                onToggleWatchStream={() => {
                  const nextState = !watchedStreams[contextMenu.feed.id];
                  setWatchedStreams((prev) => ({
                    ...prev,
                    [contextMenu.feed.id]: nextState,
                  }));
                  if (nextState) {
                    handleSelectFeed(contextMenu.feed.id);
                  }
                }}
                onKickParticipant={(targetUserId) => {
                  if (onKickParticipant) {
                    onKickParticipant(targetUserId);
                  }
                }}
                onClose={() => setContextMenu(null)}
              />
            )}

            {/* Audio & Video Settings Popover */}
            <CallSettingsPopover
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              onOpenOrbloomCustomizer={() => setIsOrbloomModalOpen(true)}
              audioInputDevices={audioInputDevices}
              audioOutputDevices={audioOutputDevices}
              videoInputDevices={videoInputDevices}
              selectedAudioInput={selectedAudioInput}
              selectedAudioOutput={selectedAudioOutput}
              selectedVideoInput={selectedVideoInput}
              onChangeAudioInputDevice={onChangeAudioInputDevice}
              onChangeAudioOutputDevice={onChangeAudioOutputDevice}
              onChangeVideoInputDevice={onChangeVideoInputDevice}
              micVolumeLevel={micVolumeLevel}
              isMicMonitoring={isMicMonitoring}
              onChangeMicMonitoring={onChangeMicMonitoring}
              micGain={micGain}
              onChangeMicGain={onChangeMicGain}
              echoCancellation={echoCancellation}
              onChangeEchoCancellation={onChangeEchoCancellation}
              noiseSuppression={noiseSuppression}
              onChangeNoiseSuppression={onChangeNoiseSuppression}
              advancedNoiseSuppression={advancedNoiseSuppression}
              onChangeAdvancedNoiseSuppression={onChangeAdvancedNoiseSuppression}
              autoGainControl={autoGainControl}
              onChangeAutoGainControl={onChangeAutoGainControl}
              onCalibrateNoise={onCalibrateNoise}
              isCalibratingNoise={isCalibratingNoise}
              voiceSensitivity={voiceSensitivity}
              onChangeVoiceSensitivity={onChangeVoiceSensitivity}
              inputMode={inputMode}
              setInputMode={setInputMode}
              pushToTalkKey={pushToTalkKey}
              setPushToTalkKey={setPushToTalkKey}
              isRecordingKey={isRecordingKey}
              setIsRecordingKey={setIsRecordingKey}
            />

            {/* Modal de Personalização do Orbloom */}
            <OrbloomCustomizerModal
              isOpen={isOrbloomModalOpen}
              onClose={() => setIsOrbloomModalOpen(false)}
              localStream={localStream}
            />

            {/* Invite Friends Modal */}
            <ChannelInviteModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              session={session}
              userProfile={userProfile}
              friends={socialFriends}
              notify={notify}
            />

            {/* Call Privacy Modal */}
            <CallPrivacyPanel
              isOpen={isPrivacyModalOpen}
              onClose={() => setIsPrivacyModalOpen(false)}
              isPrivate={Boolean(session?.isPrivate || roomConfig?.isPrivate)}
              currentPassword={session?.password || roomConfig?.password || ""}
              currentCategory={session?.category || roomConfig?.category}
              onSavePrivacy={(isPriv, pwd) => {
                if (onUpdateRoomPrivacy) {
                  return onUpdateRoomPrivacy(isPriv, pwd);
                }
              }}
            />

            {/* Edit Appearance Modal */}
            {isEditAppearanceModalOpen && (
              <CreateChannelModal
                isOpen={isEditAppearanceModalOpen}
                onClose={() => setIsEditAppearanceModalOpen(false)}
                userProfile={userProfile}
                isEditing={true}
                initialConfig={{
                  roomName:
                    session?.roomName || roomConfig?.roomName || session?.friendName,
                  category:
                    session?.category || roomConfig?.category || "resenha_games",
                  icon: session?.icon || roomConfig?.icon || "🎮",
                  avatarUrl: session?.avatarUrl || roomConfig?.avatarUrl,
                  themeColor: session?.themeColor || roomConfig?.themeColor || "#8B5CF6",
                  isPrivate: Boolean(session?.isPrivate || roomConfig?.isPrivate),
                  password: session?.password || roomConfig?.password,
                }}
                onCreateChannel={(updatedConfig) => {
                  void onUpdateRoomAppearance?.(updatedConfig);
                  setIsEditAppearanceModalOpen(false);
                }}
              />
            )}
          </motion.div>

          {/* Dedicated Cinematic Stream Fullscreen Mode */}
          {isStreamFullscreen &&
            focusedFeed &&
            ((focusedFeed.type === "video" && focusedFeed.stream) ||
              focusedFeed.cameraStream) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseMove={handleStreamMouseMove}
                className="fixed inset-0 z-100000 bg-black flex items-center justify-center select-none"
              >
                <div
                  onDoubleClick={() => setIsStreamFullscreen(false)}
                  className="relative w-full h-full flex items-center justify-center cursor-default"
                >
                  <VideoRenderer
                    stream={focusedFeed.stream || focusedFeed.cameraStream!}
                    fitMode={videoFitMode}
                    muted={focusedFeed.isLocal}
                    onVideoElement={(el) => {
                      activeVideoElRef.current = el;
                    }}
                  />
                </div>

                {/* Floating Top Bar Header */}
                <AnimatePresence>
                  {showControlsInStreamFullscreen && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto z-20"
                    >
                      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm font-semibold text-white">
                          {focusedFeed.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl">
                        <button
                          type="button"
                          onClick={() => void handleTogglePip()}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
                          title="Mini-player flutuante (PiP)"
                        >
                          <PictureInPicture2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Floating Bottom Control Bar */}
                <AnimatePresence>
                  {showControlsInStreamFullscreen && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 p-2 rounded-2xl bg-black/85 border border-white/15 backdrop-blur-2xl shadow-2xl pointer-events-auto z-20"
                    >
                      <button
                        type="button"
                        onClick={onToggleMute}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition cursor-pointer ${isMuted
                          ? "bg-[#FF2B55] text-white shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
                      >
                        {isMuted ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={onToggleDeafen}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition cursor-pointer ${isDeafened
                          ? "bg-[#FF2B55] text-white shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        title={isDeafened ? "Reativar áudio" : "Desativar áudio"}
                      >
                        {isDeafened ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
                      </button>

                      {focusedFeed.isLocal && (
                        <button
                          type="button"
                          onClick={onToggleScreenShare}
                          className="flex h-11 items-center gap-2 px-4 rounded-xl bg-white text-black text-xs font-semibold shadow-lg hover:bg-white/90 cursor-pointer"
                        >
                          <MonitorOff className="h-4 w-4" />
                          <span>Parar Transmissão</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={beginDisconnect}
                        className="flex h-11 items-center gap-2 px-5 rounded-xl bg-[#FF2B55] text-white text-xs font-semibold shadow-lg hover:bg-[#FF1A45] cursor-pointer"
                      >
                        <PhoneOff className="h-4 w-4" />
                        <span>Desconectar</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
