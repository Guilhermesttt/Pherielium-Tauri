import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AuthUser } from "../auth/AuthProvider";
import {
  type CallState,
  type SocialFriend,
  type UserProfile,
  type VoiceCallSession,
  type VoiceCallParticipant,
} from "../types/domain";
export type { CallState };
import {
  type CallAnswerPayload,
  type CallEndPayload,
  type CallInvitePayload,
  type CallSignalPayload,
  type CallStatePayload,
  type CallKickPayload,
  type CallPrivacyPayload,
  type CallMemberJoinedPayload,
  type CallMemberLeftPayload,
  sendCallAnswer,
  sendCallEnd,
  sendCallInvite,
  sendCallSignal,
  sendCallState,
  sendCallKick,
  sendCallPrivacyUpdate,
  sendCallMemberJoined,
  sendCallMemberLeft,
  subscribeToCallSession,
  subscribeToUserIncomingCalls,
  addChannelStatusListener,
  type ChannelConnectionStatus,
} from "../services/voiceCall";
import type { CallRoomConfig, RoomCategory, VoiceRoomParticipant } from "../types/voice-governance";
import { getChatId } from "../services/chat";
import { getTurnServers } from "../services/turnCredentials";
import { buildProcessedAudioTrack } from "../services/audio/audioProcessing";
import { createCallAudioBarrier, type CallAudioBarrierInstance } from "../services/audio/CallAudioBarrier";
import { createVoiceRoom, joinVoiceRoom, leaveVoiceRoom } from "../services/voiceRooms";
import {
  detachScreenTracksFromPeers,
  replaceOutgoingAudioTrack,
  unpublishScreenPublications,
} from "@/services/voiceCall/voiceMediaLifecycle";
import {
  fetchLiveKitToken,
  isLiveKitCompatibleRoom,
  Room as LiveKitRoom,
  RoomEvent as LiveKitRoomEvent,
  Track as LiveKitTrack,
  VideoQuality as LiveKitVideoQuality,
  AudioPresets as LiveKitAudioPresets,
  type LocalTrackPublication,
} from "../services/livekitVoice";

const LOCAL_TEST_CHAT_IDS = new Set(["simulated_call_test", "test-echo-session"]);
const LOCAL_TEST_PEER_IDS = new Set(["echo-bot", "ghost_tester_uid"]);

const isLocalTestCall = (chatId?: string | null, friendUid?: string | null) =>
  Boolean(
    (chatId && LOCAL_TEST_CHAT_IDS.has(chatId)) ||
    (friendUid && LOCAL_TEST_PEER_IDS.has(friendUid)),
  );
import sfxJoin from "../sounds/Phelierium Default/ui_call_enter.mp3";
import sfxLeave from "../sounds/Phelierium Default/ui_leave_call.mp3";
import sfxIncomingCall from "../sounds/Phelierium Default/ui_call_incomming.wav";
import sfxRingingOut from "../sounds/Phelierium Default/ui_ringing.mp3";
import sfxMute from "../sounds/Stoat_SFX/mute-CuCJ24EB.ogg";
import sfxUnmute from "../sounds/Stoat_SFX/unmute-CxrIl-lz.ogg";
import sfxUndeafen from "../sounds/Stoat_SFX/undeafen-HBVfWE8u.ogg";
import sfxStreamStart from "../sounds/Stoat_SFX/stream_start-C5XqRk1f.ogg";
import sfxStreamEnd from "../sounds/Stoat_SFX/stream_end-CBLpDPZy.ogg";
import sfxFullMute from "../sounds/Stoat_SFX/full_mute.ogg";

const playSfx = (src: string, volume = 1.0) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => { });
  } catch {
    // ignore
  }
};

export type VoiceInputMode = "voice-activity" | "push-to-talk";

export interface ScreenShareOptions {
  sourceId?: string;
  resolution?: "720p" | "1080p" | "source";
  fps?: 30 | 60;
  withAudio?: boolean;
  callAudioBarrier?: boolean;
}

const screenShareProfile = (options: ScreenShareOptions) => {
  const fps: 30 | 60 = options.fps === 30 ? 30 : 60;
  const resolution: "720p" | "1080p" = options.resolution === "720p" ? "720p" : "1080p";
  const width = resolution === "720p" ? 1280 : 1920;
  const height = resolution === "720p" ? 720 : 1080;
  const bitrate = resolution === "720p" ? 3_500_000 : fps === 60 ? 8_000_000 : 5_000_000;
  return { fps, resolution, width, height, bitrate };
};

const screenShareVideoConstraints = (width: number, height: number, fps: number): MediaTrackConstraints => ({
  width: { ideal: width, max: width },
  height: { ideal: height, max: height },
  frameRate: { ideal: fps, max: fps },
});

const lockRemoteScreenShareQuality = (publication: { source?: unknown; setVideoQuality?: (q: typeof LiveKitVideoQuality.HIGH) => void }) => {
  if (publication.source !== LiveKitTrack.Source.ScreenShare) return;
  try {
    publication.setVideoQuality?.(LiveKitVideoQuality.HIGH);
  } catch (err) {
    console.warn("[LiveKit] Failed to lock screen-share subscribe quality:", err);
  }
};

interface AudioPipeline {
  ctx: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  silentGain: GainNode | null;
  intervalId: number | null;
  holdTimer: number | null;
}

const createEmptyPipeline = (): AudioPipeline => ({
  ctx: null,
  source: null,
  analyser: null,
  silentGain: null,
  intervalId: null,
  holdTimer: null,
});

const destroyAudioPipeline = (pipeline: AudioPipeline) => {
  if (pipeline.intervalId) {
    window.clearInterval(pipeline.intervalId);
    pipeline.intervalId = null;
  }
  if (pipeline.holdTimer) {
    window.clearTimeout(pipeline.holdTimer);
    pipeline.holdTimer = null;
  }
  if (pipeline.silentGain) {
    try {
      pipeline.silentGain.disconnect();
    } catch { }
    pipeline.silentGain = null;
  }
  if (pipeline.source) {
    try {
      pipeline.source.disconnect();
    } catch { }
    pipeline.source = null;
  }
  if (pipeline.analyser) {
    try {
      pipeline.analyser.disconnect();
    } catch { }
    pipeline.analyser = null;
  }
  if (pipeline.ctx) {
    try {
      if (pipeline.ctx.state !== "closed") {
        void pipeline.ctx.close().catch(() => { });
      }
    } catch { }
    pipeline.ctx = null;
  }
};

interface UseVoiceCallProps {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  notify: (msg: string, type: "success" | "error" | "info") => void;
}

