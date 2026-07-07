import { describe, expect, it } from "vitest";
import { buildHanifContentPackage } from "../src/core/hanif-content-package.js";
import type { Timeline } from "../src/core/schema.js";

const timeline: Timeline = {
  version: 1,
  media: {
    path: "source/source.mov",
    durationMs: 120_000,
    width: 2160,
    height: 3840,
    fps: 60,
    hasAudio: true,
    hasVideo: true,
    sizeBytes: 1000,
    formatName: "mov,mp4",
  },
  transcriptSegments: [
    {
      id: "seg-0001",
      startMs: 0,
      endMs: 20_000,
      text: "I was testing the tripod and talking through the setup.",
      words: [],
    },
    {
      id: "seg-0002",
      startMs: 20_000,
      endMs: 55_000,
      text: "That's an important thing, actually do things. I've been building a lot of software myself, but I never published anything. That was a huge mistake and a missed opportunity to share what I'm building with the world.",
      words: [{ id: "word-001", startMs: 20_000, endMs: 20_300, text: "That's", probability: 0.99 }],
    },
    {
      id: "seg-0003",
      startMs: 55_000,
      endMs: 85_000,
      text: "You need people to try it so that you can get feedback and improve it. The point is to talk about what you are doing and attract people interested in the same thing.",
      words: [{ id: "word-002", startMs: 55_000, endMs: 55_300, text: "You", probability: 0.99 }],
    },
  ],
  transcriptUntimedText: null,
  transcriptProvenance: null,
  warnings: [],
  silences: [],
  frames: [
    {
      id: "frame-001",
      atMs: 40_000,
      timestamp: "0:40.000",
      path: "frames/frame.jpg",
      reason: "sampled",
    },
  ],
  windows: [
    {
      id: "window-001",
      startMs: 0,
      endMs: 60_000,
      timestamp: "0:00.000-1:00.000",
      transcriptText: "talking head",
      frameIds: ["frame-001"],
      silenceIds: [],
    },
    {
      id: "window-002",
      startMs: 60_000,
      endMs: 120_000,
      timestamp: "1:00.000-2:00.000",
      transcriptText: "talking head",
      frameIds: [],
      silenceIds: [],
    },
  ],
  observations: [],
};

describe("buildHanifContentPackage", () => {
  it("selects a source-backed story candidate and writes a matching edit plan", () => {
    const result = buildHanifContentPackage({
      timeline,
      sourcePath: "source/source.mov",
      title: "Test Tripod Video",
      targetDurationMs: 65_000,
      minDurationMs: 30_000,
      maxDurationMs: 90_000,
      maxCandidates: 4,
      leadPaddingMs: 800,
      tailPaddingMs: 1200,
    });

    expect(result.storyCandidates.candidates.length).toBeGreaterThan(0);
    expect(result.selectedCandidate?.suggestedArtifacts).toContain("clip");
    expect(result.selectedCandidate?.theme).toBe("public-building-proof");
    expect(result.editPlan?.segments).toHaveLength(1);
    expect(result.editPlan?.segments[0]?.sourceWindowIds).toContain("window-001");
    expect(result.inventoryMarkdown).toContain("## Repeatable Process");
    expect(result.selectionMarkdown).toContain("## Selected Candidate");
  });
});
