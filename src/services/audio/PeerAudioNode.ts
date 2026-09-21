/**
 * PeerAudioNode - Web Audio API Pipeline com Soft Limiter
 * Permite ganho de 0% até 200% sem distorção digital destrutiva (hard clipping)
 * utilizando DynamicsCompressorNode como limitador de áudio profissional.
 */
import { audioContextManager } from "./AudioContextManager";

export class PeerAudioNode {
  private ctx: AudioContext;
  private source: MediaStreamAudioSourceNode;
  private gainNode: GainNode;
  private compressor: DynamicsCompressorNode;
  private isDestroyed = false;

  constructor(stream: MediaStream, initialVolume = 100) {
    // Use shared AudioContext
    const manager = audioContextManager;
    // We need to get the context synchronously here, so we'll use a fallback
    // In practice, the context should already be initialized by VoiceCallContext
    const existingCtx = manager.getCurrentContext();
    if (existingCtx && existingCtx.state !== "closed") {
      this.ctx = existingCtx;
    } else {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 48000, latencyHint: "interactive" });
    }

    // Resume AudioContext if suspended (required by browser autoplay policies)
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => { });
    }

    this.source = this.ctx.createMediaStreamSource(stream);
    this.gainNode = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();

    // Configuração de Soft Limiter Profissional
    // Threshold em -6dB com ratio 20:1 para fornecer 6dB de headroom garantido antes do clipping
    this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(4, this.ctx.currentTime); // Transição suave
    this.compressor.ratio.setValueAtTime(20, this.ctx.currentTime); // Ratio de limiter estrito
    this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime); // 2ms de ataque ultra-rápido
    this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime); // 100ms de liberação

    // Conexão: Source -> Gain (0-200%) -> Compressor -> Destination
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.setVolume(initialVolume);
  }

  /**
   * Ajusta o volume com resposta imediata para mudo e rampa suave de 15ms para mudanças graduais
   * @param volumePercent Percentual de 0 a 200
   */
  public setVolume(volumePercent: number): void {
    if (this.isDestroyed || this.ctx.state === "closed") return;
    const targetGain = Math.max(0, Math.min(2.0, volumePercent / 100));
    try {
      if (targetGain === 0) {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      } else {
        this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.015);
      }
    } catch {
      this.gainNode.gain.value = targetGain;
    }
  }

  /**
   * Redireciona o fluxo para o dispositivo de saída de áudio selecionado (se suportado pelo navegador)
   */
  public async setSinkId(deviceId: string): Promise<void> {
    if (this.isDestroyed || this.ctx.state === "closed") return;
    try {
      if (typeof (this.ctx as any).setSinkId === "function") {
        await (this.ctx as any).setSinkId(deviceId === "default" ? "" : deviceId);
      }
    } catch (err) {
      console.warn("[PeerAudioNode] setSinkId error:", err);
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    try {
      this.source.disconnect();
      this.gainNode.disconnect();
      this.compressor.disconnect();
    } catch {
      // ignore on teardown
    }
  }
}
