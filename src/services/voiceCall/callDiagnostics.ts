export type CallDiagnosticsSnapshot = {
  connection: string;
  signaling: string;
  transport: string;
  ice: string;
  peers: number;
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
  deafened: boolean;
  rttMs?: number | null;
  packetLoss?: number | null;
  bitrate?: number | null;
  videoFps?: number | null;
};