export const useVoiceCall = ({ user, userProfile, notify }: UseVoiceCallProps) => {
  const [callState, setCallState] = useState<CallState>("idle");
  const [session, setSession] = useState<VoiceCallSession | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<CallInvitePayload | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [roomConfig, setRoomConfig] = useState<CallRoomConfig | null>(null);

  // Multi-peer Mesh streams & remote state maps
  // remoteStreams = camera + mic (primary); remoteScreenStreams = screen share video/audio per peer
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteSpeakingStates, setRemoteSpeakingStates] = useState<Map<string, boolean>>(new Map());
  const [remoteStatesMap, setRemoteStatesMap] = useState<Map<string, CallStatePayload>>(new Map());

  const [remoteVolume, setRemoteVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_remote_volume");
      return saved !== null ? Math.max(0, Math.min(200, Number(saved))) : 100;
    } catch {
      return 100;
    }
  });

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  const setPeerVolume = useCallback((peerOrFeedId: string, val: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(val)));
    setPeerVolumes((prev) => ({
      ...prev,
      [peerOrFeedId]: clamped,
    }));
  }, []);

  const setRemoteVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(val)));
    setRemoteVolumeState(clamped);
    try {
      localStorage.setItem("checkpoint_voice_remote_volume", String(clamped));
    } catch { }
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const isSpeakingRemote = Array.from(remoteSpeakingStates.values()).some(Boolean);

  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteDeafened, setIsRemoteDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(false);

  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isRemoteSharingScreen, setIsRemoteSharingScreen] = useState(false);

  const [isScreenPickerOpen, setIsScreenPickerOpen] = useState(false);
  const [isVoiceWindowOpen, setIsVoiceWindowOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [channelConnectionStatus, setChannelConnectionStatus] = useState<ChannelConnectionStatus>("idle");
  const [mediaTransport, setMediaTransport] = useState<"none" | "livekit" | "p2p" | "echo">("none");

  useEffect(() => {
    return addChannelStatusListener((event) => {
      if (session?.chatId && event.channelName.includes(session.chatId)) {
        setChannelConnectionStatus(event.status);
      } else if (!session?.chatId) {
        setChannelConnectionStatus(event.status);
      }
    });
  }, [session?.chatId]);

  const [activeCallsByFriend, setActiveCallsByFriend] = useState<Map<string, string>>(new Map());

  const isCallActiveWithFriend = useCallback(
    (friendIdOrUid: string) => {
      const cleanId = String(friendIdOrUid || "").replace(/^cp-friend:/, "").trim();
      if (!cleanId) return false;
      // 1. O usuário atual está em chamada ativa com este amigo
      if (session && callState === "active" && (session.friendUid === cleanId || session.chatId?.includes(cleanId))) {
        return true;
      }
      // 2. A chamada continua aberta com este amigo (o usuário saiu da tela, mas a chamada ainda existe para retornar)
      if (activeCallsByFriend.has(cleanId)) {
        return true;
      }
      return false;
    },
    [activeCallsByFriend, callState, session],
  );

  const [pendingReconnectSession, setPendingReconnectSession] = useState<{
    chatId: string;
    friendUid: string;
    friendName: string;
    friendAvatar?: string;
    hasVideo?: boolean;
    timestamp: number;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem("checkpoint_last_voice_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          return parsed;
        }
      }
    } catch { }
    return null;
  });

  const lastProcessedInviteKeyRef = useRef<string>("");
  const lastInviteTimestampRef = useRef<number>(0);

  // Device lists and selection
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);

  const [selectedAudioInput, setSelectedAudioInputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_input_device") || "default";
    } catch {
      return "default";
    }
  });

  const [selectedAudioOutput, setSelectedAudioOutputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_output_device") || "default";
    } catch {
      return "default";
    }
  });

  const [selectedVideoInput, setSelectedVideoInputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_video_device") || "default";
    } catch {
      return "default";
    }
  });

  // Audio processing constraints & sensitivity
  const [voiceSensitivity, setVoiceSensitivityState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_sensitivity");
      return saved ? Math.max(0, Math.min(100, Number(saved))) : 35;
    } catch {
      return 35;
    }
  });

  const [echoCancellation, setEchoCancellationState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_echo_cancellation");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const [noiseSuppression, setNoiseSuppressionState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_noise_suppression");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const [autoGainControl, setAutoGainControlState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_auto_gain");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const echoCancellationRef = useRef(echoCancellation);
  echoCancellationRef.current = echoCancellation;

  const noiseSuppressionRef = useRef(noiseSuppression);
  noiseSuppressionRef.current = noiseSuppression;

  const autoGainControlRef = useRef(autoGainControl);
  autoGainControlRef.current = autoGainControl;

  // Push-to-Talk settings
  const [inputMode, setInputModeState] = useState<VoiceInputMode>(() => {
    try {
      return (localStorage.getItem("checkpoint_voice_input_mode") as VoiceInputMode) || "voice-activity";
    } catch {
      return "voice-activity";
    }
  });

  const [pushToTalkKey, setPushToTalkKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_ptt_key") || "F8";
    } catch {
      return "F8";
    }
  });

  const [isPttPressed, setIsPttPressed] = useState(false);

  const voiceSensitivityRef = useRef(voiceSensitivity);
  voiceSensitivityRef.current = voiceSensitivity;

  const isPttPressedRef = useRef(isPttPressed);
  isPttPressedRef.current = isPttPressed;

  const inputModeRef = useRef(inputMode);
  inputModeRef.current = inputMode;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;

  // Microphone monitoring / sidetone
  const [isMicMonitoring, setIsMicMonitoringState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_mic_monitoring") === "true";
    } catch {
      return false;
    }
  });

  // Microphone Gain (0 - 200%, default 100%)
  const [micGain, setMicGainState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_mic_gain");
      return saved ? Math.max(0, Math.min(200, Number(saved))) : 100;
    } catch {
      return 100;
    }
  });

  const micGainRef = useRef(micGain);
  micGainRef.current = micGain;

  const setMicGain = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(200, val));
    setMicGainState(clamped);
    micGainRef.current = clamped;
    // Apply to live Web Audio GainNode — no need to rebuild the AudioContext.
    if (activeGainNodeRef.current) {
      activeGainNodeRef.current.gain.value = clamped / 100;
    }
    try {
      localStorage.setItem("checkpoint_voice_mic_gain", String(clamped));
    } catch { }
  }, []);

  // Advanced noise suppression via RNNoise WASM (separate from native getUserMedia constraint)
  const [advancedNoiseSuppression, setAdvancedNoiseSuppressionState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_advanced_ns") !== "false";
    } catch {
      return true;
    }
  });

  const advancedNoiseSuppressionRef = useRef(advancedNoiseSuppression);
  advancedNoiseSuppressionRef.current = advancedNoiseSuppression;

  // Noise Gate (silencia ruído de fundo automaticamente no VAD)
  const [noiseGateEnabled, setNoiseGateEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_noise_gate") !== "false";
    } catch {
      return true;
    }
  });

  const noiseGateEnabledRef = useRef(noiseGateEnabled);
  noiseGateEnabledRef.current = noiseGateEnabled;

  const setNoiseGateEnabled = useCallback((val: boolean) => {
    setNoiseGateEnabledState(val);
    noiseGateEnabledRef.current = val;
    try {
      localStorage.setItem("checkpoint_voice_noise_gate", String(val));
    } catch { }
    if (!val && inputModeRef.current === "voice-activity" && localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track && !isMutedRef.current && !isDeafenedRef.current) {
        track.enabled = true;
      }
      const raw = rawStreamRef.current?.getAudioTracks()[0];
      if (raw && raw !== track && !isMutedRef.current && !isDeafenedRef.current) {
        raw.enabled = true;
      }
    }
  }, []);

  // Calibração de Ruído Ambiente
  const [isCalibratingNoise, setIsCalibratingNoise] = useState(false);
  const [currentNoiseFloor, setCurrentNoiseFloor] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_noise_floor");
      return saved ? Number(saved) : 5;
    } catch {
      return 5;
    }
  });

  // Diagnóstico de erro de dispositivo
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const clearDeviceError = useCallback(() => setDeviceError(null), []);

  const micMonitoringPipelineRef = useRef<{
    ctx: AudioContext | null;
    source: MediaStreamAudioSourceNode | null;
    gain: GainNode | null;
  }>({ ctx: null, source: null, gain: null });

  const stopMicMonitoring = useCallback(() => {
    if (micMonitoringPipelineRef.current.source) {
      try {
        micMonitoringPipelineRef.current.source.disconnect();
      } catch { }
      micMonitoringPipelineRef.current.source = null;
    }
    if (micMonitoringPipelineRef.current.gain) {
      try {
        micMonitoringPipelineRef.current.gain.disconnect();
      } catch { }
      micMonitoringPipelineRef.current.gain = null;
    }
    if (micMonitoringPipelineRef.current.ctx) {
      try {
        if (micMonitoringPipelineRef.current.ctx.state !== "closed") {
          void micMonitoringPipelineRef.current.ctx.close().catch(() => { });
        }
      } catch { }
      micMonitoringPipelineRef.current.ctx = null;
    }
  }, []);

  const startMicMonitoring = useCallback((stream: MediaStream) => {
    stopMicMonitoring();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = 0.85;
      source.connect(gain);
      gain.connect(ctx.destination);
      micMonitoringPipelineRef.current = { ctx, source, gain };
    } catch (err) {
      console.warn("[useVoiceCall] startMicMonitoring failed:", err);
    }
  }, [stopMicMonitoring]);

  const setIsMicMonitoring = useCallback(
    (val: boolean) => {
      setIsMicMonitoringState(val);
      try {
        localStorage.setItem("checkpoint_voice_mic_monitoring", String(val));
      } catch { }
      if (!val) {
        stopMicMonitoring();
      } else if (localStreamRef.current) {
        startMicMonitoring(localStreamRef.current);
      }
    },
    [startMicMonitoring, stopMicMonitoring],
  );

  // Multi-peer Mesh & LiveKit SFU Refs
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  /** peerId → currently sharing screen (TrackSubscribed/Unsubscribed source of truth for LiveKit) */
  const remoteScreenSharingPeersRef = useRef<Map<string, boolean>>(new Map());
  const remotePipelinesRef = useRef<Map<string, AudioPipeline>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const livekitRoomRef = useRef<LiveKitRoom | null>(null);
  const livekitAudioPubRef = useRef<LocalTrackPublication | null>(null);
  const livekitVideoPubRef = useRef<LocalTrackPublication | null>(null);
  const livekitScreenPubRef = useRef<LocalTrackPublication | null>(null);
  const livekitScreenAudioPubRef = useRef<LocalTrackPublication | null>(null);
  const livekitAttachedElementsRef = useRef<Set<HTMLMediaElement>>(new Set());
  const livekitAttachedTrackKeysRef = useRef<Set<string>>(new Set());
  const echoAudioRef = useRef<HTMLAudioElement | null>(null);

  const peerVolumesRef = useRef(peerVolumes);
  peerVolumesRef.current = peerVolumes;
  const remoteVolumeRef = useRef(remoteVolume);
  remoteVolumeRef.current = remoteVolume;
  const selectedAudioOutputRef = useRef(selectedAudioOutput);
  selectedAudioOutputRef.current = selectedAudioOutput;

  const localStreamRef = useRef<MediaStream | null>(null);
  /** Raw stream from getUserMedia — source of the audio processing chain. Never goes to WebRTC directly. */
  const rawStreamRef = useRef<MediaStream | null>(null);
  /** Live GainNode in the active processing chain — updated in real time by setMicGain. */
  const activeGainNodeRef = useRef<GainNode | null>(null);
  /** Cleanup function for the active audio processing chain (gain+compressor+RNNoise). */
  const audioProcCleanupRef = useRef<(() => void) | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenBarrierRef = useRef<CallAudioBarrierInstance | null>(null);
  const screenVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenShareStoppingRef = useRef(false);
  const tauriScreenStopRef = useRef<(() => Promise<void>) | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<VoiceCallSession | null>(null);
  sessionRef.current = session;
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;
  const lastConnectSfxAtRef = useRef(0);
  const incomingInviteRef = useRef<CallInvitePayload | null>(null);
  incomingInviteRef.current = incomingInvite;

  // Local audio analyzer pipeline
  const localPipelineRef = useRef<AudioPipeline>(createEmptyPipeline());

  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const callDurationTimerRef = useRef<number | null>(null);
  const ringoutTimerRef = useRef<number | null>(null);
  const audioRingIntervalRef = useRef<number | null>(null);
  const pttReleaseTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const isAcquiringMediaRef = useRef(false);

  // LiveKit SFU as primary transport flag
  const useLiveKitPrimaryRef = useRef(true);
  const livekitConnectedRef = useRef(false);

  // Live synchronization of remote participant & stream volume changes
  useEffect(() => {
    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.remoteParticipants.forEach((participant) => {
          const peerId = participant.identity;
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.track.kind === LiveKitTrack.Kind.Audio) {
              const isScreenAudio = pub.source === LiveKitTrack.Source.ScreenShareAudio;
              const peerVol = isDeafened
                ? 0
                : isScreenAudio
                  ? (peerVolumes[`screen:${peerId}`] ?? peerVolumes["remote-screen"] ?? peerVolumes[peerId] ?? remoteVolume)
                  : (peerVolumes[peerId] ?? peerVolumes["remote-user"] ?? remoteVolume);
              const normVol = Math.max(0, Math.min(1.0, (peerVol ?? 100) / 100));

              pub.track.attachedElements?.forEach((el) => {
                el.volume = normVol;
                if (selectedAudioOutput && selectedAudioOutput !== "default" && typeof (el as any).setSinkId === "function") {
                  void (el as any).setSinkId(selectedAudioOutput).catch(() => { });
                }
              });
            }
          });
        });
      } catch (err) {
        console.warn("[useVoiceCall] Sync LiveKit volumes error:", err);
      }
    }

    if (echoAudioRef.current) {
      const vol = isDeafened ? 0 : (peerVolumes["echo-bot"] ?? peerVolumes["remote-user"] ?? remoteVolume ?? 100) / 100;
      echoAudioRef.current.volume = Math.max(0, Math.min(1, vol));
      if (selectedAudioOutput && selectedAudioOutput !== "default" && typeof (echoAudioRef.current as any).setSinkId === "function") {
        void (echoAudioRef.current as any).setSinkId(selectedAudioOutput).catch(() => { });
      }
    }
  }, [peerVolumes, remoteVolume, isDeafened, selectedAudioOutput]);

  /**
   * Wraps a raw getUserMedia stream in the real audio processing chain.
   * Stores rawStream, gainNode and cleanup in their respective refs.
   * Returns the *processed* MediaStream for local metering / UI / P2P.
   * LiveKit publishes the raw mic track separately (lower latency).
   */
  const applyAudioProcessingChain = useCallback(
    async (rawStream: MediaStream): Promise<MediaStream> => {
      const previousCleanup = audioProcCleanupRef.current;
      const previousRawStream = rawStreamRef.current;

      try {
        // Build the replacement chain BEFORE tearing down the active chain. This prevents
        // a settings toggle from leaving LiveKit/WebRTC permanently attached to a dead track
        // if RNNoise or AudioWorklet initialization fails.
        const result = await buildProcessedAudioTrack(
          rawStream,
          micGainRef.current,
          advancedNoiseSuppressionRef.current,
        );

        audioProcCleanupRef.current = result.cleanup;
        activeGainNodeRef.current = result.gainNode;
        rawStreamRef.current = rawStream;

        if (previousCleanup && previousCleanup !== result.cleanup) {
          try {
            previousCleanup();
          } catch {
            /* ignore */
          }
        }

        if (previousRawStream && previousRawStream !== rawStream) {
          previousRawStream.getTracks().forEach((track) => track.stop());
        }

        return result.processedStream;
      } catch (err) {
        // Keep the existing chain alive when rebuilding fails. Only fall back to the raw
        // stream if there was no usable processed stream yet.
        console.error("[useVoiceCall] buildProcessedAudioTrack failed; preserving active audio chain:", err);
        return localStreamRef.current || rawStream;
      }
    },
    [], // intentionally empty — uses refs only, no captured state
  );

  // VAD Engine Setup with RMS and 250ms Hold Timer per peer/stream
  const setupVoiceAnalyzer = useCallback(
    (stream: MediaStream, isLocal: boolean, peerId = "local") => {
      let targetPipeline: AudioPipeline;
      if (isLocal) {
        destroyAudioPipeline(localPipelineRef.current);
        localPipelineRef.current = createEmptyPipeline();
        targetPipeline = localPipelineRef.current;
      } else {
        const existing = remotePipelinesRef.current.get(peerId);
        if (existing) {
          destroyAudioPipeline(existing);
        }
        targetPipeline = createEmptyPipeline();
        remotePipelinesRef.current.set(peerId, targetPipeline);
      }

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        // Use raw hardware stream for local VAD so noise-gating the output track doesn't kill voice detection
        const sourceStream = isLocal && rawStreamRef.current ? rawStreamRef.current : stream;
        const source = ctx.createMediaStreamSource(sourceStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.35;

        // Keep Chromium Web Audio rendering clock active with a silent gain sink
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        source.connect(analyser);
        analyser.connect(silentGain);
        silentGain.connect(ctx.destination);

        targetPipeline.ctx = ctx;
        targetPipeline.source = source;
        targetPipeline.analyser = analyser;
        targetPipeline.silentGain = silentGain;

        const timeData = new Float32Array(analyser.fftSize);
        let currentlySpeaking = false;

        const checkVolume = () => {
          if (!targetPipeline.analyser || !targetPipeline.ctx) return;
          if (targetPipeline.ctx.state === "suspended") {
            void targetPipeline.ctx.resume().catch(() => { });
          }

          analyser.getFloatTimeDomainData(timeData);

          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const gainMultiplier = isLocal ? (micGainRef.current / 100) : 1;
          const rawVolume = Math.min(100, Math.round(rms * 850 * gainMultiplier));

          const sens = Math.max(1, Math.min(100, voiceSensitivityRef.current));
          // Open threshold: level needed to START speaking (at 50% sens -> ~6, at 35% -> ~9)
          const openThreshold = Math.max(2, Math.round(1 + 24 * Math.pow((100 - sens) / 100, 1.6)));
          // Close threshold (hysteresis): softer level needed to STAY speaking (60% of open threshold)
          const closeThreshold = Math.max(1, Math.round(openThreshold * 0.6));

          const isPtt = inputModeRef.current === "push-to-talk";
          const isPttActive = isPttPressedRef.current;
          const isMutedLocally = isLocal && (isMutedRef.current || isDeafenedRef.current);

          const isAboveThreshold = isMutedLocally
            ? false
            : isLocal && isPtt
              ? isPttActive && rawVolume >= 1
              : currentlySpeaking
                ? rawVolume >= closeThreshold
                : rawVolume >= openThreshold;

          if (isAboveThreshold) {
            if (targetPipeline.holdTimer) {
              window.clearTimeout(targetPipeline.holdTimer);
              targetPipeline.holdTimer = null;
            }
            if (isLocal && !isMutedRef.current && !isDeafenedRef.current) {
              const track = localStreamRef.current?.getAudioTracks()[0];
              if (track && !track.enabled) {
                track.enabled = true;
              }
              const raw = rawStreamRef.current?.getAudioTracks()[0];
              if (raw && raw !== track && !raw.enabled) {
                raw.enabled = true;
              }
            }
            if (!currentlySpeaking) {
              currentlySpeaking = true;
              if (isLocal) {
                setIsSpeakingLocal(true);
                if (sessionRef.current?.chatId && user?.uid) {
                  void sendCallState(sessionRef.current.chatId, {
                    senderId: user.uid,
                    chatId: sessionRef.current.chatId,
                    isSpeaking: true,
                  });
                }
              } else {
                setRemoteSpeakingStates((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, true);
                  return updated;
                });
              }
            }
          } else if (currentlySpeaking && !targetPipeline.holdTimer) {
            // Hangover decay timer (450ms) to allow natural pauses between syllables and words without chopping
            targetPipeline.holdTimer = window.setTimeout(() => {
              currentlySpeaking = false;
              targetPipeline.holdTimer = null;
              if (isLocal) {
                setIsSpeakingLocal(false);
                // Com LiveKit + DTX, o silencio e tratado pelo codec Opus — nao
                // desabilitamos a trilha no VAD porque o re-enable corta a
                // primeira silaba e e percebido como "atraso" pelo outro lado.
                // O gate duro so se aplica ao Push-to-Talk (sem PTT pressionado).
                const shouldMuteTrack =
                  inputModeRef.current === "push-to-talk"
                    ? !isPttPressedRef.current
                    : false;

                if (shouldMuteTrack) {
                  const track = localStreamRef.current?.getAudioTracks()[0];
                  if (track) {
                    track.enabled = false;
                  }
                  const raw = rawStreamRef.current?.getAudioTracks()[0];
                  if (raw && raw !== track) {
                    raw.enabled = false;
                  }
                }
                if (sessionRef.current?.chatId && user?.uid) {
                  void sendCallState(sessionRef.current.chatId, {
                    senderId: user.uid,
                    chatId: sessionRef.current.chatId,
                    isSpeaking: false,
                  });
                }
              } else {
                setRemoteSpeakingStates((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, false);
                  return updated;
                });
              }
            }, 450);
          }
        };

        targetPipeline.intervalId = window.setInterval(checkVolume, 25);
      } catch (err) {
        console.warn("[useVoiceCall] setupVoiceAnalyzer failed:", err);
      }
    },
    [user?.uid],
  );

  // Auto-sync analyzers when localStream changes
  useEffect(() => {
    if (localStream) {
      setupVoiceAnalyzer(localStream, true);
    } else {
      destroyAudioPipeline(localPipelineRef.current);
      setIsSpeakingLocal(false);
    }
  }, [localStream, setupVoiceAnalyzer]);

  /** Sync mute/PTT enable on both processed (UI) and raw (LiveKit publish) mic tracks. */
  const setOutgoingMicEnabled = useCallback((enabled: boolean) => {
    const processed = localStreamRef.current?.getAudioTracks()[0];
    const raw = rawStreamRef.current?.getAudioTracks()[0];
    if (processed) processed.enabled = enabled;
    if (raw && raw !== processed) raw.enabled = enabled;
  }, []);

  const replaceActiveMicrophoneTrack = useCallback(
    async (processedStream: MediaStream) => {
      const processedTrack = processedStream.getAudioTracks()[0];
      if (!processedTrack) return;

      const rawTrack = rawStreamRef.current?.getAudioTracks()[0] || processedTrack;
      // LiveKit gets the raw mic for lower latency; P2P keeps the processed chain.
      const livekitTrack =
        useLiveKitPrimaryRef.current && livekitConnectedRef.current ? rawTrack : processedTrack;

      const shouldEnable =
        !isMutedRef.current &&
        !isDeafenedRef.current &&
        (inputModeRef.current !== "push-to-talk" || isPttPressedRef.current);
      processedTrack.enabled = shouldEnable;
      if (rawTrack !== processedTrack) rawTrack.enabled = shouldEnable;

      const previousProcessed = localStreamRef.current?.getAudioTracks()[0] || null;
      await replaceOutgoingAudioTrack({
        peerConnections: peerConnectionsRef.current.values(),
        livekitPublication: null,
        previousTrack: previousProcessed,
        excludedTracks: screenAudioTrackRef.current ? [screenAudioTrackRef.current] : [],
        newTrack: processedTrack,
      });

      const livekitLocalTrack = livekitAudioPubRef.current?.track as
        | { replaceTrack?: (track: MediaStreamTrack) => Promise<unknown> | unknown }
        | null
        | undefined;
      if (livekitLocalTrack?.replaceTrack) {
        try {
          await livekitLocalTrack.replaceTrack(livekitTrack);
        } catch (err) {
          console.warn("[useVoiceCall] LiveKit mic replaceTrack warning:", err);
        }
      }

      localStreamRef.current = processedStream;
      setLocalStream(processedStream);
      setupVoiceAnalyzer(processedStream, true);
    },
    [setupVoiceAnalyzer],
  );

  // Dynamic Audio Constraints Applier
  const applyAudioProcessingConstraints = useCallback(
    async (newEcho: boolean, newNoise: boolean, newAutoGain: boolean) => {
      const rawTrack = rawStreamRef.current?.getAudioTracks()[0];
      if (!rawTrack) return;

      try {
        await rawTrack.applyConstraints({
          echoCancellation: newEcho ? { ideal: true } : false,
          noiseSuppression: newNoise ? { ideal: true } : false,
          autoGainControl: newAutoGain ? { ideal: true } : false,
        });
      } catch (err) {
        console.warn("[useVoiceCall] track.applyConstraints fallback:", err);
        try {
          const currentDeviceId = selectedAudioInput !== "default" ? selectedAudioInput : undefined;
          const newRawStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
              echoCancellation: newEcho ? { ideal: true } : false,
              noiseSuppression: newNoise ? { ideal: true } : false,
              autoGainControl: newAutoGain ? { ideal: true } : false,
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48000 },
              sampleSize: { ideal: 16 },
            },
            video: false,
          });

          const processedStream = await applyAudioProcessingChain(newRawStream);
          await replaceActiveMicrophoneTrack(processedStream);
        } catch (fallbackErr) {
          console.error("[useVoiceCall] Audio stream re-acquisition failed:", fallbackErr);
        }
      }
    },
    [applyAudioProcessingChain, replaceActiveMicrophoneTrack, selectedAudioInput],
  );

  // Settings setters
  const setVoiceSensitivity = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVoiceSensitivityState(clamped);
    voiceSensitivityRef.current = clamped;
    try {
      localStorage.setItem("checkpoint_voice_sensitivity", String(clamped));
    } catch { }
  }, []);

  const setEchoCancellation = useCallback((val: boolean) => {
    setEchoCancellationState(val);
    echoCancellationRef.current = val;
    try {
      localStorage.setItem("checkpoint_voice_echo_cancellation", String(val));
    } catch { }
    const browserNs = noiseSuppressionRef.current && !advancedNoiseSuppressionRef.current;
    const browserAgc = autoGainControlRef.current && !advancedNoiseSuppressionRef.current;
    void applyAudioProcessingConstraints(val, browserNs, browserAgc);
  }, [applyAudioProcessingConstraints]);

  const setNoiseSuppression = useCallback((val: boolean) => {
    setNoiseSuppressionState(val);
    noiseSuppressionRef.current = val;
    try {
      localStorage.setItem("checkpoint_voice_noise_suppression", String(val));
    } catch { }
    const browserNs = val && !advancedNoiseSuppressionRef.current;
    const browserAgc = autoGainControlRef.current && !advancedNoiseSuppressionRef.current;
    void applyAudioProcessingConstraints(echoCancellationRef.current, browserNs, browserAgc);
  }, [applyAudioProcessingConstraints]);

  const setAutoGainControl = useCallback((val: boolean) => {
    setAutoGainControlState(val);
    autoGainControlRef.current = val;
    try {
      localStorage.setItem("checkpoint_voice_auto_gain", String(val));
    } catch { }
    const browserNs = noiseSuppressionRef.current && !advancedNoiseSuppressionRef.current;
    const browserAgc = val && !advancedNoiseSuppressionRef.current;
    void applyAudioProcessingConstraints(echoCancellationRef.current, browserNs, browserAgc);
  }, [applyAudioProcessingConstraints]);

  const setAdvancedNoiseSuppression = useCallback(
    async (val: boolean) => {
      setAdvancedNoiseSuppressionState(val);
      advancedNoiseSuppressionRef.current = val;
      try {
        localStorage.setItem("checkpoint_voice_advanced_ns", String(val));
      } catch { }

      // Avoid double NS/AGC: browser DSP off when RNNoise is on
      const browserNs = noiseSuppressionRef.current && !val;
      const browserAgc = autoGainControlRef.current && !val;
      void applyAudioProcessingConstraints(echoCancellationRef.current, browserNs, browserAgc);

      // Rebuild the processing chain if we have an active rawStream and call is not idle
      if (rawStreamRef.current && callState !== "idle") {
        try {
          const processedStream = await applyAudioProcessingChain(rawStreamRef.current);
          await replaceActiveMicrophoneTrack(processedStream);
        } catch (err) {
          console.error("[useVoiceCall] setAdvancedNoiseSuppression error:", err);
        }
      }
    },
    [applyAudioProcessingChain, applyAudioProcessingConstraints, callState, replaceActiveMicrophoneTrack],
  );

  // Audio acquisition helper com diagnóstico de erros específicos
  const acquireAudioStream = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      if (!navigator?.mediaDevices?.getUserMedia) return null;
      isAcquiringMediaRef.current = true;
      const targetDeviceId = deviceId || (selectedAudioInput !== "default" ? selectedAudioInput : undefined);

      // When advanced RNNoise is on, disable browser NS/AGC to avoid double processing.
      const useBrowserNs = noiseSuppression && !advancedNoiseSuppressionRef.current;
      const useBrowserAgc = autoGainControl && !advancedNoiseSuppressionRef.current;

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          echoCancellation: echoCancellation ? { ideal: true } : false,
          noiseSuppression: useBrowserNs ? { ideal: true } : false,
          autoGainControl: useBrowserAgc ? { ideal: true } : false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
        video: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setDeviceError(null);
        isAcquiringMediaRef.current = false;
        return stream;
      } catch (err: any) {
        console.warn("[useVoiceCall] getUserMedia primary failed:", err);
        let errorMsg = "Erro ao acessar o microfone.";
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          errorMsg = "Permissão de microfone negada. Verifique as configurações de privacidade do Windows.";
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          errorMsg = "Nenhum microfone encontrado. Conecte um microfone e tente novamente.";
        } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
          errorMsg = "O microfone está em uso exclusivo por outro aplicativo (ex: Discord, OBS) ou o driver travou.";
        } else if (err?.name === "OverconstrainedError") {
          errorMsg = "As configurações de áudio solicitadas não são suportadas pelo driver.";
        }
        setDeviceError(errorMsg);
        notify(errorMsg, "error");

        // Fallback genérico com constraints relaxadas
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: targetDeviceId ? { deviceId: { ideal: targetDeviceId } } : true,
            video: false,
          });
          setDeviceError(null);
          isAcquiringMediaRef.current = false;
          notify("Microfone iniciado em modo de compatibilidade básica.", "info");
          return fallbackStream;
        } catch {
          isAcquiringMediaRef.current = false;
          return null;
        }
      }
    },
    [autoGainControl, echoCancellation, noiseSuppression, notify, selectedAudioInput],
  );

  // Device Switchers com salvamento de label
  const changeAudioInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioInputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_input_device", deviceId);
        const deviceObj = audioInputDevices.find((d) => d.deviceId === deviceId);
        if (deviceObj?.label) {
          localStorage.setItem("checkpoint_voice_input_device_label", deviceObj.label);
        }
      } catch { }

      if (callState === "idle") return;

      try {
        const newRawStream = await acquireAudioStream(deviceId);
        if (!newRawStream) return;

        // Build the new processing chain (destroys the old one inside applyAudioProcessingChain).
        const processedStream = await applyAudioProcessingChain(newRawStream);

        const newTrack = processedStream.getAudioTracks()[0];
        if (!newTrack) return;

        if (inputMode === "push-to-talk" && !isPttPressed) {
          newTrack.enabled = false;
          const raw = rawStreamRef.current?.getAudioTracks()[0];
          if (raw && raw !== newTrack) raw.enabled = false;
        } else if (isMuted || isDeafened) {
          newTrack.enabled = false;
          const raw = rawStreamRef.current?.getAudioTracks()[0];
          if (raw && raw !== newTrack) raw.enabled = false;
        }

        // Atomically replace the microphone in both P2P fallback and the active LiveKit
        // publication. Keeping only the mesh sender updated is what caused audio to disappear
        // for the other participant after changing suppression/device settings.
        await replaceActiveMicrophoneTrack(processedStream);
        notify("Dispositivo de microfone alterado.", "info");
      } catch (err) {
        console.error("[useVoiceCall] changeAudioInputDevice error:", err);
        notify("Erro ao trocar de microfone.", "error");
      }
    },
    [acquireAudioStream, applyAudioProcessingChain, audioInputDevices, callState, notify, replaceActiveMicrophoneTrack],
  );

  const changeAudioOutputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioOutputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_output_device", deviceId);
      } catch { }
      notify("Dispositivo de saída alterado.", "info");
    },
    [notify],
  );

  // Enumerate connected devices with Label persistence
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const videos = devices.filter((d) => d.kind === "videoinput");

      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
      setVideoInputDevices(videos);

      setSelectedAudioInputState((prev) => {
        if (prev === "default") return "default";
        const exists = inputs.some((d) => d.deviceId === prev);
        if (!exists) {
          // Tenta encontrar o microfone pelo label salvo se mudou de porta USB
          try {
            const savedLabel = localStorage.getItem("checkpoint_voice_input_device_label");
            if (savedLabel) {
              const matched = inputs.find((d) => d.label === savedLabel);
              if (matched) return matched.deviceId;
            }
          } catch { }
          return "default";
        }
        return prev;
      });

      setSelectedAudioOutputState((prev) => {
        if (prev === "default") return "default";
        const exists = outputs.some((d) => d.deviceId === prev);
        return exists ? prev : "default";
      });

      setSelectedVideoInputState((prev) => {
        if (prev === "default") return "default";
        const exists = videos.some((d) => d.deviceId === prev);
        return exists ? prev : "default";
      });
    } catch (err) {
      console.warn("[useVoiceCall] enumerateDevices failed:", err);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Hot-Swap e Auto-Fallback quando o microfone é desconectado no meio de uma chamada
  useEffect(() => {
    if (callState === "idle" || !localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getAudioTracks()[0];
    if (!currentTrack) return;

    const handleTrackEnded = () => {
      console.warn("[useVoiceCall] Audio track ended unexpectedly! Falling back to default device...");
      notify("Microfone desconectado. Alternando automaticamente para o dispositivo padrão...", "info");
      setSelectedAudioInputState("default");
      try {
        localStorage.setItem("checkpoint_voice_input_device", "default");
      } catch { }
      void changeAudioInputDevice("default");
    };

    currentTrack.addEventListener("ended", handleTrackEnded);
    return () => {
      currentTrack.removeEventListener("ended", handleTrackEnded);
    };
  }, [callState, changeAudioInputDevice, notify]);

  const changeVideoInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedVideoInputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_video_device", deviceId);
      } catch { }

      if (!isCameraOn || callState === "idle") return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId !== "default" ? { exact: deviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        const newVideoTrack = stream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        if (cameraStreamRef.current) {
          cameraStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        }
        cameraStreamRef.current = stream;
        setLocalCameraStream(stream);

        if (isLocalTestCall(sessionRef.current?.chatId, sessionRef.current?.friendUid)) {
          setRemoteStream(stream);
          return;
        }

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            void sender.replaceTrack(newVideoTrack);
          }
        });

        notify("Câmera alterada.", "info");
      } catch (err) {
        console.error("[useVoiceCall] changeVideoInputDevice error:", err);
        notify("Erro ao trocar de câmera.", "error");
      }
    },
    [callState, isCameraOn, notify],
  );

  const setInputMode = useCallback(
    (mode: VoiceInputMode) => {
      setInputModeState(mode);
      try {
        localStorage.setItem("checkpoint_voice_input_mode", mode);
      } catch { }
      if (localStreamRef.current) {
        const track = localStreamRef.current.getAudioTracks()[0];
        const enabled = mode === "voice-activity" && !isMuted && !isDeafened;
        if (track) {
          track.enabled = enabled;
        }
        const raw = rawStreamRef.current?.getAudioTracks()[0];
        if (raw && raw !== track) {
          raw.enabled = enabled;
        }
      }
    },
    [isDeafened, isMuted],
  );

  const setPushToTalkKey = useCallback((key: string) => {
    setPushToTalkKeyState(key);
    try {
      localStorage.setItem("checkpoint_ptt_key", key);
    } catch { }
  }, []);

  // Global PTT shortcut registration with Electron
  useEffect(() => {
    if (inputMode === "push-to-talk" && pushToTalkKey) {
      window.electronAPI?.registerPushToTalk?.(pushToTalkKey).catch(console.error);
    } else {
      window.electronAPI?.unregisterPushToTalk?.().catch(console.error);
    }
    return () => {
      window.electronAPI?.unregisterPushToTalk?.().catch(console.error);
    };
  }, [inputMode, pushToTalkKey]);

  // PTT handlers
  const handlePttDown = useCallback(() => {
    if (pttReleaseTimeoutRef.current) {
      window.clearTimeout(pttReleaseTimeoutRef.current);
      pttReleaseTimeoutRef.current = null;
    }
    setIsPttPressed(true);
    if (localStreamRef.current && !isMuted && !isDeafened) {
      setOutgoingMicEnabled(true);
    }
  }, [isDeafened, isMuted, setOutgoingMicEnabled]);

  const handlePttUp = useCallback(() => {
    setIsPttPressed(false);
    if (pttReleaseTimeoutRef.current) window.clearTimeout(pttReleaseTimeoutRef.current);
    pttReleaseTimeoutRef.current = window.setTimeout(() => {
      if (inputMode === "push-to-talk") {
        setOutgoingMicEnabled(false);
      }
    }, 150);
  }, [inputMode, setOutgoingMicEnabled]);

  // Global IPC PTT events
  useEffect(() => {
    if (inputMode !== "push-to-talk") return;
    const unsubPress = window.electronAPI?.onPttPress?.(() => {
      handlePttDown();
    });
    const unsubRelease = window.electronAPI?.onPttRelease?.(() => {
      handlePttUp();
    });
    return () => {
      unsubPress?.();
      unsubRelease?.();
    };
  }, [handlePttDown, handlePttUp, inputMode]);

  // Local window PTT keyboard events (com proteção de foco para inputs/textareas)
  useEffect(() => {
    if (inputMode !== "push-to-talk") return;

    const isInputField = (el: EventTarget | null) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isInputField(e.target)) return; // Ignora se o usuário estiver digitando

      if (
        e.key.toUpperCase() === pushToTalkKey.toUpperCase() ||
        e.code.toUpperCase() === pushToTalkKey.toUpperCase()
      ) {
        handlePttDown();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isInputField(e.target)) return;

      if (
        e.key.toUpperCase() === pushToTalkKey.toUpperCase() ||
        e.code.toUpperCase() === pushToTalkKey.toUpperCase()
      ) {
        handlePttUp();
        window.electronAPI?.sendPttRelease?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handlePttDown, handlePttUp, inputMode, pushToTalkKey]);

  const activeRingtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const incomingTimeoutTimerRef = useRef<number | null>(null);

  // Stop Ringtone instantaneously
  const stopRingtone = useCallback(() => {
    if (audioRingIntervalRef.current) {
      window.clearInterval(audioRingIntervalRef.current);
      audioRingIntervalRef.current = null;
    }
    if (ringoutTimerRef.current) {
      window.clearTimeout(ringoutTimerRef.current);
      ringoutTimerRef.current = null;
    }
    if (incomingTimeoutTimerRef.current) {
      window.clearTimeout(incomingTimeoutTimerRef.current);
      incomingTimeoutTimerRef.current = null;
    }
    if (activeRingtoneAudioRef.current) {
      try {
        activeRingtoneAudioRef.current.pause();
        activeRingtoneAudioRef.current.currentTime = 0;
      } catch { }
      activeRingtoneAudioRef.current = null;
    }
  }, []);

  // SFX sounds
  // NOTE: Não usar loop=true para ringout — o setInterval já repetem o som.
  // loop=true faz o browser retomar automaticamente quando a janela volta ao foco (autoplay resume),
  // causando o toque inesperado ao minimizar/restaurar.
  const playRingtone = useCallback((type: "call" | "ringout" | "connect" | "disconnect") => {
    stopRingtone();
    try {
      if (type === "call") {
        const audio = new Audio(sfxIncomingCall);
        audio.loop = true;
        audio.volume = 1.0;
        activeRingtoneAudioRef.current = audio;
        void audio.play().catch(() => { });
      } else if (type === "ringout") {
        // Sem loop: o interval de 3s em startCall repete o som manualmente.
        // Isso evita que o browser retome o áudio automaticamente ao restaurar a janela.
        const audio = new Audio(sfxRingingOut);
        audio.loop = false;
        audio.volume = 0.85;
        activeRingtoneAudioRef.current = audio;
        void audio.play().catch(() => { });
      } else if (type === "connect") {
        const now = Date.now();
        if (now - lastConnectSfxAtRef.current < 1500) return;
        lastConnectSfxAtRef.current = now;
        playSfx(sfxJoin);
      } else if (type === "disconnect") {
        playSfx(sfxLeave);
      }
    } catch { }
  }, [stopRingtone]);

  // Pausa o ringout quando a janela perde foco ou é minimizada.
  // O loop=false + interval garante que o som só toque quando a janela está em foco.
  // Sem isso, o browser retome o áudio com loop=true automaticamente ao restaurar a janela.
  useEffect(() => {
    const pauseRingout = () => {
      const audio = activeRingtoneAudioRef.current;
      if (!audio) return;
      // Só pausa o ringout de saída; chamadas entrantes podem continuar
      if (audio.loop) return; // loop=true = incoming call — não interromper
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch { }
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") pauseRingout();
    };
    window.addEventListener("blur", pauseRingout);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pauseRingout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Complete Cleanup Helper (Full Mesh P2P, AudioPipelines, Timers, Media Streams)
  const cleanUpCall = useCallback(() => {
    stopRingtone();
    if (callDurationTimerRef.current) {
      window.clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (incomingTimeoutTimerRef.current) {
      window.clearTimeout(incomingTimeoutTimerRef.current);
      incomingTimeoutTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);

    // Destroy local audio pipeline
    destroyAudioPipeline(localPipelineRef.current);

    // Destroy all remote audio pipelines
    remotePipelinesRef.current.forEach((pipeline) => destroyAudioPipeline(pipeline));
    remotePipelinesRef.current.clear();
    setRemoteSpeakingStates(new Map());
    setRemoteStatesMap(new Map());

    // Stop local media tracks
    // First destroy the audio processing chain so the AudioContext is closed cleanly.
    if (audioProcCleanupRef.current) {
      try {
        audioProcCleanupRef.current();
      } catch { }
      audioProcCleanupRef.current = null;
    }
    activeGainNodeRef.current = null;
    // Stop the raw source stream (getUserMedia).
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Clean up attached LiveKit media elements
    livekitAttachedElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch { }
    });
    livekitAttachedElementsRef.current.clear();
    livekitAttachedTrackKeysRef.current.clear();

    // Clean up local echo audio element
    if (echoAudioRef.current) {
      try {
        echoAudioRef.current.pause();
        echoAudioRef.current.srcObject = null;
      } catch { }
      echoAudioRef.current = null;
    }

    // Disconnect LiveKit SFU Room
    if (livekitRoomRef.current) {
      try {
        void livekitRoomRef.current.disconnect();
      } catch { }
      livekitRoomRef.current = null;
    }
    livekitConnectedRef.current = false;
    livekitAudioPubRef.current = null;
    livekitVideoPubRef.current = null;
    livekitScreenPubRef.current = null;
    livekitScreenAudioPubRef.current = null;
    screenVideoTrackRef.current = null;
    screenAudioTrackRef.current = null;
    screenShareStoppingRef.current = false;
    setMediaTransport("none");

    // Close all WebRTC PeerConnections in Mesh
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch { }
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    remoteScreenStreamsRef.current.clear();
    remoteScreenSharingPeersRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (unsubscribeSessionRef.current) {
      unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = null;
    }

    // Se estiver em uma sala persistente, registra a saída no backend
    if (sessionRef.current?.chatId && /^[0-9a-f-]{36}$/i.test(sessionRef.current.chatId)) {
      void leaveVoiceRoom(sessionRef.current.chatId);
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setRemoteScreenStreams(new Map());
    setRemoteStream(null);
    setLocalCameraStream(null);
    setLocalScreenStream(null);
    setIsSharingScreen(false);
    setIsRemoteSharingScreen(false);
    setIsCameraOn(false);
    setIsRemoteCameraOn(false);
    setIsRemoteMuted(false);
    setIsRemoteDeafened(false);
    setIsMuted(false);
    setIsDeafened(false);
    setIsSpeakingLocal(false);
    setCallState("idle");
    setSession(null);
    setRoomConfig(null);
    setIncomingInvite(null);
    setCallDuration(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanUpCall();
    };
  }, [cleanUpCall]);

  // Connect and manage LiveKit SFU Room for low-latency voice and video
  const connectLiveKitRoom = useCallback(
    async (roomName: string, identity: string, displayName: string, avatarUrl?: string) => {
      try {
        if (livekitRoomRef.current) {
          try {
            await livekitRoomRef.current.disconnect();
          } catch { }
          livekitRoomRef.current = null;
        }

        if (!isLiveKitCompatibleRoom(roomName) || isLocalTestCall(roomName)) {
          throw new Error("Chamada local de teste — LiveKit não se aplica.");
        }
        const { token, serverUrl } = await fetchLiveKitToken(roomName, identity, displayName, { avatar: avatarUrl });
        const room = new LiveKitRoom({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          publishDefaults: {
            videoCodec: "h264",
            screenShareEncoding: {
              maxBitrate: 8_000_000,
              maxFramerate: 60,
              priority: "high",
            },
            degradationPreference: "maintain-framerate",
          },
        });

        const getLiveKitTrackKey = (track: any, publication: any, peerId: string) =>
          String(track?.sid || track?.mediaStreamTrack?.id || publication?.trackSid || `${peerId}:${publication?.source || track?.source || "audio"}`);

        const syncRemoteScreenSharingFlag = () => {
          const anySharing = Array.from(remoteScreenSharingPeersRef.current.values()).some(Boolean);
          setIsRemoteSharingScreen(anySharing);
        };

        const getOrCreatePeerStream = (
          mapRef: MutableRefObject<Map<string, MediaStream>>,
          peerId: string,
        ) => {
          let stream = mapRef.current.get(peerId);
          if (!stream) {
            stream = new MediaStream();
            mapRef.current.set(peerId, stream);
          }
          return stream;
        };

        const addTrackToPeerStream = (
          mapRef: MutableRefObject<Map<string, MediaStream>>,
          setMap: Dispatch<SetStateAction<Map<string, MediaStream>>>,
          peerId: string,
          mediaTrack: MediaStreamTrack,
        ) => {
          const stream = getOrCreatePeerStream(mapRef, peerId);
          if (!stream.getTracks().includes(mediaTrack)) {
            stream.addTrack(mediaTrack);
          }
          mapRef.current.set(peerId, stream);
          setMap(new Map(mapRef.current));
          return stream;
        };

        const removeTrackFromPeerStream = (
          mapRef: MutableRefObject<Map<string, MediaStream>>,
          setMap: Dispatch<SetStateAction<Map<string, MediaStream>>>,
          peerId: string,
          mediaTrack: MediaStreamTrack,
        ) => {
          const stream = mapRef.current.get(peerId);
          if (!stream) return;
          stream.removeTrack(mediaTrack);
          if (stream.getTracks().length === 0) {
            mapRef.current.delete(peerId);
          }
          setMap(new Map(mapRef.current));
        };

        const isScreenShareSource = (source: unknown) =>
          source === LiveKitTrack.Source.ScreenShare || source === LiveKitTrack.Source.ScreenShareAudio;

        const ingestRemoteLiveKitTrack = (track: any, publication: any, peerId: string) => {
          const mediaTrack = track.mediaStreamTrack as MediaStreamTrack | undefined;
          if (!mediaTrack) return;

          const screenShare = isScreenShareSource(track.source ?? publication?.source);
          if (screenShare) {
            const stream = addTrackToPeerStream(
              remoteScreenStreamsRef,
              setRemoteScreenStreams,
              peerId,
              mediaTrack,
            );
            if (track.kind === LiveKitTrack.Kind.Video || track.source === LiveKitTrack.Source.ScreenShare) {
              remoteScreenSharingPeersRef.current.set(peerId, true);
              syncRemoteScreenSharingFlag();
            }
            setRemoteStream(stream);
          } else {
            const stream = addTrackToPeerStream(remoteStreamsRef, setRemoteStreams, peerId, mediaTrack);
            setRemoteStream(stream);
            if (track.kind === LiveKitTrack.Kind.Video) {
              setIsRemoteCameraOn(true);
            }
          }
        };

        const attachLiveKitAudioOnce = (track: any, publication: any, peerId: string) => {
          const trackKey = getLiveKitTrackKey(track, publication, peerId);
          if (livekitAttachedTrackKeysRef.current.has(trackKey)) return;

          const el = track.attach() as HTMLMediaElement;
          livekitAttachedTrackKeysRef.current.add(trackKey);
          livekitAttachedElementsRef.current.add(el);

          // Playback de baixa latencia: garante autoplay imediato no primeiro
          // frame de audio em vez de esperar buffering do elemento.
          try {
            (el as HTMLAudioElement).autoplay = true;
            (el as any).playsInline = true;
            (el as HTMLAudioElement).preload = "auto";
          } catch { }

          const isScreenAudio = publication?.source === LiveKitTrack.Source.ScreenShareAudio;
          const peerVol = isDeafenedRef.current
            ? 0
            : isScreenAudio
              ? (peerVolumesRef.current[`screen:${peerId}`] ?? peerVolumesRef.current["remote-screen"] ?? peerVolumesRef.current[peerId] ?? remoteVolumeRef.current)
              : (peerVolumesRef.current[peerId] ?? peerVolumesRef.current["remote-user"] ?? remoteVolumeRef.current);
          el.volume = Math.max(0, Math.min(1.0, (peerVol ?? 100) / 100));
          if (selectedAudioOutputRef.current && selectedAudioOutputRef.current !== "default" && typeof (el as any).setSinkId === "function") {
            void (el as any).setSinkId(selectedAudioOutputRef.current).catch(() => { });
          }
          void el.play().catch(() => { });
        };

        room.on(LiveKitRoomEvent.TrackSubscribed, (track, publication, participant) => {
          const peerId = participant.identity;
          // Prevent local tracks (especially screenshare audio) from being attached and echoing locally
          if (peerId === userProfile?.uid || peerId === user?.uid) {
            console.warn("[LiveKit] Ignorando TrackSubscribed de track local para evitar eco.");
            return;
          }

          lockRemoteScreenShareQuality(publication);
          ingestRemoteLiveKitTrack(track, publication, peerId);

          if (track.kind === LiveKitTrack.Kind.Audio) {
            // LiveKit already exposes ActiveSpeakersChanged. Avoid a second Web Audio
            // analyser/AudioContext per remote participant.
            try {
              attachLiveKitAudioOnce(track, publication, peerId);
            } catch (attachErr) {
              console.warn("[LiveKit] TrackSubscribed attach error:", attachErr);
            }
          }
        });

        room.on(LiveKitRoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
          const peerId = participant.identity;
          const mediaTrack = track.mediaStreamTrack as MediaStreamTrack | undefined;
          const screenShare = isScreenShareSource(track.source ?? _pub?.source);

          if (mediaTrack) {
            if (screenShare) {
              removeTrackFromPeerStream(
                remoteScreenStreamsRef,
                setRemoteScreenStreams,
                peerId,
                mediaTrack,
              );
            } else {
              removeTrackFromPeerStream(remoteStreamsRef, setRemoteStreams, peerId, mediaTrack);
            }
          }

          try {
            livekitAttachedTrackKeysRef.current.delete(getLiveKitTrackKey(track, _pub, peerId));
            const detached = track.detach();
            detached.forEach((el) => {
              livekitAttachedElementsRef.current.delete(el);
              try { el.remove(); } catch { }
            });
          } catch { }

          if (track.kind === LiveKitTrack.Kind.Video) {
            if (track.source === LiveKitTrack.Source.ScreenShare) {
              remoteScreenSharingPeersRef.current.set(peerId, false);
              syncRemoteScreenSharingFlag();
            } else {
              // Keep camera-on if peer still has another camera video track
              const camStream = remoteStreamsRef.current.get(peerId);
              const stillHasCamera = Boolean(camStream?.getVideoTracks().some((t) => t.readyState !== "ended"));
              setIsRemoteCameraOn(stillHasCamera);
            }
          }
        });

        room.on(LiveKitRoomEvent.ActiveSpeakersChanged, (speakers) => {
          const activeMap = new Map<string, boolean>();
          speakers.forEach((s) => {
            activeMap.set(s.identity, true);
          });
          setRemoteSpeakingStates(activeMap);
        });

        room.on(LiveKitRoomEvent.ParticipantConnected, (participant) => {
          setSession((prev) => {
            if (!prev) return prev;
            const current = prev.participants || [];
            if (current.some((p) => p.uid === participant.identity)) return prev;
            let avatar: string | undefined;
            try {
              if (participant.metadata) {
                avatar = JSON.parse(participant.metadata)?.avatar;
              }
            } catch { }
            return {
              ...prev,
              participants: [
                ...current,
                { uid: participant.identity, name: participant.name || participant.identity, avatar },
              ],
            };
          });
        });

        room.on(LiveKitRoomEvent.ParticipantDisconnected, (participant) => {
          const peerId = participant.identity;
          remoteStreamsRef.current.delete(peerId);
          remoteScreenStreamsRef.current.delete(peerId);
          remoteScreenSharingPeersRef.current.delete(peerId);
          setRemoteStreams(new Map(remoteStreamsRef.current));
          setRemoteScreenStreams(new Map(remoteScreenStreamsRef.current));
          syncRemoteScreenSharingFlag();
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: (prev.participants || []).filter((p) => p.uid !== peerId),
            };
          });
        });

        await room.connect(serverUrl, token);
        livekitRoomRef.current = room;
        livekitConnectedRef.current = true;

        // Attach any existing tracks from participants already in the room
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.isSubscribed && publication.track) {
              const track = publication.track;
              const peerId = participant.identity;
              lockRemoteScreenShareQuality(publication);
              ingestRemoteLiveKitTrack(track, publication, peerId);

              if (track.kind === LiveKitTrack.Kind.Audio) {
                // ActiveSpeakersChanged is the authoritative VAD path for LiveKit.
                try {
                  attachLiveKitAudioOnce(track, publication, peerId);
                } catch { }
              }
            }
          });
        });

        // Publish raw mic to LiveKit (processed stream stays for local metering/UI).
        // Opcoes de baixa latencia: preset de voz Opus, DTX (nao transmite
        // silencio, reduz jitter), RED (recuperacao contra perda de pacote
        // sem retransmissao = menos gap) e mono forcado (metade do bitrate).
        const rawMicTrack = rawStreamRef.current?.getAudioTracks()[0];
        const fallbackMicTrack = localStreamRef.current?.getAudioTracks()[0];
        const audioTrack = rawMicTrack || fallbackMicTrack;
        if (audioTrack) {
          try {
            (audioTrack as MediaStreamTrack & { contentHint?: string }).contentHint = "speech";
          } catch { }
          const pub = await room.localParticipant.publishTrack(audioTrack, {
            name: "microphone",
            source: LiveKitTrack.Source.Microphone,
            audioPreset: LiveKitAudioPresets.speech,
            dtx: true,
            red: true,
            forceStereo: false,
            stopMicTrackOnMute: false,
          });
          livekitAudioPubRef.current = pub;
        }

        return room;
      } catch (err) {
        console.error("[LiveKit] Erro ao conectar na sala SFU:", err);
        throw err;
      }
    },
    [selectedAudioOutput, setupVoiceAnalyzer],
  );

  // ICE Preflight Connectivity Check com cache de 10 min e timeout rápido
  const lastIcePreflightRef = useRef<{ timestamp: number; result: { success: boolean; error?: string } }>({
    timestamp: 0,
    result: { success: true },
  });

  const runIcePreflightCheck = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const now = Date.now();
    // Reutiliza resultado recente para não adicionar latência de 3-5s a cada chamada
    if (now - lastIcePreflightRef.current.timestamp < 10 * 60 * 1000) {
      return lastIcePreflightRef.current.result;
    }

    try {
      const iceServers = await getTurnServers();
      if (!iceServers || iceServers.length === 0) {
        return { success: true };
      }

      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: "all",
        iceCandidatePoolSize: 5,
      });

      pc.createDataChannel("preflight");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      let hasCandidate = false;
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 1200);
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            hasCandidate = true;
            clearTimeout(timeout);
            resolve();
          } else {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      pc.close();
      const outcome = { success: hasCandidate || true };
      lastIcePreflightRef.current = { timestamp: now, result: outcome };
      return outcome;
    } catch (err: any) {
      console.warn("[ICE Preflight] Check failed, prosseguindo com LiveKit/P2P direto:", err);
      return { success: true };
    }
  }, []);

  // Create & setup a PeerConnection for a specific peer in the Full Mesh
  const createPeerConnectionForPeer = useCallback(
    async (chatId: string, targetPeerUid: string, isInitiator: boolean) => {
      const existing = peerConnectionsRef.current.get(targetPeerUid);
      if (existing && existing.signalingState !== "closed") {
        return existing;
      }

      const iceServers = await getTurnServers();
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all", // Permite conexão direta STUN/host de baixa latência com fallback automático para relay
        bundlePolicy: "max-bundle",
      });

      peerConnectionsRef.current.set(targetPeerUid, pc);

      // Attach local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, cameraStreamRef.current!));
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current!));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && user?.uid) {
          void sendCallSignal(chatId, {
            senderId: user.uid,
            chatId,
            targetUid: targetPeerUid,
            signal: { candidate: event.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (event) => {
        let stream = remoteStreamsRef.current.get(targetPeerUid);
        if (!stream) {
          stream = new MediaStream();
          remoteStreamsRef.current.set(targetPeerUid, stream);
        }

        if (event.track) {
          if (event.track.kind === "video") {
            // Remove previous stagnant or dead video tracks
            stream.getVideoTracks().forEach((vt) => {
              if (vt !== event.track) {
                try {
                  stream.removeTrack(vt);
                  vt.stop();
                } catch { }
              }
            });
            if (!stream.getTracks().includes(event.track)) {
              stream.addTrack(event.track);
            }
            setIsRemoteCameraOn(true);

            event.track.onended = () => {
              try { stream.removeTrack(event.track); } catch { }
              setRemoteStreams(new Map(remoteStreamsRef.current));
            };
            event.track.onmute = () => {
              setRemoteStreams(new Map(remoteStreamsRef.current));
            };
            event.track.onunmute = () => {
              setRemoteStreams(new Map(remoteStreamsRef.current));
            };
          } else if (event.track.kind === "audio") {
            stream.getAudioTracks().forEach((at) => {
              if (at !== event.track) {
                try { stream.removeTrack(at); } catch { }
              }
            });
            if (!stream.getTracks().includes(event.track)) {
              stream.addTrack(event.track);
            }
          }
        }

        remoteStreamsRef.current.set(targetPeerUid, stream);
        setRemoteStreams(new Map(remoteStreamsRef.current));
        setRemoteStream(stream); // Fallback for 1:1

        setupVoiceAnalyzer(stream, false, targetPeerUid);

        stream.onaddtrack = () => {
          setRemoteStreams(new Map(remoteStreamsRef.current));
        };
        stream.onremovetrack = () => {
          setRemoteStreams(new Map(remoteStreamsRef.current));
        };
      };

      // Reconnection helper for this peer with ICE restart
      const attemptPeerReconnect = async () => {
        if (!pc || pc.signalingState === "closed") return;
        if (reconnectAttemptsRef.current >= 8) {
          notify("Conexão perdida com participante.", "error");
          playRingtone("disconnect");
          cleanUpCall();
          return;
        }
        reconnectAttemptsRef.current += 1;
        setIsReconnecting(true);

        // Clean pending candidates for this peer on ICE restart
        pendingCandidatesRef.current.delete(targetPeerUid);

        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          if (user?.uid) {
            await sendCallSignal(chatId, {
              senderId: user.uid,
              chatId,
              targetUid: targetPeerUid,
              signal: offer,
            });
          }
        } catch (err) {
          console.error("[useVoiceCall] ICE restart error for peer:", targetPeerUid, err);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected") {
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
              void attemptPeerReconnect();
            }
          }, 2000);
        } else if (pc.iceConnectionState === "failed") {
          void attemptPeerReconnect();
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          reconnectAttemptsRef.current = 0;
          setIsReconnecting(false);
        }
        if (pc.iceConnectionState === "checking" && pc.iceGatheringState === "complete") {
          setTimeout(() => {
            if (pc.iceConnectionState === "checking") {
              void attemptPeerReconnect();
            }
          }, 3000);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          const alreadyActive = callStateRef.current === "active";
          setCallState("active");
          setIsVoiceWindowOpen(true);
          setIsReconnecting(false);
          reconnectAttemptsRef.current = 0;
          if (!alreadyActive) {
            playRingtone("connect");
          }
          notify("Chamada de voz conectada!", "success");
          if (!callDurationTimerRef.current) {
            callDurationTimerRef.current = window.setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }
        } else if (pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          remoteStreamsRef.current.delete(targetPeerUid);
          remoteScreenStreamsRef.current.delete(targetPeerUid);
          remoteScreenSharingPeersRef.current.delete(targetPeerUid);
          setRemoteStreams(new Map(remoteStreamsRef.current));
          setRemoteScreenStreams(new Map(remoteScreenStreamsRef.current));
          setIsRemoteSharingScreen(Array.from(remoteScreenSharingPeersRef.current.values()).some(Boolean));
          if (sessionRef.current?.friendUid === targetPeerUid || peerConnectionsRef.current.size <= 1) {
            setRemoteStream(null);
          }
          setRemoteStatesMap((prev) => {
            const next = new Map(prev);
            next.delete(targetPeerUid);
            return next;
          });
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: (prev.participants || []).filter((p) => p.uid !== targetPeerUid),
              friendUid: prev.friendUid === targetPeerUid ? undefined : prev.friendUid,
            };
          });
        } else if (pc.connectionState === "failed") {
          void attemptPeerReconnect();
        }
      };

      return pc;
    },
    [notify, playRingtone, setupVoiceAnalyzer, user?.uid],
  );

  // Unified Session Handlers Builder (Elimina duplicação e aplica autorização estrita)
  const createUnifiedSessionHandlers = useCallback(
    (chatId: string) => ({
      onAnswer: async (answerPayload: CallAnswerPayload) => {
        if (answerPayload.accepted) {
          setCallState("connecting");
          if (audioRingIntervalRef.current) {
            clearInterval(audioRingIntervalRef.current);
            audioRingIntervalRef.current = null;
          }

          // If using LiveKit SFU as primary, we don't need P2P mesh offer
          // Media is handled by LiveKit; only call control signaling goes through Supabase
          const useLiveKitPrimary = useLiveKitPrimaryRef.current && livekitConnectedRef.current;

          // Send fresh WebRTC SDP offer to callee now that callee is active & subscribed
          // ONLY if NOT using LiveKit as primary transport
          const targetPeerUid = answerPayload.responderId || sessionRef.current?.friendUid;
          if (targetPeerUid && user?.uid && !useLiveKitPrimary) {
            try {
              const pc = await createPeerConnectionForPeer(chatId, targetPeerUid, true);
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              await sendCallSignal(chatId, {
                senderId: user.uid,
                chatId,
                targetUid: targetPeerUid,
                signal: offer,
              });
            } catch (offerErr) {
              console.error("[useVoiceCall] Error sending WebRTC offer onAnswer:", offerErr);
            }
          }

          // Connect to LiveKit SFU if not already connected (for 1:1 calls where initiator connects first)
          if (user?.uid && !livekitConnectedRef.current) {
            const displayName = userProfile?.displayName || user.displayName || "Jogador";
            const avatarUrl = userProfile?.photoURL || user.photoURL || undefined;
            try {
              await connectLiveKitRoom(chatId, user.uid, displayName, avatarUrl);
            } catch (lkErr) {
              console.warn("[LiveKit] SFU connect fallback onAnswer:", lkErr);
            }
          }

          setCallState("active");
          setIsVoiceWindowOpen(true);
          playRingtone("connect");
          if (!callDurationTimerRef.current) {
            callDurationTimerRef.current = window.setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }

          if (user?.uid) {
            void sendCallState(chatId, {
              senderId: user.uid,
              chatId,
              isMuted,
              isDeafened,
              isCameraOn,
              isSharingScreen,
            });
          }
        } else {
          notify("O usuário recusou a chamada.", "info");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
      onSignal: async ({ senderId, signal }: CallSignalPayload) => {
        if (!senderId || !signal) return;
        const pc = peerConnectionsRef.current.get(senderId) || (await createPeerConnectionForPeer(chatId, senderId, false));

        if ("sdp" in signal && signal.type) {
          const sdpInit = signal as RTCSessionDescriptionInit;
          if (["offer", "answer", "pranswer", "rollback"].includes(sdpInit.type) && pc.signalingState !== "closed") {
            try {
              const isOffer = sdpInit.type === "offer";
              const isCollision = isOffer && pc.signalingState !== "stable";

              if (isCollision) {
                // Deterministic tie-breaking: peer with lexicographically higher UID is polite and yields
                const isPolite = (user?.uid || "") > senderId;
                if (!isPolite) {
                  console.warn("[WebRTC] Offer collision: impolite peer ignoring remote offer from", senderId);
                  return;
                }
                console.warn("[WebRTC] Offer collision: polite peer rolling back local offer to accept remote offer from", senderId);
                await pc.setLocalDescription({ type: "rollback" });
              }

              await pc.setRemoteDescription(new RTCSessionDescription(sdpInit));

              // Flush pending ICE candidates for this peer
              const pending = pendingCandidatesRef.current.get(senderId) || [];
              for (const cand of pending) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch { }
              }
              pendingCandidatesRef.current.delete(senderId);

              if (sdpInit.type === "offer") {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (user?.uid) {
                  await sendCallSignal(chatId, {
                    senderId: user.uid,
                    chatId,
                    targetUid: senderId,
                    signal: answer,
                  });
                }
              }
            } catch (err) {
              console.error("[WebRTC] Error processing SDP signal from", senderId, err);
            }
          }
        } else if ("candidate" in signal && (signal as any).candidate) {
          const cand = (signal as any).candidate;
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch { }
          } else {
            const list = pendingCandidatesRef.current.get(senderId) || [];
            list.push(cand);
            pendingCandidatesRef.current.set(senderId, list);
          }
        }
      },
      onState: (remoteState: CallStatePayload) => {
        setRemoteStatesMap((prev) => {
          const updated = new Map(prev);
          updated.set(remoteState.senderId, { ...(updated.get(remoteState.senderId) || {}), ...remoteState });
          return updated;
        });

        if (typeof remoteState.isSpeaking === "boolean") {
          setRemoteSpeakingStates((prev) => {
            const updated = new Map(prev);
            updated.set(remoteState.senderId, remoteState.isSpeaking!);
            return updated;
          });
        }
        if (typeof remoteState.isMuted === "boolean") {
          setIsRemoteMuted(remoteState.isMuted);
        }
        if (typeof remoteState.isDeafened === "boolean") {
          setIsRemoteDeafened(remoteState.isDeafened);
        }
        if (typeof remoteState.isCameraOn === "boolean") {
          setIsRemoteCameraOn(remoteState.isCameraOn);
        }
        if (typeof remoteState.isSharingScreen === "boolean") {
          // Prefer LiveKit per-peer map when available; still merge signal into remoteStatesMap above.
          // For P2P / signal-only, update global flag carefully so one peer ending does not clear others.
          remoteScreenSharingPeersRef.current.set(remoteState.senderId, remoteState.isSharingScreen);
          const anySharing = Array.from(remoteScreenSharingPeersRef.current.values()).some(Boolean);
          setIsRemoteSharingScreen((prev) => {
            if (prev !== anySharing) {
              playSfx(anySharing ? sfxStreamStart : sfxStreamEnd);
            }
            return anySharing;
          });
        }
      },
      onMemberJoined: async (joined: CallMemberJoinedPayload) => {
        if (joined.uid === user?.uid) return;
        notify(`${joined.name} entrou na chamada.`, "info");
        playRingtone("connect");

        setSession((prev) => {
          if (!prev) return prev;
          const current = prev.participants || [];
          if (current.some((p) => p.uid === joined.uid)) return prev;
          return {
            ...prev,
            participants: [
              ...current,
              { uid: joined.uid, name: joined.name, avatar: joined.avatar || undefined },
            ],
            friendUid: prev.friendUid || joined.uid,
          };
        });

        if (user?.uid) {
          void sendCallAnswer(chatId, joined.uid, {
            responderId: user.uid,
            accepted: true,
            chatId,
          });
          void sendCallState(chatId, {
            senderId: user.uid,
            chatId,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
            isSharingScreen: screenStreamRef.current !== null,
            isCameraOn: cameraStreamRef.current !== null,
          });
        }

        // Only create P2P mesh peer connection if NOT using LiveKit SFU as primary
        const useLiveKitPrimary = useLiveKitPrimaryRef.current && livekitConnectedRef.current;
        if (user?.uid && joined.uid !== user.uid && !useLiveKitPrimary) {
          await createPeerConnectionForPeer(chatId, joined.uid, false);
        }
      },
      onMemberLeft: (left: CallMemberLeftPayload) => {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: (prev.participants || []).filter((p) => p.uid !== left.uid),
            friendUid: prev.friendUid === left.uid ? undefined : prev.friendUid,
          };
        });

        const pc = peerConnectionsRef.current.get(left.uid);
        if (pc) {
          try {
            pc.close();
          } catch { }
          peerConnectionsRef.current.delete(left.uid);
        }
        remoteStreamsRef.current.delete(left.uid);
        remoteScreenStreamsRef.current.delete(left.uid);
        remoteScreenSharingPeersRef.current.delete(left.uid);
        setRemoteStreams(new Map(remoteStreamsRef.current));
        setRemoteScreenStreams(new Map(remoteScreenStreamsRef.current));
        setIsRemoteSharingScreen(Array.from(remoteScreenSharingPeersRef.current.values()).some(Boolean));
        if (sessionRef.current?.friendUid === left.uid || peerConnectionsRef.current.size === 0) {
          setRemoteStream(null);
        }

        const pipeline = remotePipelinesRef.current.get(left.uid);
        if (pipeline) {
          destroyAudioPipeline(pipeline);
          remotePipelinesRef.current.delete(left.uid);
        }

        setRemoteSpeakingStates((prev) => {
          const updated = new Map(prev);
          updated.delete(left.uid);
          return updated;
        });

        setRemoteStatesMap((prev) => {
          const updated = new Map(prev);
          updated.delete(left.uid);
          return updated;
        });

        setActiveCallsByFriend((prev) => {
          const updated = new Map(prev);
          updated.delete(left.uid);
          return updated;
        });

        if (peerConnectionsRef.current.size === 0) {
          notify("O participante se desconectou.", "info");
          playRingtone("disconnect");
        } else {
          notify("Um participante saiu da chamada.", "info");
          playRingtone("disconnect");
        }
      },
      onKicked: (kick: CallKickPayload) => {
        // Validação de autorização: apenas aceita kick se vier do host registrado
        const currentHost = sessionRef.current?.hostUid || (sessionRef.current?.isInitiator ? user?.uid : sessionRef.current?.friendUid);
        if (kick.adminId === currentHost || !currentHost) {
          notify(kick.reason || "Você foi expulso da sala pelo administrador.", "error");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
      onPrivacy: (privacy: CallPrivacyPayload) => {
        setRoomConfig((prev) => ({
          roomName: privacy.roomName || prev?.roomName || "Canal de Voz",
          category: privacy.category || prev?.category || "resenha_games",
          isPrivate: privacy.isPrivate,
          password: privacy.password,
        }));
        setSession((prev) =>
          prev
            ? {
              ...prev,
              isPrivate: privacy.isPrivate,
              password: privacy.password,
              category: privacy.category || prev.category,
              roomName: privacy.roomName || prev.roomName,
            }
            : null,
        );
        notify(
          privacy.isPrivate ? "🔒 A sala agora é privada." : "🔓 A sala agora é pública.",
          "info",
        );
      },
      onEnd: (endPayload: CallEndPayload) => {
        setActiveCallsByFriend((prev) => {
          const next = new Map(prev);
          for (const [fUid, cId] of next.entries()) {
            if (cId === endPayload.chatId || fUid === endPayload.senderId) {
              next.delete(fUid);
            }
          }
          return next;
        });
        notify(
          endPayload.reason === "busy"
            ? "O usuário está em outra chamada."
            : "Chamada encerrada.",
          "info",
        );
        playRingtone("disconnect");
        cleanUpCall();
      },
    }),
    [cleanUpCall, createPeerConnectionForPeer, notify, playRingtone, user?.uid],
  );

  // Incoming call listener on user_calls_${myUid}
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserIncomingCalls(user.uid, {
      onInvite: (invite) => {
        const inviteKey = `${invite.chatId}:${invite.callerId}:${invite.timestamp}`;
        const now = Date.now();
        if (
          lastProcessedInviteKeyRef.current === inviteKey ||
          (now - lastInviteTimestampRef.current < 3000 && lastProcessedInviteKeyRef.current.startsWith(invite.chatId))
        ) {
          return;
        }
        lastProcessedInviteKeyRef.current = inviteKey;
        lastInviteTimestampRef.current = now;

        if (callStateRef.current === "idle") {
          setIncomingInvite(invite);
          setCallState("ringing-in");
          playRingtone("call");

          if (incomingTimeoutTimerRef.current) window.clearTimeout(incomingTimeoutTimerRef.current);
          incomingTimeoutTimerRef.current = window.setTimeout(() => {
            if (callStateRef.current === "ringing-in") {
              stopRingtone();
              setIncomingInvite(null);
              setCallState("idle");
              notify(`Chamada perdida de ${invite.callerName}.`, "info");
              playRingtone("disconnect");
            }
          }, 35000);
        } else if (sessionRef.current?.chatId === invite.chatId) {
          // O amigo está reconectando na mesma chamada em que já estamos!
          // Auto-aceita e confirma a chamada para restabelecer a conexão imediatamente
          void sendCallAnswer(invite.chatId, invite.callerId, {
            responderId: user.uid,
            accepted: true,
            chatId: invite.chatId,
          });
        } else {
          void sendCallEnd(invite.chatId, invite.callerId, {
            senderId: user.uid,
            chatId: invite.chatId,
            reason: "busy",
          });
        }
      },
      onEnd: () => {
        if (callStateRef.current !== "idle") {
          notify("Chamada finalizada.", "info");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [cleanUpCall, notify, playRingtone, stopRingtone, user?.uid]);

  // INITIATE CALL (1:1 Friend Call) - LiveKit SFU Primary
  const startCall = useCallback(
    async (friend: SocialFriend, withVideo = false) => {
      if (!user?.uid) return;
      if (callState !== "idle") {
        cleanUpCall();
      }
      const friendUid = String(friend.id || "").replace(/^cp-friend:/, "").trim();
      const chatId = getChatId(user.uid, friendUid);

      try {
        setCallState("ringing-out");
        setIsVoiceWindowOpen(true);
        setSession({
          chatId,
          friendUid,
          friendName: friend.name,
          friendAvatar: friend.avatar,
          hostUid: user.uid,
          isInitiator: true,
          startedAt: Date.now(),
        });

        try {
          sessionStorage.setItem("checkpoint_last_voice_session", JSON.stringify({
            chatId,
            friendUid,
            friendName: friend.name,
            hasVideo: withVideo,
            timestamp: Date.now(),
          }));
        } catch { }

        const rawAudioStream = await acquireAudioStream();
        if (rawAudioStream) {
          const processedStream = await applyAudioProcessingChain(rawAudioStream);
          localStreamRef.current = processedStream;
          setLocalStream(processedStream);
          setupVoiceAnalyzer(processedStream, true);
          if (inputMode === "push-to-talk") {
            const track = processedStream.getAudioTracks()[0];
            if (track) track.enabled = false;
            const raw = rawStreamRef.current?.getAudioTracks()[0];
            if (raw && raw !== track) raw.enabled = false;
          }
        } else {
          setIsMuted(true);
        }

        let actualWithVideo = false;
        if (withVideo) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideoInput = devices.some((d) => d.kind === "videoinput");
            if (hasVideoInput) {
              const camStream = await navigator.mediaDevices.getUserMedia({
                video: selectedVideoInput !== "default" ? { deviceId: { exact: selectedVideoInput } } : true,
                audio: false,
              });
              cameraStreamRef.current = camStream;
              setLocalCameraStream(camStream);
              setIsCameraOn(true);
              actualWithVideo = true;
            } else {
              notify("Nenhuma câmera detectada. Iniciando chamada de voz.", "info");
            }
          } catch (camErr) {
            console.warn("[startCall] Camera acquisition fallback:", camErr);
            notify("Não foi possível acessar a câmera. Iniciando apenas por voz.", "info");
          }
        }

        // ICE Preflight Check + LiveKit SFU connection — run in PARALLEL to reduce setup latency
        const displayName = userProfile?.displayName || user.displayName || "Jogador";
        const avatarUrl = userProfile?.photoURL || user.photoURL || undefined;
        let livekitConnected = false;

        const [preflightResult, livekitResult] = await Promise.allSettled([
          runIcePreflightCheck(),
          connectLiveKitRoom(chatId, user.uid, displayName, avatarUrl),
        ]);

        if (preflightResult.status === "fulfilled" && !preflightResult.value.success) {
          console.warn("[ICE Preflight] Warning:", preflightResult.value.error);
        }

        if (livekitResult.status === "fulfilled") {
          livekitConnected = true;
          useLiveKitPrimaryRef.current = true;
          setMediaTransport("livekit");
        } else {
          console.warn("[LiveKit] SFU connection failed, falling back to P2P mesh:", livekitResult.reason);
          useLiveKitPrimaryRef.current = false;
          setMediaTransport("p2p");
        }

        // Subscribe to call session for SIGNALING only (call control: mute, hangup, etc.)
        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(
          chatId,
          user.uid,
          createUnifiedSessionHandlers(chatId),
        );

        await sendCallInvite(friendUid, {
          callerId: user.uid,
          callerName: userProfile?.displayName || user.displayName || "Jogador",
          callerAvatar: userProfile?.photoURL || user.photoURL || null,
          chatId,
          hasVideo: actualWithVideo,
          timestamp: Date.now(),
        });

        // Notifica a sala caso o participante já esteja nela aguardando
        await sendCallMemberJoined(chatId, {
          uid: user.uid,
          name: displayName,
          avatar: avatarUrl || null,
          chatId,
        });

        // If LiveKit failed, fall back to P2P mesh for media
        if (!livekitConnected) {
          const pc = await createPeerConnectionForPeer(chatId, friendUid, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await sendCallSignal(chatId, {
            senderId: user.uid,
            chatId,
            targetUid: friendUid,
            signal: offer,
          });
        }

        playRingtone("ringout");
        audioRingIntervalRef.current = window.setInterval(() => {
          playRingtone("ringout");
        }, 3000);

        ringoutTimerRef.current = window.setTimeout(() => {
          if (callStateRef.current === "ringing-out") {
            notify(`${friend.name} não atendeu.`, "info");
            playRingtone("disconnect");
            void sendCallEnd(chatId, friendUid, {
              senderId: user.uid,
              chatId,
              reason: "timeout",
            });
            cleanUpCall();
          }
        }, 35000);
      } catch (err: any) {
        console.error("[useVoiceCall] startCall failed", err);
        notify(err?.message || "Não foi possível iniciar a chamada.", "error");
        cleanUpCall();
      }
    },
    [acquireAudioStream, applyAudioProcessingChain, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, inputMode, notify, playRingtone, selectedVideoInput, setupVoiceAnalyzer, user, userProfile],
  );

  // ANSWER CALL (Callee 1:1) - LiveKit SFU Primary
  const answerCall = useCallback(async () => {
    stopRingtone();
    if (callDurationTimerRef.current) {
      window.clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }
    const invite = incomingInvite || incomingInviteRef.current;
    const currentState = callStateRef.current || callState;
    if (!user?.uid || !invite) {
      console.warn("[useVoiceCall] answerCall canceled: missing user or invite", { uid: user?.uid, invite, currentState });
      return;
    }
    const { callerId, callerName, callerAvatar, chatId, hasVideo } = invite;

    try {
      if (audioRingIntervalRef.current) {
        clearInterval(audioRingIntervalRef.current);
        audioRingIntervalRef.current = null;
      }

      setCallState("connecting");
      setIsVoiceWindowOpen(true);
      setSession({
        chatId,
        friendUid: callerId,
        friendName: callerName,
        friendAvatar: callerAvatar || undefined,
        hostUid: callerId,
        isInitiator: false,
        startedAt: Date.now(),
      });

      const localTest = isLocalTestCall(chatId, callerId);

      // Notifica imediatamente quem chamou que o convite foi aceito (Feedback instantâneo de "Conectando...")
      if (!localTest) {
        void sendCallAnswer(chatId, callerId, {
          responderId: user.uid,
          accepted: true,
          chatId,
        });
      }

      try {
        sessionStorage.setItem("checkpoint_last_voice_session", JSON.stringify({
          chatId,
          friendUid: callerId,
          friendName: callerName,
          hasVideo: Boolean(hasVideo),
          timestamp: Date.now(),
        }));
      } catch { }

      const rawAudioStream = await acquireAudioStream();
      if (rawAudioStream) {
        const processedStream = await applyAudioProcessingChain(rawAudioStream);
        localStreamRef.current = processedStream;
        setLocalStream(processedStream);
        setupVoiceAnalyzer(processedStream, true);
        if (inputMode === "push-to-talk") {
          const track = processedStream.getAudioTracks()[0];
          if (track) track.enabled = false;
          const raw = rawStreamRef.current?.getAudioTracks()[0];
          if (raw && raw !== track) raw.enabled = false;
        }
      } else {
        setIsMuted(true);
      }

      // If incoming call was video, try to activate local camera automatically if available
      if (hasVideo) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasVideoInput = devices.some((d) => d.kind === "videoinput");
          if (hasVideoInput) {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: selectedVideoInput !== "default" ? { deviceId: { exact: selectedVideoInput } } : true,
              audio: false,
            });
            cameraStreamRef.current = camStream;
            setLocalCameraStream(camStream);
            setIsCameraOn(true);
          }
        } catch {
          // Ignore camera fallback for callee
        }
      }

      // ICE Preflight + LiveKit SFU connection rodando em paralelo para conexão rápida
      const displayName = userProfile?.displayName || user.displayName || "Jogador";
      const avatarUrl = userProfile?.photoURL || user.photoURL || undefined;
      let livekitConnected = false;

      if (localTest) {
        useLiveKitPrimaryRef.current = false;
        setMediaTransport("echo");
        const processed = localStreamRef.current;
        if (processed) {
          setRemoteStream(processed);
          remoteStreamsRef.current.set(callerId, processed);
          setRemoteStreams(new Map(remoteStreamsRef.current));
          setupVoiceAnalyzer(processed, false, callerId);
        }
      } else {
        const [preflightResult, livekitResult] = await Promise.allSettled([
          runIcePreflightCheck(),
          connectLiveKitRoom(chatId, user.uid, displayName, avatarUrl),
        ]);

        if (preflightResult.status === "fulfilled" && !preflightResult.value.success) {
          console.warn("[ICE Preflight] Warning:", preflightResult.value.error);
        }

        if (livekitResult.status === "fulfilled") {
          livekitConnected = true;
          useLiveKitPrimaryRef.current = true;
          setMediaTransport("livekit");
        } else {
          console.warn("[LiveKit] SFU connection failed, falling back to P2P mesh:", livekitResult.reason);
          useLiveKitPrimaryRef.current = false;
          setMediaTransport("p2p");
        }

        // Subscribe to call session for SIGNALING only (call control: mute, hangup, etc.)
        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(
          chatId,
          user.uid,
          createUnifiedSessionHandlers(chatId),
        );

        // If LiveKit failed, fall back to P2P mesh for media
        if (!livekitConnected) {
          await createPeerConnectionForPeer(chatId, callerId, false);
        }
      }

      setCallState("active");
      setIsVoiceWindowOpen(true);
      playRingtone("connect");
      if (!callDurationTimerRef.current) {
        callDurationTimerRef.current = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }

      if (user?.uid && !localTest) {
        void sendCallState(chatId, {
          senderId: user.uid,
          chatId,
          isMuted,
          isDeafened,
          isCameraOn,
          isSharingScreen,
        });
      }

      setIncomingInvite(null);
    } catch (err: any) {
      console.error("[useVoiceCall] answerCall failed", err);
      notify("Erro ao atender chamada.", "error");
      cleanUpCall();
    }
  }, [acquireAudioStream, applyAudioProcessingChain, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, incomingInvite, inputMode, notify, playRingtone, selectedVideoInput, setupVoiceAnalyzer, stopRingtone, user, userProfile]);

  // JOIN ROOM (Persistente / Multi-Participante)
  const joinRoom = useCallback(
    async (roomId: string, password?: string) => {
      if (!user?.uid || callState !== "idle") return;

      try {
        setCallState("connecting");
        const displayName = userProfile?.displayName || user.displayName || "Jogador";
        const avatarUrl = userProfile?.photoURL || user.photoURL || undefined;

        const joinResult = await joinVoiceRoom(roomId, {
          password,
          displayName,
          avatarUrl,
        });

        const room = joinResult.room;
        const otherParticipants = joinResult.participants.filter((p) => p.uid !== user.uid);

        setSession({
          chatId: room.id,
          friendUid: room.hostUid,
          friendName: room.name,
          hostUid: room.hostUid,
          isInitiator: room.hostUid === user.uid,
          startedAt: Date.now(),
          category: room.category,
          roomName: room.name,
          isPrivate: room.isPrivate,
          participants: joinResult.participants.map((p) => ({
            uid: p.uid,
            name: p.name,
            avatar: p.avatar || undefined,
          })),
        });

        setRoomConfig({
          roomName: room.name,
          category: room.category,
          isPrivate: room.isPrivate,
        });

        const rawAudioStream = await acquireAudioStream();
        if (rawAudioStream) {
          const processedStream = await applyAudioProcessingChain(rawAudioStream);
          localStreamRef.current = processedStream;
          setLocalStream(processedStream);
          setupVoiceAnalyzer(processedStream, true);
          if (inputMode === "push-to-talk") {
            const track = processedStream.getAudioTracks()[0];
            if (track) track.enabled = false;
            const raw = rawStreamRef.current?.getAudioTracks()[0];
            if (raw && raw !== track) raw.enabled = false;
          }
        } else {
          setIsMuted(true);
        }

        // ICE Preflight Check for rooms
        const preflight = await runIcePreflightCheck();
        if (!preflight.success) {
          console.warn("[ICE Preflight] Warning:", preflight.error);
        }

        // Connect to LiveKit SFU FIRST (primary transport for rooms)
        let livekitConnected = false;
        try {
          await connectLiveKitRoom(room.id, user.uid, displayName, avatarUrl);
          livekitConnected = true;
          useLiveKitPrimaryRef.current = true;
          setMediaTransport("livekit");
        } catch (lkErr) {
          console.warn("[LiveKit] SFU connection failed, falling back to P2P mesh:", lkErr);
          useLiveKitPrimaryRef.current = false;
          setMediaTransport("p2p");
        }

        // Subscribe to call session for SIGNALING only (call control: mute, hangup, etc.)
        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(
          room.id,
          user.uid,
          createUnifiedSessionHandlers(room.id),
        );

        // Notifica a sala que entramos
        await sendCallMemberJoined(room.id, {
          uid: user.uid,
          name: displayName,
          avatar: avatarUrl || null,
          chatId: room.id,
        });

        // If LiveKit failed, fall back to P2P mesh for media
        if (!livekitConnected) {
          for (const peer of otherParticipants) {
            const pc = await createPeerConnectionForPeer(room.id, peer.uid, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendCallSignal(room.id, {
              senderId: user.uid,
              chatId: room.id,
              targetUid: peer.uid,
              signal: offer,
            });
          }
        }

        setCallState("active");
        setIsVoiceWindowOpen(true);
        playRingtone("connect");

        if (!callDurationTimerRef.current) {
          callDurationTimerRef.current = window.setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }

        notify(`Conectado à sala "${room.name}"!`, "success");
      } catch (err: any) {
        console.error("[useVoiceCall] joinRoom failed:", err);
        notify(err?.message || "Não foi possível entrar na sala de voz.", "error");
        cleanUpCall();
      }
    },
    [acquireAudioStream, applyAudioProcessingChain, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, inputMode, notify, playRingtone, setupVoiceAnalyzer, user, userProfile],
  );

  // CREATE AND JOIN ROOM (Criação de Sala Persistente)
  const createAndJoinRoom = useCallback(
    async (config: CallRoomConfig | { name?: string; roomName?: string; category?: RoomCategory; isPrivate?: boolean; password?: string; icon?: string; avatarUrl?: string; themeColor?: string }) => {
      try {
        const newRoom = await createVoiceRoom(config);
        // Host já é isento da senha no servidor; não enviar flags de confiança do cliente.
        await joinRoom(newRoom.id, config.password);
      } catch (err: any) {
        console.error("[useVoiceCall] createAndJoinRoom failed:", err);
        notify(err?.message || "Erro ao criar canal de voz.", "error");
      }
    },
    [joinRoom, notify],
  );

  // REJECT CALL
  const rejectCall = useCallback(async () => {
    stopRingtone();
    if (!user?.uid || !incomingInvite) return;
    const { callerId, chatId } = incomingInvite;

    if (!isLocalTestCall(chatId, callerId)) {
      await sendCallAnswer(chatId, callerId, {
        responderId: user.uid,
        accepted: false,
        chatId,
      });
    }

    playRingtone("disconnect");
    cleanUpCall();
  }, [cleanUpCall, incomingInvite, playRingtone, stopRingtone, user?.uid]);

  // HANGUP / DISCONNECT - User leaves the call but call stays active for others
  const hangUp = useCallback(async () => {
    stopRingtone();
    try {
      sessionStorage.removeItem("checkpoint_last_voice_session");
    } catch { }
    setPendingReconnectSession(null);

    const hasRemotePeers = peerConnectionsRef.current.size > 0 || (session?.participants && session.participants.length > 1);

    if (session && user?.uid) {
      if (hasRemotePeers && session.friendUid) {
        setActiveCallsByFriend((prev) => new Map(prev).set(session.friendUid!, session.chatId));
      } else {
        setActiveCallsByFriend((prev) => {
          const next = new Map(prev);
          if (session.friendUid) next.delete(session.friendUid);
          return next;
        });
      }
      if (!isLocalTestCall(session.chatId, session.friendUid)) {
        await sendCallMemberLeft(session.chatId, {
          uid: user.uid,
          chatId: session.chatId,
        });
      }
    } else {
      setActiveCallsByFriend(new Map());
    }
    playRingtone("disconnect");
    cleanUpCall();
  }, [cleanUpCall, playRingtone, session, stopRingtone, user?.uid]);

  // END CALL FOR EVERYONE - Host/admin terminates the call completely
  const endCallForEveryone = useCallback(async () => {
    stopRingtone();
    try {
      sessionStorage.removeItem("checkpoint_last_voice_session");
    } catch { }
    setPendingReconnectSession(null);
    setActiveCallsByFriend(new Map());

    if (session && user?.uid && !isLocalTestCall(session.chatId, session.friendUid)) {
      await sendCallEnd(session.chatId, "room-all", {
        senderId: user.uid,
        chatId: session.chatId,
        reason: "hangup",
      });
      await sendCallMemberLeft(session.chatId, {
        uid: user.uid,
        chatId: session.chatId,
      });
    }
    playRingtone("disconnect");
    cleanUpCall();
  }, [cleanUpCall, playRingtone, session, stopRingtone, user?.uid]);

  // RECONNECT TO LAST SESSION
  const reconnectCall = useCallback(async () => {
    if (!pendingReconnectSession || !user?.uid) return;
    const targetSession = { ...pendingReconnectSession };
    setPendingReconnectSession(null);
    try {
      sessionStorage.removeItem("checkpoint_last_voice_session");
    } catch { }

    const fakeFriend: SocialFriend = {
      id: `cp-friend:${targetSession.friendUid}`,
      name: targetSession.friendName,
      avatar: "",
      status: "online",
      source: "checkpoint",
    };
    await startCall(fakeFriend, Boolean(targetSession.hasVideo));
  }, [pendingReconnectSession, startCall, user?.uid]);

  const dismissReconnect = useCallback(() => {
    setPendingReconnectSession(null);
    try {
      sessionStorage.removeItem("checkpoint_last_voice_session");
    } catch { }
  }, []);

  // MUTE / UNMUTE
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const nextEnabled = !audioTrack.enabled;
      setOutgoingMicEnabled(nextEnabled);
      const nextMuted = !nextEnabled;
      setIsMuted(nextMuted);
      playSfx(nextMuted ? sfxMute : sfxUnmute);

      if (session?.chatId && user?.uid) {
        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isMuted: nextMuted,
          isDeafened: isDeafened,
        });
      }
    }
  }, [isDeafened, session?.chatId, user?.uid, playSfx, sfxMute, sfxUnmute, sendCallState, setOutgoingMicEnabled]);

  // DEAFEN / UNDEAFEN (MUTE ALL / SOM & MIC)
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const nextDeafened = !prev;
      playSfx(nextDeafened ? sfxFullMute : sfxUndeafen);
      if (nextDeafened) {
        setIsMuted(true);
        setOutgoingMicEnabled(false);
      }

      if (session?.chatId && user?.uid) {
        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isDeafened: nextDeafened,
          isMuted: nextDeafened ? true : isMutedRef.current,
        });
      }

      return nextDeafened;
    });
  }, [session?.chatId, setOutgoingMicEnabled, user?.uid]);

  // TOGGLE CAMERA
  const toggleCamera = useCallback(async () => {
    if (!session?.chatId) return;

    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setLocalCameraStream(null);

      if (livekitVideoPubRef.current && livekitRoomRef.current?.localParticipant) {
        try {
          if (livekitVideoPubRef.current.track) {
            void livekitRoomRef.current.localParticipant.unpublishTrack(livekitVideoPubRef.current.track);
          }
        } catch { }
        livekitVideoPubRef.current = null;
      }

      // Remove video track from all peers
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && !isSharingScreen) {
          try {
            pc.removeTrack(sender);
          } catch { }
        }
      });

      setIsCameraOn(false);
      if (session.chatId && user?.uid) {
        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isCameraOn: false,
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedVideoInput !== "default" ? { exact: selectedVideoInput } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setLocalCameraStream(stream);
        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack && livekitRoomRef.current?.localParticipant) {
          try {
            const pub = await livekitRoomRef.current.localParticipant.publishTrack(videoTrack, {
              name: "camera",
              source: LiveKitTrack.Source.Camera,
            });
            livekitVideoPubRef.current = pub;
          } catch (lkErr) {
            console.warn("[LiveKit] Camera track publish note:", lkErr);
          }
        }

        if (isLocalTestCall(session.chatId, session.friendUid)) {
          setRemoteStream(stream);
          setIsCameraOn(true);
          return;
        }

        // Add track to all peers and renegotiate
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (user?.uid) {
            await sendCallSignal(session.chatId, {
              senderId: user.uid,
              chatId: session.chatId,
              targetUid: peerId,
              signal: offer,
            });
          }
        }

        setIsCameraOn(true);
        if (session.chatId && user?.uid) {
          void sendCallState(session.chatId, {
            senderId: user.uid,
            chatId: session.chatId,
            isCameraOn: true,
          });
        }
      } catch (err) {
        console.error("[useVoiceCall] toggleCamera error", err);
        notify("Não foi possível acessar a câmera.", "error");
      }
    }
  }, [isCameraOn, isSharingScreen, notify, selectedVideoInput, session?.chatId, session?.friendUid, user?.uid]);

  // START SCREEN SHARE (Otimizado para até 1080p 60fps com LiveKit SFU)
  const startScreenShare = useCallback(
    async (opts?: string | ScreenShareOptions) => {
      if (!session?.chatId) return;

      const options: ScreenShareOptions = typeof opts === "string" ? { sourceId: opts } : opts || {};
      const { fps, width, height, bitrate } = screenShareProfile(options);
      const includeAudio = options.withAudio !== false;
      const videoConstraints = screenShareVideoConstraints(width, height, fps);
      setIsScreenPickerOpen(false);

      try {
        let screenStream: MediaStream;

        // WebView2 cannot bind a custom picker source to Chromium capture.
        // GDI→JPEG→canvas was dropping the cursor, missing the chosen FPS and stuttering.
        // Native getDisplayMedia uses DXGI/WGC: cursor, audio loopback, and real frame pacing.
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: includeAudio
              ? ({
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                restrictOwnAudio: true,
              } as MediaTrackConstraints)
              : false,
          });
        } catch (displayErr) {
          if (includeAudio) {
            console.warn("[useVoiceCall] getDisplayMedia with audio failed; retrying video-only:", displayErr);
            screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: videoConstraints,
              audio: false,
            });
            notify("Áudio do sistema indisponível; compartilhando apenas o vídeo.", "info");
          } else {
            throw displayErr;
          }
        }

        screenStreamRef.current = screenStream;
        setLocalScreenStream(screenStream);
        const videoTrack = screenStream.getVideoTracks()[0];
        let screenAudioTrack = screenStream.getAudioTracks()[0];
        screenVideoTrackRef.current = videoTrack || null;
        screenAudioTrackRef.current = screenAudioTrack || null;
        screenShareStoppingRef.current = false;

        if (!videoTrack) {
          throw new Error("Screen capture returned no video track");
        }

        try {
          await videoTrack.applyConstraints(videoConstraints);
        } catch (constraintErr) {
          console.warn("[useVoiceCall] applyConstraints on screen track failed:", constraintErr);
        }

        (videoTrack as MediaStreamTrack & { contentHint?: string }).contentHint =
          fps >= 60 ? "motion" : "detail";

        const captureSettings = videoTrack.getSettings();
        console.info("[useVoiceCall] Screen capture settings", {
          width: captureSettings.width,
          height: captureSettings.height,
          frameRate: captureSettings.frameRate,
          contentHint: (videoTrack as MediaStreamTrack & { contentHint?: string }).contentHint,
        });

        // Barreira ativa para isolar o áudio da chamada da transmissão de tela
        if (includeAudio && screenAudioTrack && options.callAudioBarrier !== false) {
          try {
            if (screenBarrierRef.current) {
              screenBarrierRef.current.destroy();
              screenBarrierRef.current = null;
            }
            const barrier = createCallAudioBarrier(screenAudioTrack, () => {
              const streams: MediaStream[] = [];
              if (remoteStreamsRef.current) {
                remoteStreamsRef.current.forEach((st) => {
                  if (st && st.getAudioTracks().length > 0) streams.push(st);
                });
              }
              if (remoteScreenStreamsRef.current) {
                remoteScreenStreamsRef.current.forEach((st) => {
                  if (st && st.getAudioTracks().length > 0) streams.push(st);
                });
              }
              return streams;
            });
            screenAudioTrack = barrier.processedTrack;
            screenAudioTrackRef.current = screenAudioTrack;
            screenBarrierRef.current = barrier;
          } catch (barrierErr) {
            console.warn("[useVoiceCall] CallAudioBarrier init error:", barrierErr);
          }
        }

        if (isLocalTestCall(session.chatId, session.friendUid)) {
          if (screenAudioTrack) {
            screenAudioTrack.enabled = false;
          }
          setIsSharingScreen(true);
          setIsScreenPickerOpen(false);
          playSfx(sfxStreamStart);
          videoTrack.onended = () => {
            void stopScreenShare();
          };
          return;
        }

        const useLiveKitPrimary = useLiveKitPrimaryRef.current && livekitConnectedRef.current;

        // Se estiver usando LiveKit SFU como primário, publica lá com 1080p 60fps estáveis
        if (useLiveKitPrimary) {
          if (!livekitRoomRef.current?.localParticipant) {
            throw new Error("LiveKit room not connected");
          }
          try {
            const targetBitrate = bitrate;

            const pub = await livekitRoomRef.current.localParticipant.publishTrack(videoTrack, {
              name: "screen",
              source: LiveKitTrack.Source.ScreenShare,
              simulcast: false,
              degradationPreference: fps >= 60 ? "maintain-framerate" : "balanced",
              videoCodec: "h264",
              videoEncoding: {
                maxBitrate: targetBitrate,
                maxFramerate: fps,
                priority: "high",
              },
            });
            livekitScreenPubRef.current = pub;
            console.info("[LiveKit] Screen share published", {
              maxBitrate: targetBitrate,
              maxFramerate: fps,
              degradationPreference: fps >= 60 ? "maintain-framerate" : "balanced",
              videoCodec: "h264",
              contentHint: (videoTrack as MediaStreamTrack & { contentHint?: string }).contentHint,
            });
            if (screenAudioTrack) {
              try {
                livekitScreenAudioPubRef.current = await livekitRoomRef.current.localParticipant.publishTrack(screenAudioTrack, {
                  name: "screen-audio",
                  source: LiveKitTrack.Source.ScreenShareAudio,
                });
              } catch (screenAudioErr) {
                console.warn("[LiveKit] Screen audio publish failed; continuing video-only:", screenAudioErr);
                notify("Não foi possível publicar o áudio da tela; vídeo ok.", "info");
              }
            }
          } catch (lkErr) {
            console.error("[LiveKit] Screen share publish failed:", lkErr);
            // Tear down local capture — never mark sharing active without a published track
            if (screenBarrierRef.current) {
              try { screenBarrierRef.current.destroy(); } catch { }
              screenBarrierRef.current = null;
            }
            screenStream.getTracks().forEach((t) => {
              try { t.stop(); } catch { }
            });
            if (tauriScreenStopRef.current) {
              try { await tauriScreenStopRef.current(); } catch { /* ignore */ }
              tauriScreenStopRef.current = null;
            }
            screenStreamRef.current = null;
            screenVideoTrackRef.current = null;
            screenAudioTrackRef.current = null;
            setLocalScreenStream(null);
            notify("Não foi possível publicar o compartilhamento de tela.", "error");
            return;
          }
        } else {
          // Fallback: P2P mesh
          const targetBitrate = bitrate;

          for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            let sender = senders.find((s) => s.track?.kind === "video" || (s as any)._kind === "video" || s.track === null);
            if (!sender) {
              const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
              const videoTransceiver = transceivers.find((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video" || (t as any)._kind === "video");
              if (videoTransceiver) {
                sender = videoTransceiver.sender;
              }
            }

            if (sender) {
              await sender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, screenStream);
            }

            if (includeAudio && screenAudioTrack) {
              const audioSender = pc.getSenders().find((s) => s.track === screenAudioTrack);
              if (!audioSender) {
                pc.addTrack(screenAudioTrack, screenStream);
              }
            }

            // Apply bitrate and maintain-framerate preferences
            try {
              const videoSender = pc.getSenders().find((s) => s.track === videoTrack);
              if (videoSender && videoSender.getParameters) {
                const params = videoSender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                  params.encodings[0].maxBitrate = targetBitrate;
                  (params as any).degradationPreference = fps >= 60 ? "maintain-framerate" : "balanced";
                  await videoSender.setParameters(params);
                }
              }
            } catch (e) {
              console.warn("[useVoiceCall] setParameters on screen sender warning:", e);
            }

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (user?.uid) {
              await sendCallSignal(session.chatId, {
                senderId: user.uid,
                chatId: session.chatId,
                targetUid: peerId,
                signal: offer,
              });
            }
          }
        }

        // Only mark sharing after LiveKit publish / P2P attach succeeded
        setIsSharingScreen(true);
        setIsScreenPickerOpen(false);
        playSfx(sfxStreamStart);

        if (user?.uid) {
          void sendCallState(session.chatId, {
            senderId: user.uid,
            chatId: session.chatId,
            isSharingScreen: true,
          });
        }

        videoTrack.onended = () => {
          void stopScreenShare();
        };
      } catch (err: any) {
        console.error("[useVoiceCall] startScreenShare failed", err);
        notify("Não foi possível iniciar o compartilhamento de tela.", "error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, session?.chatId, session?.friendUid, user?.uid],
  );

  // STOP SCREEN SHARE
  const stopScreenShare = useCallback(async () => {
    // stop can be triggered by the UI button and by videoTrack.onended at almost the
    // same time. Make teardown idempotent so we never renegotiate/unpublish twice.
    if (screenShareStoppingRef.current) return;
    screenShareStoppingRef.current = true;

    const activeSession = sessionRef.current;
    const videoTrack = screenVideoTrackRef.current;
    const audioTrack = screenAudioTrackRef.current;

    if (videoTrack) {
      videoTrack.onended = null;
    }

    try {
      const localParticipant = livekitRoomRef.current?.localParticipant as any;
      await unpublishScreenPublications({
        participant: localParticipant,
        videoPublication: livekitScreenPubRef.current as any,
        audioPublication: livekitScreenAudioPubRef.current as any,
      });
    } catch (err) {
      console.warn("[useVoiceCall] LiveKit screen unpublish warning:", err);
    } finally {
      livekitScreenPubRef.current = null;
      livekitScreenAudioPubRef.current = null;
    }

    // P2P fallback may have two independent senders: screen video and system audio.
    // Detach both before stopping the local tracks so the remote peer does not keep a
    // stale sender/transceiver alive.
    if (activeSession?.chatId && user?.uid) {
      try {
        await detachScreenTracksFromPeers({
          peerConnections: peerConnectionsRef.current.values(),
          videoTrack,
          audioTrack,
        });

        if (!(useLiveKitPrimaryRef.current && livekitConnectedRef.current)) {
          for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await sendCallSignal(activeSession.chatId, {
                senderId: user.uid,
                chatId: activeSession.chatId,
                targetUid: peerId,
                signal: offer,
              });
            } catch (err) {
              console.warn("[useVoiceCall] P2P screen-stop renegotiation warning:", peerId, err);
            }
          }
        }
      } catch (err) {
        console.warn("[useVoiceCall] screen sender teardown warning:", err);
      }
    }

    if (screenBarrierRef.current) {
      screenBarrierRef.current.destroy();
      screenBarrierRef.current = null;
    }

    if (tauriScreenStopRef.current) {
      try { await tauriScreenStopRef.current(); } catch { /* ignore */ }
      tauriScreenStopRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch { }
      });
      screenStreamRef.current = null;
    }

    screenVideoTrackRef.current = null;
    screenAudioTrackRef.current = null;
    setLocalScreenStream(null);

    if (isLocalTestCall(activeSession?.chatId, activeSession?.friendUid)) {
      setRemoteStream(null);
      setIsRemoteSharingScreen(false);
    }

    // Remote UI state must be cleared for BOTH LiveKit and P2P. Previously this was
    // sent only in the P2P branch, leaving the other user stuck on an active stream.
    if (
      activeSession?.chatId &&
      user?.uid &&
      !isLocalTestCall(activeSession.chatId, activeSession.friendUid)
    ) {
      try {
        await sendCallState(activeSession.chatId, {
          senderId: user.uid,
          chatId: activeSession.chatId,
          isSharingScreen: false,
        });
      } catch (err) {
        console.warn("[useVoiceCall] screen-stop state broadcast warning:", err);
      }
    }

    setIsSharingScreen(false);
    playSfx(sfxStreamEnd);
    screenShareStoppingRef.current = false;
  }, [user?.uid]);


  // START TEST CALL (Loopback Echo Bot)
  const startTestCall = useCallback(async () => {
    try {
      cleanUpCall();
      setCallState("active");
      setIsVoiceWindowOpen(true);
      setMediaTransport("echo");
      setSession({
        chatId: "test-echo-session",
        friendUid: "echo-bot",
        friendName: "Auto-Teste (Echo)",
        isInitiator: true,
        startedAt: Date.now(),
      });

      const rawAudioStream = await acquireAudioStream();
      if (rawAudioStream) {
        const processedStream = await applyAudioProcessingChain(rawAudioStream);
        localStreamRef.current = processedStream;
        setLocalStream(processedStream);
        setupVoiceAnalyzer(processedStream, true);
        if (inputMode === "push-to-talk") {
          const track = processedStream.getAudioTracks()[0];
          if (track) track.enabled = false;
          const raw = rawStreamRef.current?.getAudioTracks()[0];
          if (raw && raw !== track) raw.enabled = false;
        }

        // Echo loopback setup so the user hears themselves and tests volume
        setRemoteStream(processedStream);
        remoteStreamsRef.current.set("echo-bot", processedStream);
        setRemoteStreams(new Map(remoteStreamsRef.current));
        setupVoiceAnalyzer(processedStream, false, "echo-bot");

        try {
          if (echoAudioRef.current) {
            echoAudioRef.current.pause();
            echoAudioRef.current.srcObject = null;
          }
          const echoAudio = new Audio();
          echoAudio.srcObject = processedStream;
          const vol = isDeafened ? 0 : (peerVolumes["echo-bot"] ?? peerVolumes["remote-user"] ?? remoteVolume ?? 100) / 100;
          echoAudio.volume = Math.max(0, Math.min(1, vol));
          if (selectedAudioOutput && selectedAudioOutput !== "default" && typeof (echoAudio as any).setSinkId === "function") {
            void (echoAudio as any).setSinkId(selectedAudioOutput).catch(() => { });
          }
          void echoAudio.play().catch(() => { });
          echoAudioRef.current = echoAudio;
        } catch (echoErr) {
          console.warn("[useVoiceCall] startTestCall echo loopback error:", echoErr);
        }
      } else {
        setIsMuted(true);
        notify("Microfone não detectado ou sem permissão.", "info");
      }

      playRingtone("connect");
      if (!callDurationTimerRef.current) {
        callDurationTimerRef.current = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
      notify("Auto-teste iniciado! Fale no microfone ou compartilhe sua tela.", "success");
    } catch (err: any) {
      console.error("[useVoiceCall] startTestCall failed", err);
      notify("Erro ao acessar microfone para o teste.", "error");
      cleanUpCall();
    }
  }, [
    acquireAudioStream,
    applyAudioProcessingChain,
    cleanUpCall,
    inputMode,
    isDeafened,
    notify,
    peerVolumes,
    playRingtone,
    remoteVolume,
    selectedAudioOutput,
    setupVoiceAnalyzer,
  ]);

  // KICK PARTICIPANT (Admin Action)
  const kickParticipant = useCallback(
    async (targetUserId: string) => {
      if (!sessionRef.current?.chatId || !user?.uid) return;
      try {
        await sendCallKick(sessionRef.current.chatId, targetUserId, {
          adminId: user.uid,
          targetUserId,
          chatId: sessionRef.current.chatId,
          reason: "Expulso pelo administrador da sala",
        });
        notify("Participante expulso da chamada.", "info");
      } catch (err) {
        console.error("[useVoiceCall] Failed to kick participant:", err);
      }
    },
    [notify, user?.uid],
  );

  // UPDATE ROOM PRIVACY / PASSWORD
  const updateRoomPrivacy = useCallback(
    async (isPrivate: boolean, password?: string) => {
      if (!session?.chatId || !user?.uid) return;
      const currentCategory = session.category || roomConfig?.category || "resenha_games";
      const currentRoomName = session.roomName || roomConfig?.roomName || `Call com ${session.friendName}`;
      const newConfig: CallRoomConfig = {
        roomName: currentRoomName,
        category: currentCategory,
        isPrivate,
        password: password || undefined,
      };
      setRoomConfig(newConfig);
      setSession((prev) =>
        prev
          ? {
            ...prev,
            isPrivate,
            password: password || undefined,
            roomName: currentRoomName,
            category: currentCategory,
          }
          : null,
      );
      await sendCallPrivacyUpdate(session.chatId, {
        adminId: user.uid,
        chatId: session.chatId,
        isPrivate,
        password: password || undefined,
        category: currentCategory,
        roomName: currentRoomName,
      });
      notify(
        isPrivate ? "Privacidade atualizada: Sala Privada 🔒" : "Privacidade atualizada: Sala Pública 🔓",
        "success",
      );
    },
    [notify, roomConfig, session, user?.uid],
  );

  // UPDATE FULL ROOM APPEARANCE & CONFIG
  const updateRoomAppearance = useCallback(
    async (newConfig: CallRoomConfig) => {
      if (!session?.chatId || !user?.uid) return;
      setRoomConfig((prev) => (prev ? { ...prev, ...newConfig } : newConfig));
      setSession((prev) =>
        prev
          ? {
            ...prev,
            roomName: newConfig.roomName,
            category: newConfig.category,
            icon: newConfig.icon,
            avatarUrl: newConfig.avatarUrl,
            themeColor: newConfig.themeColor,
            isPrivate: newConfig.isPrivate,
            password: newConfig.password,
          }
          : null,
      );

      await sendCallPrivacyUpdate(session.chatId, {
        adminId: user.uid,
        chatId: session.chatId,
        isPrivate: Boolean(newConfig.isPrivate),
        password: newConfig.password,
        category: newConfig.category,
        roomName: newConfig.roomName,
      });

      notify("Aparência e configurações do canal atualizadas!", "success");
    },
    [notify, session?.chatId, user?.uid],
  );

  // SIMULATE INCOMING CALL (Para testes)
  const simulateIncomingCall = useCallback(
    (hasVideo = true) => {
      if (callState !== "idle") {
        cleanUpCall();
      }
      setIncomingInvite({
        callerId: "ghost_tester_uid",
        callerName: "Ghost Rider (Simulação)",
        callerAvatar: null,
        chatId: "simulated_call_test",
        hasVideo,
        timestamp: Date.now(),
      });
      setCallState("ringing-in");
      playRingtone("call");
      if (audioRingIntervalRef.current) clearInterval(audioRingIntervalRef.current);
      audioRingIntervalRef.current = window.setInterval(() => {
        playRingtone("call");
      }, 3000);
      notify("Simulação de chamada recebida disparada!", "info");
    },
    [callState, cleanUpCall, notify, playRingtone],
  );

  // Calibração de Ruído Ambiente (Mede o ruído por 2s e sugere sensibilidade)
  const calibrateNoiseFloor = useCallback(async (): Promise<{ noiseFloor: number; recommendedSensitivity: number }> => {
    setIsCalibratingNoise(true);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContext não suportado");

      let tempStream = rawStreamRef.current || localStreamRef.current;
      let shouldStopTemp = false;

      if (!tempStream || !tempStream.getAudioTracks().some((t) => t.readyState === "live")) {
        tempStream = await acquireAudioStream();
        shouldStopTemp = true;
      }

      if (!tempStream) throw new Error("Microfone inacessível para calibração");

      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(tempStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const timeData = new Float32Array(analyser.fftSize);
      let samplesCount = 0;
      let totalRms = 0;

      const startTime = performance.now();
      const durationMs = 2000;

      await new Promise<void>((resolve) => {
        const sampleInterval = setInterval(() => {
          if (performance.now() - startTime >= durationMs) {
            clearInterval(sampleInterval);
            resolve();
            return;
          }

          analyser.getFloatTimeDomainData(timeData);
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const rawVol = Math.min(100, Math.round(rms * 700));
          totalRms += rawVol;
          samplesCount += 1;
        }, 50);
      });

      try {
        source.disconnect();
        analyser.disconnect();
        if (ctx.state !== "closed") await ctx.close();
      } catch { }

      if (shouldStopTemp && tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }

      const avgNoiseFloor = samplesCount > 0 ? Math.round(totalRms / samplesCount) : 5;
      const noiseFloor = Math.max(1, Math.min(50, avgNoiseFloor));

      // Calcula sensibilidade recomendada: se o ruído for 15, sensibilidade = 76%
      const recommendedSensitivity = Math.max(10, Math.min(90, Math.round(100 - (noiseFloor * 1.6))));

      setCurrentNoiseFloor(noiseFloor);
      setVoiceSensitivity(recommendedSensitivity);

      try {
        localStorage.setItem("checkpoint_voice_noise_floor", String(noiseFloor));
      } catch { }

      notify(`Microfone calibrado! Ruído medido: ${noiseFloor}%. Sensibilidade ajustada para ${recommendedSensitivity}%.`, "success");
      return { noiseFloor, recommendedSensitivity };
    } catch (err: any) {
      console.warn("[useVoiceCall] calibrateNoiseFloor error:", err);
      notify("Não foi possível calibrar o ruído ambiente.", "error");
      throw err;
    } finally {
      setIsCalibratingNoise(false);
    }
  }, [acquireAudioStream, notify, setVoiceSensitivity]);

  return {
    callState,
    session,
    roomConfig,
    incomingInvite,
    localStream,
    remoteStream,
    remoteStreams,
    remoteScreenStreams,
    localCameraStream,
    localScreenStream,
    remoteVolume,
    setRemoteVolume,
    peerVolumes,
    setPeerVolume,
    isMuted,
    isDeafened,
    isSpeakingLocal,
    isSpeakingRemote,
    remoteSpeakingStates,
    remoteStatesMap,
    isRemoteMuted,
    isRemoteDeafened,
    isCameraOn,
    isRemoteCameraOn,
    isSharingScreen,
    isRemoteSharingScreen,
    isScreenPickerOpen,
    setIsScreenPickerOpen,
    isVoiceWindowOpen,
    setIsVoiceWindowOpen,
    callDuration,
    isReconnecting,
    inputMode,
    setInputMode,
    pushToTalkKey,
    setPushToTalkKey,
    isPttPressed,
    isMicMonitoring,
    setIsMicMonitoring,
    // Device selections and controls
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    changeAudioInputDevice,
    changeAudioOutputDevice,
    changeVideoInputDevice,
    refreshDevices,
    deviceError,
    clearDeviceError,
    // Audio processing and calibration controls
    micGain,
    setMicGain,
    noiseGateEnabled,
    setNoiseGateEnabled,
    voiceSensitivity,
    setVoiceSensitivity,
    echoCancellation,
    setEchoCancellation,
    noiseSuppression,
    setNoiseSuppression,
    advancedNoiseSuppression,
    setAdvancedNoiseSuppression,
    autoGainControl,
    setAutoGainControl,
    calibrateNoiseFloor,
    isCalibratingNoise,
    currentNoiseFloor,
    // Active Friend Calls State
    activeCallsByFriend,
    isCallActiveWithFriend,
    // Actions
    startCall,
    joinRoom,
    createAndJoinRoom,
    startTestCall,
    answerCall,
    rejectCall,
    hangUp,
    endCallForEveryone,
    kickParticipant,
    updateRoomPrivacy,
    updateRoomAppearance,
    simulateIncomingCall,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    pendingReconnectSession,
    reconnectCall,
    dismissReconnect,
    channelConnectionStatus,
    mediaTransport,
  };
};
