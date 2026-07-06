import { describe, expect, it } from "vitest";
import {
  HANIF_CONTENT_PROFILE,
  TALKING_HEAD_STORY_RECIPE,
  StoryCandidatesSchema,
  buildContentPackage,
} from "../src/core/content-package/index.js";
import type { ContentProfile } from "../src/core/content-package/index.js";
import type { Timeline } from "../src/core/schema.js";

export const contentPackageTimeline: Timeline = {
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

function buildHanif(maxCandidates = 4) {
  return buildContentPackage({
    timeline: contentPackageTimeline,
    sourcePath: "source/source.mov",
    title: "Test Tripod Video",
    recipe: TALKING_HEAD_STORY_RECIPE,
    profile: HANIF_CONTENT_PROFILE,
    targetDurationMs: 65_000,
    minDurationMs: 30_000,
    maxDurationMs: 90_000,
    maxCandidates,
    leadPaddingMs: 800,
    tailPaddingMs: 1200,
  });
}

describe("content package", () => {
  it("selects a source-backed story candidate and writes a matching edit plan", () => {
    const result = buildHanif();

    expect(result.storyCandidates.recipe.id).toBe("talking-head-story");
    expect(result.storyCandidates.profile.id).toBe("hanif");
    expect(result.storyCandidates.candidates.length).toBeGreaterThan(0);
    expect(result.selectedCandidate?.suggestedArtifacts).toContain("clip");
    expect(result.selectedCandidate?.theme).toBe("public-building-proof");
    expect(result.selectedCandidate?.id).toBe("story-000000000-000055000");
    expect(result.editPlan?.segments).toHaveLength(1);
    expect(result.editPlan?.segments[0]?.sourceStartMs).toBe(0);
    expect(result.editPlan?.segments[0]?.sourceEndMs).toBe(56_200);
    expect(result.editPlan?.segments[0]?.sourceWindowIds).toContain("window-001");
    expect(result.inventoryMarkdown).toContain("Recipe: talking-head-story v1");
    expect(result.selectionMarkdown).toContain("## Selected Candidate");
  });

  it("keeps candidate ids stable when the retained count changes", () => {
    const one = buildHanif(1);
    const many = buildHanif(4);

    expect(one.selectedCandidate?.id).toBe(many.selectedCandidate?.id);
    expect(one.selectedCandidate?.id).toMatch(/^story-\d{9}-\d{9}$/);
  });

  it("fails loudly when a forced selection is missing", () => {
    expect(() =>
      buildContentPackage({
        timeline: contentPackageTimeline,
        sourcePath: "source/source.mov",
        title: "Test Tripod Video",
        recipe: TALKING_HEAD_STORY_RECIPE,
        profile: HANIF_CONTENT_PROFILE,
        selectedId: "story-does-not-exist",
      }),
    ).toThrow("Unknown story candidate id");
  });

  it("supports a non-Hanif profile without Hanif-specific strings", () => {
    const profile: ContentProfile = {
      ...HANIF_CONTENT_PROFILE,
      id: "public-builder",
      label: "Public Builder",
      inventoryTitle: "Public Builder Content Inventory",
      defaults: {
        ...HANIF_CONTENT_PROFILE.defaults,
        objective: "Find source-backed public building moments.",
      },
    };

    const result = buildContentPackage({
      timeline: contentPackageTimeline,
      sourcePath: "source/source.mov",
      title: "Test Tripod Video",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile,
    });

    expect(result.storyCandidates.profile.id).toBe("public-builder");
    expect(result.inventoryMarkdown).toContain("# Public Builder Content Inventory");
  });

  it("validates persisted story candidate artifacts", () => {
    const result = buildHanif();
    expect(StoryCandidatesSchema.parse(result.storyCandidates).selectedCandidateId).toBe(
      result.selectedCandidate?.id,
    );
    expect(() => StoryCandidatesSchema.parse({ version: 1, candidates: [{ id: "missing-fields" }] })).toThrow();
  });
});
