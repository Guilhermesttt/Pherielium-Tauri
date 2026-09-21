import React, { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";
import { useVoiceCall } from "../hooks/useVoiceCall";
import { IncomingCallModal } from "../components/voice/IncomingCallModal";
import { VoiceCallBar } from "../components/voice/VoiceCallBar";
import { VoiceCallWindow } from "../components/voice/VoiceCallWindow";
import { ScreenPickerModal } from "../components/voice/ScreenPickerModal";
import { getCheckpointFriendStatuses } from "../services/checkpointFriends";
import { audioContextManager } from "../services/audio/AudioContextManager";
import { PeerAudioNode } from "../services/audio/PeerAudioNode";
import { CallConnectionBanner } from "../components/CallConnectionBanner";
import type { SocialFriend } from "../types/domain";

type VoiceCallContextType = ReturnType<typeof useVoiceCall>;

const VoiceCallContext = createContext<VoiceCallContextType | null>(null);



export const VoiceCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();
  let notify: (msg: string, type: "success" | "error" | "info") => void = () => { };
  try {
    const notificationContext = useNotification();
    if (notificationContext?.notify) {
      notify = notificationContext.notify;
    }
  } catch {
    // In unit tests without full notification center
  }

  const voiceCall = useVoiceCall({
    user,
    userProfile,
    notify,
  });

  const [socialFriends, setSocialFriends] = useState<SocialFriend[]>([]);

  useEffect(() => {
    if (!userProfile?.checkpointFriends || userProfile.checkpointFriends.length === 0) {
      setSocialFriends([]);
      return;
    }

    let isMounted = true;
    void getCheckpointFriendStatuses()
      .then((statuses) => {
        if (!isMounted) return;
        const list: SocialFriend[] = (userProfile.checkpointFriends || []).map((f) => {
          const status = statuses.find((s) => s.uid === f.uid);
          return {
            id: f.uid,
            name: status?.displayName || f.displayName || "Amigo",
            avatar: status?.photoURL || f.photoURL || undefined,
            status: status?.status || "offline",
            playing: status?.playing || undefined,
            source: "checkpoint",
          };
        });
        setSocialFriends(list);
      })
      .catch(() => {
        if (!isMounted) return;
        const list: SocialFriend[] = (userProfile.checkpointFriends || []).map((f) => ({
          id: f.uid,
          name: f.displayName || "Amigo",
          avatar: f.photoURL || undefined,
          status: "offline",
          source: "checkpoint",
        }));
        setSocialFriends(list);
      });

    return () => {
      isMounted = false;
    };
  }, [userProfile?.checkpointFriends]);


  // P2P-only remote playback. LiveKit already owns its audio elements through
  // RemoteAudioTrack.attach(), so routing the same remote MediaStream through
  // PeerAudioNode at the same time would reproduce each participant twice.
  const peerAudioNodesMapRef = React.useRef<
    Map<string, { node: PeerAudioNode; stream: MediaStream }>
  >(new Map());
  const audioContextManagerRef = React.useRef(audioContextManager);
  const p2pAudioContextAcquiredRef = React.useRef(false);

  const destroyPeerAudioNodes = React.useCallback(() => {
    peerAudioNodesMapRef.current.forEach(({ node }) => node.destroy());
    peerAudioNodesMapRef.current.clear();
  }, []);

  // Reconcile P2P playback topology only when streams/transport change. Volume and
  // sink changes are handled by separate effects so they do not recreate audio nodes.
  React.useEffect(() => {
    let cancelled = false;

    if (voiceCall.mediaTransport !== "p2p") {
      destroyPeerAudioNodes();
      if (p2pAudioContextAcquiredRef.current) {
        audioContextManagerRef.current.release();
        p2pAudioContextAcquiredRef.current = false;
      }
      return () => {
        cancelled = true;
      };
    }

    const activeStreams = new Map<string, MediaStream>();
    if (voiceCall.remoteStreams instanceof Map && voiceCall.remoteStreams.size > 0) {
      voiceCall.remoteStreams.forEach((stream: MediaStream, peerId: string) => {
        if (stream?.getAudioTracks().length > 0) {
          activeStreams.set(peerId, stream);
        }
      });
    } else if (voiceCall.remoteStream?.getAudioTracks().length) {
      activeStreams.set(voiceCall.session?.friendUid || "main-remote", voiceCall.remoteStream);
    }

    if (activeStreams.size === 0) {
      destroyPeerAudioNodes();
      return () => {
        cancelled = true;
      };
    }

    const reconcile = async () => {
      if (!p2pAudioContextAcquiredRef.current) {
        const ctx = await audioContextManagerRef.current.getContext();
        if (cancelled) {
          audioContextManagerRef.current.release();
          return;
        }
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => { });
        }
        p2pAudioContextAcquiredRef.current = true;
      }

      peerAudioNodesMapRef.current.forEach(({ node }, peerId) => {
        if (!activeStreams.has(peerId)) {
          node.destroy();
          peerAudioNodesMapRef.current.delete(peerId);
        }
      });

      activeStreams.forEach((stream, peerId) => {
        const existing = peerAudioNodesMapRef.current.get(peerId);
        if (existing?.stream === stream) return;

        existing?.node.destroy();
        const peerVolume = voiceCall.isDeafened
          ? 0
          : (voiceCall.peerVolumes?.[peerId] ?? voiceCall.remoteVolume ?? 100);
        const node = new PeerAudioNode(stream, peerVolume);
        peerAudioNodesMapRef.current.set(peerId, { node, stream });
      });
    };

    void reconcile().catch((err) => {
      if (!cancelled) {
        console.warn("[VoiceCallContext] P2P audio pipeline error:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    destroyPeerAudioNodes,
    voiceCall.mediaTransport,
    voiceCall.remoteStream,
    voiceCall.remoteStreams,
    voiceCall.session?.friendUid,
  ]);

  // Volume/deafen updates are cheap and do not rebuild the Web Audio graph.
  React.useEffect(() => {
    peerAudioNodesMapRef.current.forEach(({ node }, peerId) => {
      const peerVolume = voiceCall.isDeafened
        ? 0
        : (voiceCall.peerVolumes?.[peerId] ?? voiceCall.remoteVolume ?? 100);
      node.setVolume(peerVolume);
    });
  }, [voiceCall.isDeafened, voiceCall.peerVolumes, voiceCall.remoteVolume]);

  // Output-device changes are applied once at the shared AudioContext level.
  React.useEffect(() => {
    const targetOutput = voiceCall.selectedAudioOutput;
    if (!targetOutput) return;
    void audioContextManagerRef.current.setSinkId(targetOutput);
  }, [voiceCall.selectedAudioOutput]);

  React.useEffect(() => {
    return () => {
      destroyPeerAudioNodes();
      if (p2pAudioContextAcquiredRef.current) {
        audioContextManagerRef.current.release();
        p2pAudioContextAcquiredRef.current = false;
      }
    };
  }, [destroyPeerAudioNodes]);

  // Notify in-game overlay when an incoming call arrives (deduplicated)
  const lastNotifiedInviteKeyRef = React.useRef<string>("");
  const lastOverlayNotificationIdRef = React.useRef<string>("");
  React.useEffect(() => {
    if (voiceCall.callState === "ringing-in" && voiceCall.incomingInvite) {
      const key = `${voiceCall.incomingInvite.chatId}:${voiceCall.incomingInvite.timestamp}`;
      if (lastNotifiedInviteKeyRef.current === key) return;
      lastNotifiedInviteKeyRef.current = key;
      const notificationId = `incoming-call:${key}`;
      lastOverlayNotificationIdRef.current = notificationId;

      if (window.electronAPI?.showNotificationOverlay) {
        void window.electronAPI.showNotificationOverlay({
          type: "incoming-call",
          kind: "incoming-call",
          notificationId,
          id: notificationId,
          title: "Chamada de Voz",
          message: `${voiceCall.incomingInvite.callerName} está te ligando. Clique para atender.`,
          imageUrl: voiceCall.incomingInvite.callerAvatar || undefined,
          friendId: voiceCall.incomingInvite.callerId,
        });
      }
      return;
    }

    if (lastOverlayNotificationIdRef.current && window.electronAPI?.dismissNotificationOverlay) {
      void window.electronAPI.dismissNotificationOverlay({
        id: lastOverlayNotificationIdRef.current,
      });
      lastOverlayNotificationIdRef.current = "";
    }
    if (voiceCall.callState === "idle") {
      lastNotifiedInviteKeyRef.current = "";
    }
  }, [voiceCall.callState, voiceCall.incomingInvite]);

  return (
    <VoiceCallContext.Provider value={voiceCall}>
      {children}

      {/* Incoming Call Popup */}
      <IncomingCallModal
        isOpen={voiceCall.callState === "ringing-in"}
        invite={voiceCall.incomingInvite}
        onAccept={voiceCall.answerCall}
        onReject={voiceCall.rejectCall}
      />

      {/* Persistent Bottom Call Bar (visible when in call and main window is closed) */}
      {(voiceCall.callState === "active" || voiceCall.callState === "ringing-out" || voiceCall.callState === "connecting") &&
        !voiceCall.isVoiceWindowOpen && (
          <VoiceCallBar
            session={voiceCall.session}
            userProfile={userProfile}
            duration={voiceCall.callDuration}
            callState={voiceCall.callState}
            isMuted={voiceCall.isMuted}
            isDeafened={voiceCall.isDeafened}
            isRemoteMuted={voiceCall.isRemoteMuted}
            isRemoteDeafened={voiceCall.isRemoteDeafened}
            isSpeakingLocal={voiceCall.isSpeakingLocal}
            isSpeakingRemote={voiceCall.isSpeakingRemote}
            remoteSpeakingStates={voiceCall.remoteSpeakingStates}
            isSharingScreen={voiceCall.isSharingScreen}
            isReconnecting={voiceCall.isReconnecting}
            inputMode={voiceCall.inputMode}
            pushToTalkKey={voiceCall.pushToTalkKey}
            isPttPressed={voiceCall.isPttPressed}
            onToggleMute={voiceCall.toggleMute}
            onToggleDeafen={voiceCall.toggleDeafen}
            onToggleScreenShare={() => {
              if (voiceCall.isSharingScreen) {
                void voiceCall.stopScreenShare();
              } else {
                voiceCall.setIsScreenPickerOpen(true);
              }
            }}
            onOpenWindow={() => voiceCall.setIsVoiceWindowOpen(true)}
            onHangUp={voiceCall.hangUp}
          />
        )}

      <CallConnectionBanner
        status={
          voiceCall.channelConnectionStatus === "failed"
            ? "error"
            : voiceCall.channelConnectionStatus === "degraded"
              ? "poor"
              : voiceCall.isReconnecting ||
                voiceCall.channelConnectionStatus === "reconnecting" ||
                voiceCall.callState === "connecting" ||
                voiceCall.callState === "ringing-out"
                ? "connecting"
                : voiceCall.callState === "active"
                  ? "connected"
                  : "idle"
        }
        onRetry={
          voiceCall.pendingReconnectSession
            ? () => void voiceCall.reconnectCall()
            : voiceCall.channelConnectionStatus === "failed" || voiceCall.channelConnectionStatus === "degraded"
              ? () => void voiceCall.reconnectCall()
              : undefined
        }
      />

      {/* Expanded Main Call Window */}
      <VoiceCallWindow
        isOpen={voiceCall.isVoiceWindowOpen && voiceCall.callState !== "idle" && voiceCall.callState !== "ringing-in"}
        onClose={() => voiceCall.setIsVoiceWindowOpen(false)}
        session={voiceCall.session}
        userProfile={userProfile}
        remoteStream={voiceCall.remoteStream}
        localStream={voiceCall.localStream}
        localCameraStream={voiceCall.localCameraStream}
        localScreenStream={voiceCall.localScreenStream}
        duration={voiceCall.callDuration}
        callState={voiceCall.callState}
        isMuted={voiceCall.isMuted}
        isDeafened={voiceCall.isDeafened}
        isSpeakingLocal={voiceCall.isSpeakingLocal}
        isSpeakingRemote={voiceCall.isSpeakingRemote}
        isSharingScreen={voiceCall.isSharingScreen}
        isRemoteSharingScreen={voiceCall.isRemoteSharingScreen}
        remoteVolume={voiceCall.remoteVolume}
        onChangeRemoteVolume={voiceCall.setRemoteVolume}
        peerVolumes={voiceCall.peerVolumes}
        onSetPeerVolume={voiceCall.setPeerVolume}
        isReconnecting={voiceCall.isReconnecting}
        inputMode={voiceCall.inputMode}
        setInputMode={voiceCall.setInputMode}
        pushToTalkKey={voiceCall.pushToTalkKey}
        setPushToTalkKey={voiceCall.setPushToTalkKey}
        isRemoteMuted={voiceCall.isRemoteMuted}
        isRemoteDeafened={voiceCall.isRemoteDeafened}
        isCameraOn={voiceCall.isCameraOn}
        isRemoteCameraOn={voiceCall.isRemoteCameraOn}
        audioInputDevices={voiceCall.audioInputDevices}
        audioOutputDevices={voiceCall.audioOutputDevices}
        videoInputDevices={voiceCall.videoInputDevices}
        selectedAudioInput={voiceCall.selectedAudioInput}
        selectedAudioOutput={voiceCall.selectedAudioOutput}
        selectedVideoInput={voiceCall.selectedVideoInput}
        onChangeAudioInputDevice={voiceCall.changeAudioInputDevice}
        onChangeAudioOutputDevice={voiceCall.changeAudioOutputDevice}
        onChangeVideoInputDevice={voiceCall.changeVideoInputDevice}
        voiceSensitivity={voiceCall.voiceSensitivity}
        onChangeVoiceSensitivity={voiceCall.setVoiceSensitivity}
        echoCancellation={voiceCall.echoCancellation}
        onChangeEchoCancellation={voiceCall.setEchoCancellation}
        noiseSuppression={voiceCall.noiseSuppression}
        onChangeNoiseSuppression={voiceCall.setNoiseSuppression}
        advancedNoiseSuppression={voiceCall.advancedNoiseSuppression}
        onChangeAdvancedNoiseSuppression={voiceCall.setAdvancedNoiseSuppression}
        autoGainControl={voiceCall.autoGainControl}
        onChangeAutoGainControl={voiceCall.setAutoGainControl}
        isMicMonitoring={voiceCall.isMicMonitoring}
        onChangeMicMonitoring={voiceCall.setIsMicMonitoring}
        onToggleMute={voiceCall.toggleMute}
        onToggleDeafen={voiceCall.toggleDeafen}
        onToggleCamera={voiceCall.toggleCamera}
        onToggleScreenShare={() => {
          if (voiceCall.isSharingScreen) {
            void voiceCall.stopScreenShare();
          } else {
            voiceCall.setIsScreenPickerOpen(true);
          }
        }}
        onKickParticipant={voiceCall.kickParticipant}
        onHangUp={voiceCall.hangUp}
        onEndCallForEveryone={voiceCall.endCallForEveryone}
        socialFriends={socialFriends}
        roomConfig={voiceCall.roomConfig}
        onUpdateRoomPrivacy={voiceCall.updateRoomPrivacy}
        onUpdateRoomAppearance={voiceCall.updateRoomAppearance}
        notify={notify}
        remoteSpeakingStates={voiceCall.remoteSpeakingStates}
        remoteStreams={voiceCall.remoteStreams}
        remoteScreenStreams={voiceCall.remoteScreenStreams}
        remoteStatesMap={voiceCall.remoteStatesMap}
        micGain={voiceCall.micGain}
        onChangeMicGain={voiceCall.setMicGain}
        noiseGateEnabled={voiceCall.noiseGateEnabled}
        onChangeNoiseGateEnabled={voiceCall.setNoiseGateEnabled}
        onCalibrateNoise={voiceCall.calibrateNoiseFloor}
        isCalibratingNoise={voiceCall.isCalibratingNoise}
        currentNoiseFloor={voiceCall.currentNoiseFloor}
      />

      {/* Screen / Window Picker Modal */}
      <ScreenPickerModal
        isOpen={voiceCall.isScreenPickerOpen}
        onClose={() => voiceCall.setIsScreenPickerOpen(false)}
        onSelectSource={(options) => {
          voiceCall.setIsScreenPickerOpen(false);
          void voiceCall.startScreenShare(options);
        }}
      />



      {/* Floating Reconnect Prompt */}
      <AnimatePresence>
        {voiceCall.pendingReconnectSession && voiceCall.callState === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-9999 flex max-w-md items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-[#0d1117]/95 p-3.5 pr-4 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <PhoneCall className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Chamada em andamento
              </p>
              <p className="text-[11px] text-white/60 truncate">
                Você estava em chamada com <span className="font-semibold text-emerald-300">{voiceCall.pendingReconnectSession.friendName}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void voiceCall.reconnectCall()}
                className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-black shadow-md transition hover:bg-emerald-400 active:scale-95 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => voiceCall.dismissReconnect()}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </VoiceCallContext.Provider>
  );
};

const safeFallbackVoiceCallContext: Partial<VoiceCallContextType> = {
  session: null,
  callState: "idle",
  callDuration: 0,
  isMuted: false,
  isDeafened: false,
  isRemoteMuted: false,
  isRemoteDeafened: false,
  isSpeakingLocal: false,
  isSpeakingRemote: false,
  remoteSpeakingStates: new Map(),
  isCameraOn: false,
  isRemoteCameraOn: false,
  isSharingScreen: false,
  isRemoteSharingScreen: false,
  isReconnecting: false,
  remoteVolume: 100,
  peerVolumes: {},
  inputMode: "voice-activity",
  pushToTalkKey: "F8",
  isPttPressed: false,
  voiceSensitivity: -45,
  echoCancellation: true,
  noiseSuppression: true,
  advancedNoiseSuppression: true,
  audioInputDevices: [],
  audioOutputDevices: [],
  videoInputDevices: [],
  selectedAudioInput: "default",
  selectedAudioOutput: "default",
  selectedVideoInput: "default",
  isVoiceWindowOpen: false,
  isScreenPickerOpen: false,
  incomingInvite: null,
  pendingReconnectSession: null,
  channelConnectionStatus: "idle" as const,
  mediaTransport: "none" as const,
  localStream: null,
  remoteStream: null,
  localCameraStream: null,
  localScreenStream: null,
  remoteStreams: new Map(),
  remoteScreenStreams: new Map(),
  remoteStatesMap: new Map(),
  roomConfig: null,
  activeCallsByFriend: new Map(),
  isCallActiveWithFriend: () => false,
  startCall: async () => { },
  startTestCall: async () => { },
  answerCall: async () => { },
  rejectCall: async () => { },
  hangUp: async () => { },
  endCallForEveryone: async () => { },
  joinRoom: async () => { },
  createAndJoinRoom: async () => { },
  updateRoomPrivacy: async () => { },
  kickParticipant: async () => { },
  reconnectCall: async () => { },
  dismissReconnect: () => { },
  toggleMute: () => { },
  toggleDeafen: () => { },
  toggleCamera: async () => { },
  startScreenShare: async () => { },
  stopScreenShare: async () => { },
  setRemoteVolume: () => { },
  setPeerVolume: () => { },
  setInputMode: () => { },
  setPushToTalkKey: () => { },
  setVoiceSensitivity: () => { },
  setEchoCancellation: () => { },
  setNoiseSuppression: () => { },
  setAdvancedNoiseSuppression: async () => { },
  changeAudioInputDevice: async () => { },
  changeAudioOutputDevice: async () => { },
  changeVideoInputDevice: async () => { },
  setIsVoiceWindowOpen: () => { },
  setIsScreenPickerOpen: () => { },
};

export const useVoiceCallContext = (): VoiceCallContextType => {
  const context = useContext(VoiceCallContext);
  if (!context) {
    return safeFallbackVoiceCallContext as VoiceCallContextType;
  }
  return context;
};
