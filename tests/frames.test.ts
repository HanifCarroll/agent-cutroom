import { describe, expect, it } from "vitest";
import { chooseFrameTimestamps } from "../src/core/frames.js";
import type { Timeline } from "../src/core/schema.js";

function timeline(durationMs: number): Timeline {
  return {
    version: 1,
    media: {
      path: "source/source.mp4",
      durationMs,
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      videoBitrateBps: 8_000_000,
      audioBitrateBps: 192_000,
      overallBitrateBps: 8_192_000,
      hasAudio: true,
      hasVideo: true,
      sizeBytes: 1000,
      formatName: "mov,mp4",
    },
    transcriptSegments: [],
    transcriptUntimedText: null,
    warnings: [],
    silences: [],
    frames: [],
    windows: [],
    observations: [],
  };
}

describe("chooseFrameTimestamps", () => {
  it("preserves interval coverage before adding silence boundary frames", () => {
    const result = chooseFrameTimestamps({
      timeline: {
        ...timeline(150_000),
        silences: Array.from({ length: 12 }, (_, index) => ({
          id: `silence-${index}`,
          startMs: 10_000 + index * 1_000,
          endMs: 10_700 + index * 1_000,
          durationMs: 700,
        })),
      },
      intervalMs: 10_000,
      maxFrames: 24,
    });

    expect(result).toContain(0);
    expect(result).toContain(100_000);
    expect(result).toContain(140_000);
    expect(result).toContain(149_999);
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it("samples evenly when interval coverage alone exceeds the maximum", () => {
    const result = chooseFrameTimestamps({
      timeline: timeline(300_000),
      intervalMs: 5_000,
      maxFrames: 6,
    });

    expect(result).toEqual([0, 60_000, 120_000, 179_999, 239_999, 299_999]);
  });
});
