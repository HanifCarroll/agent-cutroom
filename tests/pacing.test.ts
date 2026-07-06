import { describe, expect, it } from "vitest";
import { createShortFormPacing } from "../src/core/pacing.js";
import type { EditPlan, Timeline } from "../src/core/schema.js";

const timeline: Timeline = {
  version: 1,
  media: null,
  transcriptSegments: [
    {
      id: "seg-0001",
      startMs: 0,
      endMs: 4000,
      text: "first second third",
      words: [
        { id: "w1", startMs: 1000, endMs: 1200, text: "first", probability: null },
        { id: "w2", startMs: 1700, endMs: 1900, text: "second", probability: null },
        { id: "w3", startMs: 2300, endMs: 2500, text: "third", probability: null },
      ],
    },
  ],
  transcriptUntimedText: null,
  transcriptProvenance: null,
  warnings: [],
  silences: [],
  frames: [],
  windows: [],
  observations: [],
};

const editPlan: EditPlan = {
  version: 1,
  createdAt: "2026-07-04T00:00:00.000Z",
  sourcePath: "source/source.mp4",
  segments: [
    {
      id: "keep-001",
      sourceStartMs: 800,
      sourceEndMs: 2800,
      reason: "selected story",
      sourceWindowIds: [],
      evidence: [],
      confidence: 1,
      warnings: [],
    },
  ],
  notes: [],
};

describe("createShortFormPacing", () => {
  it("cuts long word-boundary pauses while preserving short breath gaps", () => {
    const result = createShortFormPacing({
      timeline,
      editPlan,
      sourceEditPlanPath: "edit-plan.json",
      outputEditPlanPath: "edit-plan.json",
    });

    expect(result.editPlan.segments.map((segment) => [segment.sourceStartMs, segment.sourceEndMs])).toEqual([
      [880, 1280],
      [1620, 1980],
      [2220, 2720],
    ]);
    expect(result.pacingPlan.beforeDurationMs).toBe(2000);
    expect(result.pacingPlan.afterDurationMs).toBe(1260);
    expect(result.pacingPlan.removedMs).toBe(740);
    expect(result.pacingPlan.cuts.map((cut) => cut.reason)).toEqual([
      "trimmed leading non-speech padding",
      "tightened transcript-word pause",
      "tightened transcript-word pause",
      "trimmed trailing non-speech padding",
    ]);
  });

  it("leaves the edit plan unchanged when no word timings are available", () => {
    const result = createShortFormPacing({
      timeline: { ...timeline, transcriptSegments: [{ ...timeline.transcriptSegments[0]!, words: [] }] },
      editPlan,
      sourceEditPlanPath: "edit-plan.json",
      outputEditPlanPath: "edit-plan.json",
    });

    expect(result.editPlan.segments.map((segment) => [segment.sourceStartMs, segment.sourceEndMs])).toEqual([
      [800, 2800],
    ]);
    expect(result.pacingPlan.warnings[0]).toContain("No transcript word timings");
  });
});
