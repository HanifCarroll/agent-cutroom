import { describe, expect, it } from "vitest";
import { createEditPlan } from "../src/core/plan.js";
import type { Timeline } from "../src/core/schema.js";

const baseTimeline: Timeline = {
  version: 1,
  media: {
    path: "source/source.mp4",
    durationMs: 10_000,
    width: 1280,
    height: 720,
    fps: 30,
    hasAudio: true,
    hasVideo: true,
    sizeBytes: 1000,
    formatName: "mov,mp4",
  },
  transcriptSegments: [],
  transcriptUntimedText: null,
  transcriptProvenance: null,
  warnings: [],
  silences: [
    { id: "silence-001", startMs: 2000, endMs: 3000, durationMs: 1000 },
    { id: "silence-002", startMs: 6000, endMs: 6300, durationMs: 300 },
  ],
  frames: [],
  windows: [
    {
      id: "window-001",
      startMs: 0,
      endMs: 5000,
      timestamp: "0:00.000-0:05.000",
      transcriptText: "",
      frameIds: [],
      silenceIds: ["silence-001"],
    },
  ],
  observations: [],
};

describe("createEditPlan", () => {
  it("cuts long silences but leaves short pauses", () => {
    const plan = createEditPlan({
      timeline: baseTimeline,
      sourcePath: "source/source.mp4",
      minSilenceMs: 700,
      minKeepMs: 300,
    });
    expect(plan.segments.map((segment) => [segment.sourceStartMs, segment.sourceEndMs])).toEqual([
      [0, 2000],
      [3000, 10_000],
    ]);
  });

  it("cuts windows marked by agent observations", () => {
    const plan = createEditPlan({
      timeline: {
        ...baseTimeline,
        observations: [
          {
            id: "obs-001",
            windowId: "window-001",
            createdAt: "2026-07-04T00:00:00.000Z",
            visualSummary: "bad take",
            visibleText: "",
            editingUse: "cut",
            brollNeed: "none",
            notes: [],
          },
        ],
      },
      sourcePath: "source/source.mp4",
      minSilenceMs: 700,
      minKeepMs: 300,
    });
    expect(plan.segments.map((segment) => [segment.sourceStartMs, segment.sourceEndMs])).toEqual([
      [5000, 10_000],
    ]);
  });
});
