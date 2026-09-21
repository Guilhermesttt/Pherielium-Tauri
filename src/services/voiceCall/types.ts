import type { RoomCategory } from "../../types/voice-governance";

export type ChannelConnectionStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "degraded"
  | "reconnecting"
  | "failed";

export interface ChannelStatusEvent {
  channelName: string;
  status: ChannelConnectionStatus;
  attempt: number;
  error?: unknown;
  timestamp: number;
}

export type ChannelStatusListener = (event: ChannelStatusEvent) => void;

export interface CallInvitePayload {
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  chatId: string;
  hasVideo?: boolean;
  timestamp: number;
  category?: RoomCategory;
}

export interface CallKickPayload {
  adminId: string;
  targetUserId: string;
  chatId: string;
  reason?: string;
}

export interface CallAnswerPayload {
  responderId: string;
  accepted: boolean;
  chatId: string;
}

export interface CallSignalPayload {
  senderId: string;
  chatId: string;
  targetUid?: string; // Destinatário específico no Full Mesh P2P
  signal: RTCSessionDescriptionInit | { candidate: RTCIceCandidateInit };
}

export interface CallStatePayload {
  senderId: string;
  chatId: string;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isSharingScreen?: boolean;
  isCameraOn?: boolean;
}

export interface CallPrivacyPayload {
  adminId: string;
  chatId: string;
  isPrivate: boolean;
  password?: string;
  category?: RoomCategory;
  roomName?: string;
}

export interface CallEndPayload {
  senderId: string;
  chatId: string;
  reason?: "hangup" | "rejected" | "busy" | "timeout" | "error";
}

export interface CallMemberJoinedPayload {
  uid: string;
  name: string;
  avatar?: string | null;
  chatId: string;
}

export interface CallMemberLeftPayload {
  uid: string;
  chatId: string;
}
