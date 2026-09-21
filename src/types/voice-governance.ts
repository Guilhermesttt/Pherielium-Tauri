export type FeedId =
  | 'local-user'
  | 'local-camera'
  | 'local-screen'
  | 'remote-user'
  | 'remote-camera'
  | 'remote-screen'
  | `remote-user:${string}`
  | `remote-camera:${string}`
  | `remote-screen:${string}`;

export type FeedType =
  | 'local-user'
  | 'local-camera'
  | 'local-screen'
  | 'remote-user'
  | 'remote-camera'
  | 'remote-screen'
  | 'voice'
  | 'video';

export type RoomCategory =
  | 'resenha_games'    // "Call de Resenha / Jogos"
  | 'gameplay_foco'    // "Só Gameplay"
  | 'estudos_foco'     // "Foco & Estudos"
  | 'casual_chat';     // "Conversa Livre"

export type ParticipantRole = 'admin' | 'moderator' | 'member';

export interface CallFeed {
  id: FeedId | string;
  peerId?: string;
  type: 'voice' | 'video' | FeedType;
  title: string;
  subtitle?: string;
  tag?: string;
  avatar?: string | null;
  stream?: MediaStream | null;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  role?: ParticipantRole;
  isScreen?: boolean;
  isCamera?: boolean;
  isScreenLiveAvailable?: boolean;
  isCurrentlyWatched?: boolean;
}

export interface UserAudioSettings {
  userId: string;
  voiceVolume: number;        // 0 a 200 (Default: 100)
  screenVolume: number;       // 0 a 200 (Default: 100)
  isLocallyMuted: boolean;
  isConsumingScreen: boolean;
}

export interface RoomConfig {
  id: string;
  name: string;
  category: RoomCategory;
  isPrivate: boolean;
  maxParticipants?: number;
  createdById: string;
  inviteCode?: string;
  createdAt: string;
}

export interface CallRoomConfig {
  adminId?: string;
  hostUid?: string;
  roomName: string;
  category: RoomCategory;
  isPrivate: boolean;
  password?: string;
  icon?: string;
  avatarUrl?: string;
  themeColor?: string;
}

export interface CallInviteMeta {
  chatId: string;
  roomName: string;
  category: RoomCategory;
  callerName: string;
  callerAvatar?: string | null;
  isPrivate?: boolean;
  createdAt: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetFeed: CallFeed | null;
}

export interface VoiceRoomParticipant {
  uid: string;
  name: string;
  avatar?: string | null;
  joinedAt?: string;
}

export interface VoiceRoom {
  id: string;
  hostUid: string;
  name: string;
  category: RoomCategory;
  isPrivate: boolean;
  hasPassword?: boolean;
  maxParticipants: number;
  status: "active" | "ended";
  createdAt: string;
  updatedAt?: string;
  participantsCount: number;
  participants: VoiceRoomParticipant[];
  isHost?: boolean;
  icon?: string;
  avatarUrl?: string;
  themeColor?: string;
}

export type PublicVoiceRoom = VoiceRoom;


