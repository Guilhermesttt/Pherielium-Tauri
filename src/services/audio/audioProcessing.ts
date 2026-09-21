/**
 * audioProcessing.ts
 *
 * Builds a Web Audio processing chain for *local* metering / UI / optional P2P.
 * LiveKit publishes the raw getUserMedia mic track for lower latency; this chain
 * still drives gain, compressor, and optional RNNoise for local monitoring.
 *
 * Chain (mono, baixa latencia para voz):
 *   source -> gainNode -> compressorNode -> [RnnoiseWorkletNode?] -> makeupGain -> destination(mono)
 *
 * The GainNode is returned as a live ref so callers can update gain in real time
 * without rebuilding the entire AudioContext.
 */

// Vite resolves ?url to the correct hashed asset path both in dev and in build.
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

export interface ProcessedAudioResult {
  /** Processed MediaStream for local metering/UI (and P2P); LiveKit uses the raw mic track */
  processedStream: MediaStream;
  /** AudioContext that drives the processing chain — must stay resumed during calls */
  audioContext: AudioContext;
  /** Live GainNode ref - call gainNode.gain.value = x at any time without rebuilding */
  gainNode: GainNode;
  /**
   * Tear down EVERYTHING: disconnect all nodes, close the AudioContext.
   * Must be called on hangup, device change, or unmount.
   * Follows the same rigorous pattern as destroyAudioPipeline() in useVoiceCall.
   */
  cleanup: () => void;
}

/**
 * Builds the real audio processing chain.
 *
 * @param rawStream               - The MediaStream from getUserMedia (kept alive as source).
 * @param gainPercent             - Gain 0-200 (100 = unity gain, no amplification).
 * @param noiseSuppressionEnabled - Whether to load and attach the RNNoise worklet.
 *
 * Graceful fallback: if the RNNoise worklet fails to load (asset not found, CSP, etc.),
 * the chain continues as: source -> gain -> compressor -> makeupGain -> destination (no crash).
 */
export async function buildProcessedAudioTrack(
  rawStream: MediaStream,
  gainPercent: number,
  noiseSuppressionEnabled: boolean,
): Promise<ProcessedAudioResult> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: 48000, latencyHint: "interactive" });

  // Resume immediately - browsers may start contexts in suspended state.
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }

  const source = ctx.createMediaStreamSource(rawStream);

  // -- GainNode --------------------------------------------------------------
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0, gainPercent) / 100;

  // -- DynamicsCompressor ----------------------------------------------------
  // Prevents clipping and levels voice dynamics.
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.20;
  compressor.knee.value = 8;

  // -- Makeup Gain -----------------------------------------------------------
  // Web Audio's DynamicsCompressor and RNNoise lack automatic makeup gain.
  // Adding +3.2 dB (1.45x) makeup gain restores natural loudness and presence.
  const makeupGain = ctx.createGain();
  makeupGain.gain.value = 1.45;

  // -- Mono (baixa latencia) ---------------------------------------------------
  // Voz e mono por natureza. Forcar STEREO aqui dobra o bitrate do Opus,
  // aumenta o jitter buffer do SFU e adiciona latencia fim-a-fim perceptivel.
  // O destino e mono (1 canal); o proprio WebRTC/LiveKit duplica para L/R
  // nos fones sem custo de rede.
  const destination = ctx.createMediaStreamDestination();
  destination.channelCount = 1;
  destination.channelCountMode = "explicit";
  destination.channelInterpretation = "speakers";

  makeupGain.connect(destination);

  // Keep track of the RNNoise node so we can disconnect it on cleanup.
  let rnnoiseNode: (AudioNode & { destroy?: () => void }) | null = null;

  // -- RNNoise worklet (optional) --------------------------------------------
  if (noiseSuppressionEnabled && typeof ctx.audioWorklet?.addModule === "function") {
    try {
      const { RnnoiseWorkletNode, loadRnnoise } = await import(
        "@sapphi-red/web-noise-suppressor"
      );
      await ctx.audioWorklet.addModule(rnnoiseWorkletPath);
      const wasmBinary = await loadRnnoise({
        url: rnnoiseWasmPath,
        simdUrl: rnnoiseWasmSimdPath,
      });
      rnnoiseNode = new RnnoiseWorkletNode(ctx, {
        wasmBinary,
        maxChannels: 1, // mono processing
      });

      // Chain: source -> gain -> compressor -> rnnoise -> makeupGain -> destination
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(rnnoiseNode);
      rnnoiseNode.connect(makeupGain);
    } catch (err) {
      // Graceful fallback - worklet failed, continue without RNNoise.
      console.warn(
        "[audioProcessing] RNNoise worklet failed to load, falling back to gain+compressor only:",
        err,
      );
      rnnoiseNode = null;
      // Disconnect anything that may have been partially connected above.
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        gainNode.disconnect();
      } catch {
        /* ignore */
      }
      try {
        compressor.disconnect();
      } catch {
        /* ignore */
      }

      // Re-connect without worklet
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(makeupGain);
    }
  } else {
    // No RNNoise - simple chain: source -> gain -> compressor -> makeupGain -> destination
    source.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(makeupGain);
  }

  // Marca a trilha como voz: permite ao WebRTC/LiveKit escolher Opus speech
  // (narrower bandwidth, menor latencia) em vez de perfil generico de audio.
  for (const track of destination.stream.getAudioTracks()) {
    try {
      (track as MediaStreamTrack & { contentHint?: string }).contentHint = "speech";
    } catch {
      /* ignore */
    }
  }

  // -- Cleanup ---------------------------------------------------------------
  const cleanup = () => {
    try {
      source.disconnect();
    } catch {
      /* ignore */
    }
    try {
      gainNode.disconnect();
    } catch {
      /* ignore */
    }
    try {
      compressor.disconnect();
    } catch {
      /* ignore */
    }
    try {
      makeupGain.disconnect();
    } catch {
      /* ignore */
    }
    if (rnnoiseNode) {
      try {
        rnnoiseNode.disconnect();
      } catch {
        /* ignore */
      }
      try {
        rnnoiseNode.destroy?.();
      } catch {
        /* ignore */
      }
      rnnoiseNode = null;
    }
    if (ctx.state !== "closed") {
      void ctx.close().catch(() => {
        /* ignore */
      });
    }
  };

  return {
    processedStream: destination.stream,
    audioContext: ctx,
    gainNode,
    cleanup,
  };
}
