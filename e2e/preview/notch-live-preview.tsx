import React from "react";
import { createRoot } from "react-dom/client";
import { CallIncomingBar } from "../../src/components/notch/live/CallIncomingBar";
import { VoiceBars } from "../../src/components/notch/live/VoiceBars";
import { MediaProgress } from "../../src/components/notch/live/MediaProgress";
import { MusicWaveform } from "../../src/components/notch/MusicWaveform";
import { PherieMascot } from "../../src/components/notch/PherieMascot";
import { LIVE_WIDTH } from "../../src/components/notch/live/liveActivity";

const Pill: React.FC<{ width: number; children: React.ReactNode; label: string }> = ({ width, children, label }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ color: "#888", font: "11px system-ui", marginBottom: 6 }}>{label}</div>
    <div
      style={{ width, height: 52, background: "#000", borderRadius: "0 0 26px 26px", padding: "0 12px", display: "flex", alignItems: "center", gap: 8, color: "#fff" }}
    >
      {children}
    </div>
  </div>
);

const Avatar = (
  <span style={{ width: 34, height: 34, borderRadius: 999, background: "#164e3f", color: "#6ee7b7", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
    T
  </span>
);

const level = { current: 0.5 };
const timeline = { current: { positionSeconds: 80, durationSeconds: 215, sampledAtMs: Date.now(), playing: false } };

const Preview: React.FC = () => (
  <div>
    <Pill width={LIVE_WIDTH["call-incoming"]} label="chamada recebida">
      <CallIncomingBar name="Tania Castillo" avatar={Avatar} onAccept={() => {}} onReject={() => {}} />
    </Pill>
    <Pill width={LIVE_WIDTH.call} label="chamada em andamento">
      <PherieMascot size={38} mood="calling" inCall />
      <span style={{ flex: 1, font: "600 12px system-ui" }}>Tania Castillo</span>
      <VoiceBars levelRef={level} speaking />
      <span style={{ font: "600 12px ui-monospace, monospace" }}>01:14</span>
    </Pill>
    <div style={{ width: 448, background: "#141518", borderRadius: 20, padding: 12, overflow: "hidden", color: "#fff", font: "13px system-ui" }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Glow · Echo</div>
      <MediaProgress timelineRef={timeline} />
      <div style={{ margin: "10px -12px -12px" }}>
        <MusicWaveform playing />
      </div>
    </div>
  </div>
);

export function mount(el: HTMLElement) {
  createRoot(el).render(<Preview />);
}
