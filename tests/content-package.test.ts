import { describe, expect, it } from "vitest";
import {
  HANIF_CONTENT_PROFILE,
  TALKING_HEAD_STORY_RECIPE,
  ClipSlateSchema,
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
    videoCodec: "hevc",
    audioCodec: "aac",
    videoBitrateBps: 75_000_000,
    audioBitrateBps: 192_000,
    overallBitrateBps: 75_192_000,
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
  it("proposes source-backed clip candidates before approval", () => {
    const result = buildHanif();

    expect(result.storyCandidates.recipe.id).toBe("talking-head-story");
    expect(result.storyCandidates.profile.id).toBe("hanif");
    expect(result.storyCandidates.candidates.length).toBeGreaterThan(0);
    expect(result.selectedCandidate).toBeNull();
    expect(result.editPlan).toBeNull();
    expect(result.approvedEditPlans).toHaveLength(0);
    expect(result.clipSlate.approvalStatus).toBe("needs_approval");
    expect(result.clipSlate.clips[0]?.candidateId).toBe("story-000000000-000085000");
    expect(result.clipSlate.clips[0]?.approvalStatus).toBe("proposed");
    expect(result.clipSlate.clips[0]?.transcriptExcerpt).toContain("testing the tripod");
    expect(result.clipSlate.clips[0]).not.toHaveProperty("title");
    expect(result.clipSlate.clips[0]).not.toHaveProperty("point");
    expect(result.inventoryMarkdown).toContain("Recipe: talking-head-story v1");
    expect(result.candidateEvidenceMarkdown).toContain("## Agent Slate Required");
    expect(result.selectionMarkdown).toContain("No story candidate has been approved yet.");
  });

  it("writes per-clip edit plans only for approved candidate ids", () => {
    const candidateId = buildHanif().clipSlate.clips[0]!.candidateId;
    const result = buildContentPackage({
      timeline: contentPackageTimeline,
      sourcePath: "source/source.mov",
      title: "Test Tripod Video",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile: HANIF_CONTENT_PROFILE,
      targetDurationMs: 65_000,
      minDurationMs: 30_000,
      maxDurationMs: 90_000,
      maxCandidates: 4,
      approvedCandidateIds: [candidateId],
      leadPaddingMs: 800,
      tailPaddingMs: 1200,
    });

    expect(result.selectedCandidate?.id).toBe(candidateId);
    expect(result.selectedCandidate?.heuristicTheme).toBe("public-building-proof");
    expect(result.editPlan?.segments).toHaveLength(1);
    expect(result.editPlan?.segments[0]?.sourceStartMs).toBe(0);
    expect(result.editPlan?.segments[0]?.sourceEndMs).toBe(86_200);
    expect(result.editPlan?.segments[0]?.sourceWindowIds).toContain("window-001");
    expect(result.approvedEditPlans).toHaveLength(1);
    expect(result.approvedEditPlans[0]?.editPlanPath).toBe(`plans/clips/${candidateId}/edit-plan.json`);
    expect(result.clipSlate.approvalStatus).toBe("approved");
    expect(result.clipSlate.clips.find((clip) => clip.candidateId === candidateId)?.approvalStatus).toBe("approved");
  });

  it("keeps candidate ids stable when the retained count changes", () => {
    const one = buildHanif(1);
    const many = buildHanif(4);

    expect(one.storyCandidates.candidates[0]?.id).toBe(many.storyCandidates.candidates[0]?.id);
    expect(one.storyCandidates.candidates[0]?.id).toMatch(/^story-\d{9}-\d{9}$/);
  });

  it("does not let lead padding pull prior sentence words into the selected edit", () => {
    const timeline: Timeline = {
      ...contentPackageTimeline,
      transcriptSegments: [
        {
          id: "seg-before",
          startMs: 0,
          endMs: 1_000,
          text: "Whatever it is that you're doing.",
          words: [
            { id: "before-1", startMs: 100, endMs: 400, text: "Whatever", probability: 0.99 },
            { id: "before-2", startMs: 400, endMs: 600, text: "it", probability: 0.99 },
            { id: "before-3", startMs: 600, endMs: 1_000, text: "doing.", probability: 0.99 },
          ],
        },
        {
          id: "seg-clean",
          startMs: 1_200,
          endMs: 42_000,
          text: "So in sales, you need to have a very specific paid media agency profile. The point is to understand the client and create a consulting offer that helps agencies trust their reporting and improve execution.",
          words: [{ id: "clean-1", startMs: 1_200, endMs: 1_400, text: "So", probability: 0.99 }],
        },
      ],
    };

    const result = buildContentPackage({
      timeline,
      sourcePath: "source/source.mov",
      title: "Clean Start Test",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile: HANIF_CONTENT_PROFILE,
      targetDurationMs: 42_000,
      minDurationMs: 30_000,
      maxDurationMs: 60_000,
      maxCandidates: 2,
      selectedId: "story-000001200-000042000",
      leadPaddingMs: 800,
      tailPaddingMs: 0,
    });

    expect(result.editPlan?.segments[0]?.sourceStartMs).toBe(1_000);
    expect(result.editPlan?.segments[0]?.sourceStartMs).toBeGreaterThan(400);
  });

  it("trims personal-process tail after the listener-facing lesson lands", () => {
    const timeline: Timeline = {
      ...contentPackageTimeline,
      media: { ...contentPackageTimeline.media!, durationMs: 60_000 },
      transcriptSegments: [
        {
          id: "seg-lesson",
          startMs: 0,
          endMs: 42_000,
          text: "So in sales, your message needs to be very specific. Who is this for? What does it do? Better to do one thing well. So specificity is the name of the game.",
          words: [
            { id: "lesson-1", startMs: 0, endMs: 400, text: "So", probability: 0.99 },
            { id: "lesson-2", startMs: 400, endMs: 900, text: "in", probability: 0.99 },
            { id: "lesson-3", startMs: 900, endMs: 1_400, text: "sales,", probability: 0.99 },
            { id: "lesson-4", startMs: 30_000, endMs: 30_400, text: "So", probability: 0.99 },
            { id: "lesson-5", startMs: 30_400, endMs: 31_200, text: "specificity", probability: 0.99 },
            { id: "lesson-6", startMs: 31_200, endMs: 31_500, text: "is", probability: 0.99 },
            { id: "lesson-7", startMs: 31_500, endMs: 31_800, text: "the", probability: 0.99 },
            { id: "lesson-8", startMs: 31_800, endMs: 32_100, text: "name", probability: 0.99 },
            { id: "lesson-9", startMs: 32_100, endMs: 32_300, text: "of", probability: 0.99 },
            { id: "lesson-10", startMs: 32_300, endMs: 32_500, text: "the", probability: 0.99 },
            { id: "lesson-11", startMs: 32_500, endMs: 33_000, text: "game.", probability: 0.99 },
          ],
        },
        {
          id: "seg-tail",
          startMs: 42_000,
          endMs: 52_000,
          text: "So I got specific on the ICP and I did that today. I was looking at creating a kind of curriculum for my consulting.",
          words: [
            { id: "tail-1", startMs: 42_000, endMs: 42_200, text: "So", probability: 0.99 },
            { id: "tail-2", startMs: 42_200, endMs: 42_400, text: "I", probability: 0.99 },
            { id: "tail-3", startMs: 42_400, endMs: 42_700, text: "got", probability: 0.99 },
            { id: "tail-4", startMs: 42_700, endMs: 43_200, text: "specific", probability: 0.99 },
          ],
        },
      ],
    };

    const result = buildContentPackage({
      timeline,
      sourcePath: "source/source.mov",
      title: "Listener Lesson Test",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile: HANIF_CONTENT_PROFILE,
      targetDurationMs: 52_000,
      minDurationMs: 30_000,
      maxDurationMs: 60_000,
      maxCandidates: 2,
      selectedId: "story-000000000-000052000",
      leadPaddingMs: 0,
      tailPaddingMs: 1200,
    });

    expect(result.editPlan?.segments[0]?.sourceEndMs).toBe(33_080);
    expect(result.editPlan?.segments[0]?.evidence).toContain('trimmed personal-process tail before "so i got"');
  });

  it("does not generate agent-owned title or point fields", () => {
    const timeline: Timeline = {
      ...contentPackageTimeline,
      media: { ...contentPackageTimeline.media!, durationMs: 90_000 },
      transcriptSegments: [
        {
          id: "seg-people",
          startMs: 0,
          endMs: 42_000,
          text: "You need people, if nothing else, you need people to try it so that you can get feedback and improve it. Sharing the work gives you useful signal from the world.",
          words: [{ id: "people-1", startMs: 0, endMs: 300, text: "You", probability: 0.99 }],
        },
        {
          id: "seg-consulting",
          startMs: 42_000,
          endMs: 84_000,
          text: "It's hard to put into words, like I said. So I'm advancing on consulting as a technical consultant. I got specific on the ICP around operations, workflow automation, and custom software for paid media agencies.",
          words: [{ id: "consulting-1", startMs: 42_000, endMs: 42_300, text: "It's", probability: 0.99 }],
        },
      ],
    };

    const result = buildContentPackage({
      timeline,
      sourcePath: "source/source.mov",
      title: "Title Quality Test",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile: HANIF_CONTENT_PROFILE,
      targetDurationMs: 42_000,
      minDurationMs: 30_000,
      maxDurationMs: 50_000,
      maxCandidates: 4,
    });

    const candidate = result.storyCandidates.candidates[0]!;
    expect(candidate).not.toHaveProperty("title");
    expect(candidate).not.toHaveProperty("hook");
    expect(candidate).not.toHaveProperty("point");
    expect(candidate).not.toHaveProperty("socialPostDraft");
    expect(candidate.transcriptExcerpt).toContain("You need people");
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
    expect(StoryCandidatesSchema.parse(result.storyCandidates).selectedCandidateId).toBeNull();
    expect(ClipSlateSchema.parse(result.clipSlate).approvalStatus).toBe("needs_approval");
    expect(() => StoryCandidatesSchema.parse({ version: 1, candidates: [{ id: "missing-fields" }] })).toThrow();
  });
});
