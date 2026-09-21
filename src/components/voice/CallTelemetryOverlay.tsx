import React, { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface CallTelemetryLeftProps {
  duration: number;
  stream?: MediaStream | null;
  isSpeaking?: boolean;
  className?: string;
}

interface CallTelemetryRightProps {
  stream?: MediaStream | null;
  isSpeaking?: boolean;
  className?: string;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/**
 * Animated neon-green audio waveform oscilloscope
 */
export const CallWaveformVisualizer: React.FC<{
  stream?: MediaStream | null;
  isSpeaking?: boolean;
}> = ({ stream, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let dataArray: Uint8Array | null = null;
    let isCancelled = false;

    if (stream && stream.getAudioTracks().length > 0) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.65;
          source.connect(analyser);
          dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
      } catch (e) {
        console.warn("[CallWaveformVisualizer] AudioContext init error:", e);
      }
    }

    let phase = 0;

    const render = () => {
      if (isCancelled) return;
      phase += 0.08;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = "#22c55e";
      ctx.shadowColor = "rgba(34, 197, 94, 0.75)";
      ctx.shadowBlur = 6;

      let hasRealAudio = false;
      if (analyser && dataArray) {
        analyser.getByteTimeDomainData(dataArray as any);
        // check if signal is above baseline
        let maxDev = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const dev = Math.abs(dataArray[i] - 128);
          if (dev > maxDev) maxDev = dev;
        }
        if (maxDev > 4) {
          hasRealAudio = true;
        }
      }

      if (hasRealAudio && dataArray) {
        const sliceWidth = width / (dataArray.length - 1);
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
      } else {
        // Aesthetic continuous gentle organic sine wave
        const amp = isSpeaking ? 10 : 3.5;
        const step = 2;
        for (let x = 0; x <= width; x += step) {
          const progress = x / width;
          // window envelope to fade edges to center
          const envelope = Math.sin(progress * Math.PI);
          const y =
            height / 2 +
            Math.sin(progress * 14 + phase) * amp * envelope +
            Math.sin(progress * 28 - phase * 1.5) * (amp * 0.4) * envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.stroke();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try {
          source.disconnect();
        } catch {}
      }
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          void audioCtx.close();
        } catch {}
      }
    };
  }, [stream, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={36}
      className="w-full h-8 block pointer-events-none"
    />
  );
};

/**
 * Left Telemetry Component:
 * - Card 1: QUALIDADE DA CHAMADA (EXCELENTE) + Live Waveform
 * - Card 2: DURAÇÃO | LATÊNCIA | CODEC
 */
export const CallTelemetryLeft: React.FC<CallTelemetryLeftProps> = ({
  duration,
  stream,
  isSpeaking,
  className = "",
}) => {
  // Latência/codec hidden behind settings per audit — simplified to duration + quality only
  return (
    <div className={`flex flex-col gap-2.5 w-full max-w-[340px] select-none ${className}`}>
      {/* Simplified Card: Excelente with green dot + waveform + duration — rounded-2xl p-3 bg-black/40 border border-white/10 */}
      <div className="flex items-center justify-between gap-3 rounded-2xl p-3 bg-black/40 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">
              Qualidade
            </span>
            <span className="text-xs font-bold tracking-wide text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Excelente
            </span>
            <span className="text-[10px] font-medium text-white/60 font-mono mt-1 tabular-nums flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-white/40" />
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Live Audio Waveform */}
        <div className="w-24 sm:w-28 h-7 flex items-center justify-end overflow-hidden">
          <CallWaveformVisualizer stream={stream} isSpeaking={isSpeaking} />
        </div>
      </div>
    </div>
  );
};

/**
 * Right Telemetry Component:
 * - Card 1: NÍVEL DE VOZ (8 LED Pills VU meter)
 */
export const CallTelemetryRight: React.FC<CallTelemetryRightProps> = ({
  stream,
  isSpeaking,
  className = "",
}) => {
  const [voiceLevelPills, setVoiceLevelPills] = useState(0);

  useEffect(() => {
    let animId: number;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let isCancelled = false;

    if (stream && stream.getAudioTracks().length > 0) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);

          const data = new Float32Array(analyser.fftSize);

          const checkLevel = () => {
            if (isCancelled || !analyser) return;
            analyser.getFloatTimeDomainData(data);
            let sumSquares = 0;
            for (let i = 0; i < data.length; i++) {
              sumSquares += data[i] * data[i];
            }
            const rms = Math.sqrt(sumSquares / data.length);
            // Map RMS to 0..8 pills
            const levelRatio = Math.min(1, rms * 8);
            const pills = Math.round(levelRatio * 8);
            setVoiceLevelPills(pills);
            animId = requestAnimationFrame(checkLevel);
          };

          animId = requestAnimationFrame(checkLevel);
        }
      } catch (e) {
        console.warn("[CallTelemetryRight] AudioContext error:", e);
      }
    } else {
      // If no audio stream object, react directly to isSpeaking prop with simulated voice energy
      let frame = 0;
      const simulateLevel = () => {
        if (isCancelled) return;
        frame++;
        if (isSpeaking) {
          const oscillation = Math.sin(frame * 0.2) * 2 + Math.cos(frame * 0.45) * 1.5;
          const pills = Math.max(3, Math.min(8, Math.round(5 + oscillation)));
          setVoiceLevelPills(pills);
        } else {
          setVoiceLevelPills(0);
        }
        animId = requestAnimationFrame(simulateLevel);
      };
      animId = requestAnimationFrame(simulateLevel);
    }

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try {
          source.disconnect();
        } catch {}
      }
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          void audioCtx.close();
        } catch {}
      }
    };
  }, [stream, isSpeaking]);

  const levelPct = Math.min(100, Math.max(0, ((voiceLevelPills || (isSpeaking ? 5 : 0)) / 8) * 100));

  return (
    <div className={`flex flex-col gap-2.5 w-full max-w-[340px] select-none ${className}`}>
      {/* Simplified: Nível de voz — horizontal bar h-1 bg-white/15 rounded-full with fill per audit */}
      <div className="flex items-center justify-between gap-4 rounded-2xl p-3 bg-black/40 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">
          Nível de voz
        </span>

        {/* Horizontal bar replacing •••••••• dots */}
        <div className="flex-1 max-w-[120px] h-1 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-100"
            style={{ width: `${levelPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
