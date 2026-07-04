import { describe, expect, it } from "vitest";
import { findMoments } from "../src/core/find-moments.js";
import type { Timeline } from "../src/core/schema.js";

const timeline: Timeline = {
  version: 1,
  media: null,
  transcriptSegments: [
    {
      id: "seg-0001",
      startMs: 0,
      endMs: 5000,
      text: "This is the useful moment.",
      words: [],
    },
  ],
  transcriptUntimedText: null,
  transcriptProvenance: null,
  warnings: [],
  silences: [],
  frames: [
    {
      id: "frame-001",
      atMs: 1000,
      timestamp: "0:01.000",
      path: "frames/frame.jpg",
      reason: "sampled",
    },
  ],
  windows: [
    {
      id: "window-001",
      startMs: 0,
      endMs: 5000,
      timestamp: "0:00.000-0:05.000",
      transcriptText: "This is the useful moment.",
      frameIds: ["frame-001"],
      silenceIds: [],
    },
  ],
  observations: [
    {
      id: "obs-001",
      windowId: "window-001",
      createdAt: "2026-07-04T00:00:00.000Z",
      visualSummary: "strong opening",
      visibleText: "",
      editingUse: "keep",
      brollNeed: "none",
      notes: [],
    },
  ],
};

describe("findMoments", () => {
  it("returns candidate windows with reasons and evidence", () => {
    const result = findMoments({
      timeline,
      objective: "Find a hook.",
      targetDurationMs: 5000,
      maxCandidates: 3,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.reason).toBe("strong opening");
    expect(result.candidates[0]?.evidence).toContain("obs-001: agent marked keep");
    expect(result.candidates[0]?.sourceFrameIds).toEqual(["frame-001"]);
  });
});
