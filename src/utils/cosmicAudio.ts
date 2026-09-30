import ps2RedScreenSound from "../sounds/ps2-red-screen-of-death.mp3";
import phelieriumClickSound from "../sounds/Phelierium Default/ui_click.wav";

/**
 * CosmicAudio - High-impact Web Audio API Sound Synthesizer + PS2 Death Ambience
 * Plays the iconic PS2 Red Screen of Death sound on fatal screens, default Pherielium clicks,
 * and synthesizes zero-latency cosmic physics audio effects.
 */

class CosmicAudioEngine {
  private ctx: AudioContext | null = null;
  private alarmInterval: number | null = null;
  private isAlarmActive: boolean = false;
  private ps2Audio: HTMLAudioElement | null = null;
  private defaultClickAudio: HTMLAudioElement | null = null;

  /**
   * Plays the default Pherielium theme UI click sound
   */
  playDefaultClick() {
    try {
      const audio = new Audio(phelieriumClickSound);
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn("[CosmicAudio] Could not play default click:", e);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Massive cinematic explosion with sub-bass drop, transient hull crack, and seismic rumble
   */
  playExplosion(intensity: "normal" | "heavy" | "catastrophic" = "normal") {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = intensity === "catastrophic" ? 3.4 : intensity === "heavy" ? 2.8 : 2.2;

    // ── 1. Initial Transient Hull Crack / Glass Snap (0ms - 60ms) ───────────
    const snapSize = Math.floor(ctx.sampleRate * 0.08);
    const snapBuffer = ctx.createBuffer(1, snapSize, ctx.sampleRate);
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < snapSize; i++) {
      snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    }
    const snapSource = ctx.createBufferSource();
    snapSource.buffer = snapBuffer;

    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = "highpass";
    snapFilter.frequency.setValueAtTime(1800, now);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.85, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    snapSource.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapSource.start(now);

    // ── 2. Massive Sub-Bass Plunge (240Hz -> 22Hz) ──────────────────────────
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    const startFreq = intensity === "catastrophic" ? 260 : 190;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + duration * 0.65);

    const baseVolume = intensity === "catastrophic" ? 1.0 : 0.85;
    oscGain.gain.setValueAtTime(baseVolume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    // ── 3. Shockwave Blast Noise (Low-pass resonant sweep) ───────────────────
    const noiseSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.9));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(intensity === "catastrophic" ? 1400 : 900, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(36, now + duration);
    noiseFilter.Q.setValueAtTime(5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);

    // ── 4. Sustained Seismic Sub-Woofer Rumble (Vibration effect) ────────────
    const rumbleOsc = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumbleOsc.type = "triangle";
    rumbleOsc.frequency.setValueAtTime(44, now);
    rumbleOsc.frequency.linearRampToValueAtTime(30, now + duration);

    // Subtle amplitude wobble (tremolo)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(14, now);
    lfoGain.gain.setValueAtTime(0.15, now);

    rumbleGain.gain.setValueAtTime(0.65, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    lfo.connect(lfoGain);
    lfoGain.connect(rumbleGain.gain);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    lfo.start(now);
    rumbleOsc.start(now);
    lfo.stop(now + duration);
    rumbleOsc.stop(now + duration);
  }

  /**
   * Terrifying black hole gravitational suction sweep
   */
  playVortex() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 2.9;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";

    // Spacetime distortion sweep plunges down
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(16, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(28, now + duration);
    filter.Q.setValueAtTime(9, now);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    // Suction wind hiss
    const windSize = Math.floor(ctx.sampleRate * duration);
    const windBuffer = ctx.createBuffer(1, windSize, ctx.sampleRate);
    const windData = windBuffer.getChannelData(0);
    for (let i = 0; i < windSize; i++) {
      windData[i] = (Math.random() * 2 - 1) * Math.sin((i / windSize) * Math.PI);
    }
    const wind = ctx.createBufferSource();
    wind.buffer = windBuffer;
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.3, now);
    windGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    wind.connect(windGain);
    windGain.connect(ctx.destination);
    wind.start(now);
  }

  /**
   * Plays the PS2 Red Screen of Death sound on continuous loop during death/panic screens
   */
  startEmergencyAlarm() {
    this.stopEmergencyAlarm();
    this.isAlarmActive = true;

    try {
      this.ps2Audio = new Audio(ps2RedScreenSound);
      this.ps2Audio.loop = true;
      this.ps2Audio.volume = 0.88;
      const playPromise = this.ps2Audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[CosmicAudio] Could not auto-play PS2 audio:", err);
        });
      }
    } catch (e) {
      console.warn("[CosmicAudio] Error initializing PS2 sound:", e);
    }
  }

  stopEmergencyAlarm() {
    this.isAlarmActive = false;
    if (this.ps2Audio) {
      try {
        this.ps2Audio.pause();
        this.ps2Audio.currentTime = 0;
      } catch (e) {}
      this.ps2Audio = null;
    }
    if (this.alarmInterval !== null) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  /**
   * Harsh administrative error rejection buzzer (Access Denied / Lockout)
   */
  playErrorBuzzer() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.13].forEach((offset) => {
      // Discordant dual sawtooth for maximum harshness
      [110, 117].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + offset);

        gain.gain.setValueAtTime(0.24, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.11);
      });
    });
  }

  /**
   * High-tech warning beep for emergency actions
   */
  playWarningBeep() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Shimmering reverse whoosh and celestial restoration chord
   */
  playReconstruct() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C major celestial chord with octave

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.5);
    });
  }

  /**
   * Triumphant relief chime for the Zoeira reveal
   */
  playZoeiraReveal() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const chord = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5]; // G, C, E, G, C6, E6

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.22, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 1.9);
      });
    } catch (e) {
      console.warn("[CosmicAudio] playZoeiraReveal failed:", e);
    }
  }
}

export const cosmicAudio = new CosmicAudioEngine();
