import { describe, expect, it } from "vitest";
import { createCaptionPlan, renderAss } from "../src/core/captions.js";
import type { EditPlan, Timeline } from "../src/core/schema.js";

const timeline: Timeline = {
  version: 1,
  media: null,
  transcriptSegments: [
    {
      id: "seg-0001",
      startMs: 0,
      endMs: 3000,
      text: "first second third",
      words: [
        { id: "w1", startMs: 0, endMs: 500, text: "first", probability: null },
        { id: "w2", startMs: 500, endMs: 1000, text: "second", probability: null },
        { id: "w3", startMs: 2000, endMs: 2500, text: "third", probability: null },
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
      sourceStartMs: 500,
      sourceEndMs: 3000,
      reason: "keep after first word",
      sourceWindowIds: [],
      evidence: [],
      confidence: 1,
      warnings: [],
    },
  ],
  notes: [],
};

describe("captions", () => {
  it("maps source word timings through the edit plan", async () => {
    const plan = await createCaptionPlan({
      projectDir: ".",
      timeline,
      sourceMediaPath: "source/source.mp4",
      targetMediaPath: "renders/rough-cut.mp4",
      subtitlePath: "captions/captions.ass",
      outputPath: "renders/captioned.mp4",
      format: "ass",
      editPlan,
    });

    expect(plan.events.map((event) => [event.activeWord, event.startMs, event.endMs])).toEqual([
      ["second", 0, 620],
      ["third", 1500, 2120],
    ]);
  });

  it("keeps captions visible across normal word gaps", async () => {
    const fastTimeline: Timeline = {
      ...timeline,
      transcriptSegments: [
        {
          ...timeline.transcriptSegments[0]!,
          text: "first second",
          words: [
            { id: "w1", startMs: 0, endMs: 500, text: "first", probability: null },
            { id: "w2", startMs: 620, endMs: 1000, text: "second", probability: null },
          ],
        },
      ],
    };
    const plan = await createCaptionPlan({
      projectDir: ".",
      timeline: fastTimeline,
      sourceMediaPath: "source/source.mp4",
      targetMediaPath: "source/source.mp4",
      subtitlePath: "captions/captions.ass",
      outputPath: null,
      format: "ass",
      editPlan: null,
    });

    expect(plan.events.map((event) => [event.activeWord, event.startMs, event.endMs])).toEqual([
      ["first", 0, 620],
      ["second", 620, 1120],
    ]);
  });

  it("writes active-word ASS override styling", async () => {
    const plan = await createCaptionPlan({
      projectDir: ".",
      timeline,
      sourceMediaPath: "source/source.mp4",
      targetMediaPath: "source/source.mp4",
      subtitlePath: "captions/captions.ass",
      outputPath: null,
      format: "ass",
      editPlan: null,
    });
    expect(renderAss(plan)).toContain("{\\c&H0000E5FF\\b1}first");
  });

  it("breaks ASS caption lines at the style word limit", async () => {
    const plan = await createCaptionPlan({
      projectDir: ".",
      timeline: {
        ...timeline,
        transcriptSegments: [
          {
            ...timeline.transcriptSegments[0]!,
            text: "first second third fourth",
            words: [
              { id: "w1", startMs: 0, endMs: 200, text: "first", probability: null },
              { id: "w2", startMs: 200, endMs: 400, text: "second", probability: null },
              { id: "w3", startMs: 400, endMs: 600, text: "third", probability: null },
              { id: "w4", startMs: 600, endMs: 800, text: "fourth", probability: null },
            ],
          },
        ],
      },
      sourceMediaPath: "source/source.mp4",
      targetMediaPath: "source/source.mp4",
      subtitlePath: "captions/captions.ass",
      outputPath: null,
      format: "ass",
      editPlan: null,
    });

    expect(renderAss(plan)).toContain("first second third\\N{\\c&H0000E5FF\\b1}fourth");
  });

  it("warns instead of inventing word timings", async () => {
    const plan = await createCaptionPlan({
      projectDir: ".",
      timeline: { ...timeline, transcriptSegments: [{ ...timeline.transcriptSegments[0]!, words: [] }] },
      sourceMediaPath: "source/source.mp4",
      targetMediaPath: "source/source.mp4",
      subtitlePath: "captions/captions.ass",
      outputPath: null,
      format: "ass",
      editPlan: null,
    });
    expect(plan.events).toEqual([]);
    expect(plan.warnings[0]).toContain("word timings");
  });
});
