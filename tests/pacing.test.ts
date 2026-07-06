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
      endMs: 4200,
      text: "first second third",
      words: [
        { id: "w1", startMs: 1000, endMs: 1200, text: "first", probability: null },
        { id: "w2", startMs: 1800, endMs: 2000, text: "second", probability: null },
        { id: "w3", startMs: 2700, endMs: 2900, text: "third", probability: null },
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
      sourceEndMs: 3200,
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
      [1720, 2080],
      [2620, 3120],
    ]);
    expect(result.pacingPlan.beforeDurationMs).toBe(2400);
    expect(result.pacingPlan.afterDurationMs).toBe(1260);
    expect(result.pacingPlan.removedMs).toBe(1140);
    expect(result.pacingPlan.cuts.map((cut) => cut.reason)).toEqual([
      "trimmed leading non-speech padding",
      "tightened transcript-word pause",
      "tightened transcript-word pause",
      "trimmed trailing non-speech padding",
    ]);
    expect(result.pacingPlan.cuts.map((cut) => cut.classification)).toEqual([
      "dead-air",
      "dead-air",
      "dead-air",
      "dead-air",
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
      [800, 3200],
    ]);
    expect(result.pacingPlan.warnings[0]).toContain("No transcript word timings");
  });

  it("protects rhetorical question-chain pauses", () => {
    const result = createShortFormPacing({
      timeline: {
        ...timeline,
        transcriptSegments: [
          {
            id: "seg-questions",
            startMs: 0,
            endMs: 6000,
            text: "clear. Who is this for? What does it do? And why would I want this? In the product",
            words: [
              { id: "q1", startMs: 100, endMs: 500, text: "clear.", probability: null },
              { id: "q2", startMs: 940, endMs: 1100, text: "Who", probability: null },
              { id: "q3", startMs: 1100, endMs: 1200, text: "is", probability: null },
              { id: "q4", startMs: 1200, endMs: 1400, text: "for?", probability: null },
              { id: "q5", startMs: 1840, endMs: 2000, text: "What", probability: null },
              { id: "q6", startMs: 2000, endMs: 2200, text: "does", probability: null },
              { id: "q7", startMs: 2200, endMs: 2400, text: "do?", probability: null },
              { id: "q8", startMs: 2960, endMs: 3100, text: "And", probability: null },
              { id: "q9", startMs: 3100, endMs: 3300, text: "why", probability: null },
              { id: "q10", startMs: 3300, endMs: 3500, text: "this?", probability: null },
              { id: "q11", startMs: 4720, endMs: 4900, text: "In", probability: null },
              { id: "q12", startMs: 4900, endMs: 5100, text: "product", probability: null },
            ],
          },
        ],
      },
      editPlan: {
        ...editPlan,
        segments: [{ ...editPlan.segments[0]!, sourceStartMs: 0, sourceEndMs: 5400 }],
      },
      sourceEditPlanPath: "edit-plan.json",
      outputEditPlanPath: "edit-plan.json",
      options: {
        minPauseMs: 350,
        minCutMs: 120,
      },
    });

    expect(result.pacingPlan.protectedPauses.map((pause) => [pause.precedingWord, pause.followingWord])).toEqual([
      ["clear.", "Who"],
      ["for?", "What"],
      ["do?", "And"],
    ]);
    expect(result.pacingPlan.cuts.some((cut) => cut.precedingWord === "for?")).toBe(false);
    expect(result.pacingPlan.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          precedingWord: "this?",
          followingWord: "In",
          removedMs: 860,
          classification: "semantic-beat",
        }),
      ]),
    );
  });
});
