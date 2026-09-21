/**
 * AudioContextManager - Singleton AudioContext for the entire voice system
 * Ensures only one AudioContext is created and shared across:
 * - useVoiceCall (local audio processing, VAD)
 * - VoiceCallContext (remote audio playback, PeerAudioNode)
 * - PeerAudioNode (per-peer audio processing)
 */

type AudioContextType = AudioContext | (typeof window extends { webkitAudioContext: infer T } ? T : never);

class AudioContextManager {
  private static instance: AudioContextManager;
  private ctx: AudioContextType | null = null;
  private refCount = 0;
  private sinkId: string | null = null;

  private constructor() { }

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  async getContext(): Promise<AudioContextType> {
    if (this.ctx && this.ctx.state !== "closed") {
      this.refCount++;
      if (this.ctx.state === "suspended") {
        await this.ctx.resume().catch(() => { });
      }
      return this.ctx;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      throw new Error("AudioContext não suportado neste navegador");
    }

    this.ctx = new AudioCtx({ sampleRate: 48000, latencyHint: "interactive" });
    this.refCount = 1;

    if (this.sinkId && typeof (this.ctx as any).setSinkId === "function") {
      try {
        await (this.ctx as any).setSinkId(this.sinkId === "default" ? "" : this.sinkId);
      } catch { }
    }

    return this.ctx;
  }

  async setSinkId(deviceId: string): Promise<void> {
    this.sinkId = deviceId;
    if (this.ctx && typeof (this.ctx as any).setSinkId === "function") {
      try {
        await (this.ctx as any).setSinkId(deviceId === "default" ? "" : deviceId);
      } catch (err) {
        console.warn("[AudioContextManager] setSinkId failed:", err);
      }
    }
  }

  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0 && this.ctx && this.ctx.state !== "closed") {
      // Don't close immediately - keep alive for reuse
      // Context will be closed on explicit cleanup or page unload
    }
  }

  async close(): Promise<void> {
    if (this.ctx && this.ctx.state !== "closed") {
      try {
        await this.ctx.close();
      } catch { }
      this.ctx = null;
      this.refCount = 0;
    }
  }

  getCurrentContext(): AudioContextType | null {
    return this.ctx;
  }

  isActive(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed" && this.refCount > 0;
  }
}

export const audioContextManager = AudioContextManager.getInstance();

/**
 * Hook to get shared AudioContext in React components
 */
export function useSharedAudioContext() {
  return audioContextManager;
}