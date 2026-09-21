import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type ScreenShareFrame = {
  jpeg?: string;
  width?: number;
  height?: number;
};

type ScreenShareAudio = {
  pcm?: string;
  sampleRate?: number;
  channels?: number;
  format?: string;
};

type ScreenShareStartResult = {
  active?: boolean;
  audio?: boolean;
  sampleRate?: number;
  channels?: number;
};

function decodeBase64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function attachLoopbackAudio(
  stream: MediaStream,
  sampleRate: number,
  channels: number,
): { play: (pcm: Uint8Array, rate: number, ch: number) => void; stop: () => void } {
  const ctx = new AudioContext({ sampleRate: sampleRate || 48000 });
  const destination = ctx.createMediaStreamDestination();
  const audioTrack = destination.stream.getAudioTracks()[0];
  if (audioTrack) {
    stream.addTrack(audioTrack);
  }
  void ctx.resume().catch(() => { /* ignore */ });

  let nextTime = 0;
  const play = (pcm: Uint8Array, rate: number, ch: number) => {
    if (ctx.state === "closed") return;
    const channelCount = Math.max(1, ch || channels || 1);
    const frames = Math.floor(pcm.byteLength / 2 / channelCount);
    if (frames <= 0) return;

    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const buffer = ctx.createBuffer(channelCount, frames, rate || ctx.sampleRate);
    for (let channel = 0; channel < channelCount; channel += 1) {
      const dest = buffer.getChannelData(channel);
      for (let i = 0; i < frames; i += 1) {
        dest[i] = view.getInt16((i * channelCount + channel) * 2, true) / 32768;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    const now = ctx.currentTime;
    if (nextTime < now + 0.04) {
      nextTime = now + 0.04;
    }
    source.start(nextTime);
    nextTime += buffer.duration;
  };

  const stop = () => {
    try {
      destination.disconnect();
    } catch { /* ignore */ }
    void ctx.close().catch(() => { /* ignore */ });
  };

  return { play, stop };
}

export async function createTauriScreenCaptureStream(options: {
  targetId: string;
  width: number;
  height: number;
  fps: number;
  withAudio?: boolean;
}): Promise<{ stream: MediaStream; stop: () => Promise<void>; hasAudio: boolean }> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, options.width);
  canvas.height = Math.max(2, options.height);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) {
    throw new Error("Canvas 2D indisponível para captura nativa.");
  }

  const stream = canvas.captureStream(options.fps);
  const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & { contentHint?: string };
  if (videoTrack) {
    videoTrack.contentHint = options.fps >= 60 ? "motion" : "detail";
  }

  const image = new Image();
  let stopped = false;
  let firstFrameDone = false;
  let audioPlayer: ReturnType<typeof attachLoopbackAudio> | null = null;

  const unlistenFrame: UnlistenFn = await listen<ScreenShareFrame>("screen-share:frame", (event) => {
    if (stopped) return;
    const jpeg = String(event.payload?.jpeg || "").trim();
    if (!jpeg) return;
    image.src = jpeg.startsWith("data:") ? jpeg : `data:image/jpeg;base64,${jpeg}`;
  });

  let unlistenAudio: UnlistenFn | null = null;
  if (options.withAudio !== false) {
    unlistenAudio = await listen<ScreenShareAudio>("screen-share:audio", (event) => {
      if (stopped || !audioPlayer) return;
      const pcmB64 = String(event.payload?.pcm || "").trim();
      if (!pcmB64) return;
      audioPlayer.play(
        decodeBase64Bytes(pcmB64),
        Number(event.payload?.sampleRate) || 48000,
        Number(event.payload?.channels) || 2,
      );
    });
  }

  const firstFrame = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Timeout ao capturar a fonte selecionada."));
    }, 8000);
    image.onload = () => {
      if (stopped) return;
      const width = image.naturalWidth || options.width;
      const height = image.naturalHeight || options.height;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (!firstFrameDone) {
        firstFrameDone = true;
        window.clearTimeout(timer);
        resolve();
      }
    };
    image.onerror = () => {
      if (!firstFrameDone) {
        // Keep waiting for a later good frame.
      }
    };
  });

  const cleanupListeners = async () => {
    try { await unlistenFrame(); } catch { /* ignore */ }
    if (unlistenAudio) {
      try { await unlistenAudio(); } catch { /* ignore */ }
    }
    audioPlayer?.stop();
    audioPlayer = null;
  };

  try {
    const started = await invoke<ScreenShareStartResult>("screen_share_start_frames", {
      targetId: options.targetId,
      fps: options.fps,
      maxWidth: options.width,
      maxHeight: options.height,
      withAudio: options.withAudio !== false,
    });
    if (options.withAudio !== false && started?.audio) {
      audioPlayer = attachLoopbackAudio(
        stream,
        Number(started.sampleRate) || 48000,
        Number(started.channels) || 2,
      );
    }
    await firstFrame;
    return {
      stream,
      hasAudio: Boolean(audioPlayer && stream.getAudioTracks().length > 0),
      stop: async () => {
        if (stopped) return;
        stopped = true;
        await cleanupListeners();
        try { await invoke("screen_share_stop"); } catch { /* ignore */ }
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* ignore */ }
        });
      },
    };
  } catch (err) {
    stopped = true;
    await cleanupListeners();
    try { await invoke("screen_share_stop"); } catch { /* ignore */ }
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* ignore */ }
    });
    throw err;
  }
}
