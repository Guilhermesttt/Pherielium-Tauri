import { describe, expect, it } from "vitest";
import { accumulateLevel, emptyLevelWindow, summarizeLevel } from "./desktopAudioCapture";

describe("desktop audio level window", () => {
  it("reports zero for an empty window", () => {
    expect(summarizeLevel(emptyLevelWindow())).toEqual({ packets: 0, silentPackets: 0, rms: 0, peak: 0 });
  });

  it("counts silent packets and keeps the loudest peak", () => {
    const window = emptyLevelWindow();
    accumulateLevel(window, 0, 0, 480); // silêncio digital
    accumulateLevel(window, 0.0001, 0, 480); // abaixo do limiar de silêncio
    accumulateLevel(window, 0.5, 480 * 0.25, 480); // pacote com som
    const summary = summarizeLevel(window);
    expect(summary.packets).toBe(3);
    expect(summary.silentPackets).toBe(2);
    expect(summary.peak).toBe(0.5);
    expect(summary.rms).toBeGreaterThan(0);
  });

  it("computes rms over all samples of the window", () => {
    const window = emptyLevelWindow();
    accumulateLevel(window, 1, 100, 100); // rms = 1
    accumulateLevel(window, 0, 0, 100); // rms = 0
    // sqrt((100 + 0) / 200) = 0.70711
    expect(summarizeLevel(window).rms).toBeCloseTo(0.70711, 4);
  });
});
