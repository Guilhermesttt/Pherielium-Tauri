import { describe, expect, it } from "vitest";
import { currentPosition, formatClock, parseTimeline, progressFraction } from "./progressMath";

describe("mediaProgress", () => {
  it("sem duração não há linha do tempo", () => {
    expect(parseTimeline({ durationSeconds: 0, positionSeconds: 5 }, true, 1000)).toBeNull();
    expect(parseTimeline(null, true, 1000)).toBeNull();
  });

  it("a posição anda desde a medição enquanto toca", () => {
    const t = parseTimeline({ positionSeconds: 80, durationSeconds: 215, updatedAtMs: 10_000 }, true, 10_500)!;
    expect(currentPosition(t, 15_000)).toBeCloseTo(85, 5);
    expect(progressFraction(t, 15_000)).toBeCloseTo(85 / 215, 5);
  });

  it("pausado não anda e nunca passa da duração", () => {
    const paused = parseTimeline({ positionSeconds: 80, durationSeconds: 215, updatedAtMs: 10_000 }, false, 10_500)!;
    expect(currentPosition(paused, 99_000)).toBe(80);
    const playing = parseTimeline({ positionSeconds: 200, durationSeconds: 215, updatedAtMs: 10_000 }, true, 10_500)!;
    expect(currentPosition(playing, 900_000)).toBe(215);
  });

  it("timestamp no futuro ou ausente usa o instante da leitura", () => {
    const t = parseTimeline({ positionSeconds: 10, durationSeconds: 100, updatedAtMs: 9_999_999_999 }, true, 50_000)!;
    expect(t.sampledAtMs).toBe(50_000);
    expect(parseTimeline({ positionSeconds: 10, durationSeconds: 100 }, true, 50_000)!.sampledAtMs).toBe(50_000);
  });

  it("formata m:ss e h:mm:ss", () => {
    expect(formatClock(80)).toBe("1:20");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});
