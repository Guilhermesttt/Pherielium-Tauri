import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type DesktopAudioPacket = {
  pcm?: string;
  sampleRate?: number;
  channels?: number;
};

type DesktopAudioStart = {
  active?: boolean;
  sampleRate?: number;
  channels?: number;
};

const decodeBase64Bytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const canCaptureDesktopAudio = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * WASAPI process loopback that excludes this app. Playback on the speakers
 * is left untouched; the returned stream is only for publishing.
 */
export async function startDesktopAudioCapture(): Promise<{
  stream: MediaStream;
  stop: () => Promise<void>;
}> {
  if (!canCaptureDesktopAudio()) {
    throw new Error("Captura de audio de desktop indisponivel.");
  }

  const started = await invoke<DesktopAudioStart>("desktop_audio_start");
  const sampleRate = Number(started?.sampleRate) || 48000;
  const channels = Number(started?.channels) || 2;
  const ctx = new AudioContext({ sampleRate });
  const destination = ctx.createMediaStreamDestination();
  const stream = destination.stream;
  let nextTime = 0;
  let stopped = false;

  const play = (pcm: Uint8Array, rate: number, channelCount: number) => {
    if (stopped || ctx.state === "closed") return;
    const count = Math.max(1, channelCount || channels);
    const frames = Math.floor(pcm.byteLength / 2 / count);
    if (frames <= 0) return;
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const buffer = ctx.createBuffer(count, frames, rate || ctx.sampleRate);
    for (let channel = 0; channel < count; channel += 1) {
      const dest = buffer.getChannelData(channel);
      for (let i = 0; i < frames; i += 1) {
        dest[i] = view.getInt16((i * count + channel) * 2, true) / 32768;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    const now = ctx.currentTime;
    if (nextTime < now + 0.04) nextTime = now + 0.04;
    source.start(nextTime);
    nextTime += buffer.duration;
  };

  const unlisten: UnlistenFn = await listen<DesktopAudioPacket>("screen-share:audio", (event) => {
    if (stopped) return;
    const pcm = String(event.payload?.pcm || "").trim();
    if (!pcm) return;
    play(
      decodeBase64Bytes(pcm),
      Number(event.payload?.sampleRate) || sampleRate,
      Number(event.payload?.channels) || channels,
    );
  });

  void ctx.resume().catch(() => undefined);

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await unlisten(); } catch { /* ignore */ }
    try { await invoke("desktop_audio_stop"); } catch { /* ignore */ }
    try { destination.disconnect(); } catch { /* ignore */ }
    void ctx.close().catch(() => undefined);
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* ignore */ }
    });
  };

  if (stream.getAudioTracks().length === 0) {
    await stop();
    throw new Error("Loopback por processo nao gerou faixa de audio.");
  }

  return { stream, stop };
}
