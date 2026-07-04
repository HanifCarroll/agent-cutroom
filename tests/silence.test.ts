import { describe, expect, it } from "vitest";
import { parseSilencedetect } from "../src/core/ffmpeg.js";

describe("parseSilencedetect", () => {
  it("parses FFmpeg silence ranges", () => {
    const ranges = parseSilencedetect(`
[silencedetect @ 0x1] silence_start: 2.112
[silencedetect @ 0x1] silence_end: 3.054 | silence_duration: 0.942
[silencedetect @ 0x1] silence_start: 8
[silencedetect @ 0x1] silence_end: 9.2 | silence_duration: 1.2
`);
    expect(ranges).toEqual([
      { id: "silence-001", startMs: 2112, endMs: 3054, durationMs: 942 },
      { id: "silence-002", startMs: 8000, endMs: 9200, durationMs: 1200 },
    ]);
  });
});
