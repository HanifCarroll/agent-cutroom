import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HANIF_CONTENT_PROFILE,
  TALKING_HEAD_STORY_RECIPE,
  buildContentPackage,
} from "../src/core/content-package/index.js";
import { createSocialPackage } from "../src/core/social-package.js";
import type { HighlightCandidates, Timeline } from "../src/core/schema.js";

vi.mock("../src/core/ffmpeg.js", () => ({
  ffprobeMedia: vi.fn(async () => ({
    path: "renders/captioned.mp4",
    durationMs: 56_200,
    width: 1080,
    height: 1350,
    fps: 30,
    hasAudio: true,
    hasVideo: true,
    sizeBytes: 100,
    formatName: "mov,mp4",
  })),
}));

vi.mock("../src/core/process.js", () => ({
  runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
}));

const timeline: Timeline = {
  version: 1,
  media: null,
  transcriptSegments: [
    {
      id: "seg-001",
      startMs: 0,
      endMs: 42_000,
      text: "Building quietly has a cost. The work needs to become visible so people can react to it.",
      words: [{ id: "word-001", startMs: 0, endMs: 200, text: "Building", probability: 0.99 }],
    },
  ],
  transcriptUntimedText: null,
  transcriptProvenance: null,
  warnings: [],
  silences: [],
  frames: [{ id: "frame-001", atMs: 10_000, timestamp: "0:10.000", path: "frames/frame.jpg", reason: "sampled" }],
  windows: [
    {
      id: "window-001",
      startMs: 0,
      endMs: 42_000,
      timestamp: "0:00.000-0:42.000",
      transcriptText: "Building quietly has a cost.",
      frameIds: ["frame-001"],
      silenceIds: [],
    },
  ],
  observations: [],
};

describe("createSocialPackage", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agent-cutroom-social-"));
  });

  it("uses story candidate provenance end-to-end when highlight candidates also exist", async () => {
    const contentPackage = buildContentPackage({
      timeline,
      sourcePath: "source/source.mov",
      title: "Story Source",
      recipe: TALKING_HEAD_STORY_RECIPE,
      profile: HANIF_CONTENT_PROFILE,
      targetDurationMs: 42_000,
      minDurationMs: 30_000,
      maxDurationMs: 90_000,
      maxCandidates: 2,
    });
    const storyCandidate = contentPackage.selectedCandidate;
    if (!storyCandidate) throw new Error("Expected a selected story candidate.");
    const staleHighlightCandidates: HighlightCandidates = {
      version: 1,
      createdAt: new Date().toISOString(),
      objective: "stale highlight",
      targetDurationMs: 30_000,
      candidates: [
        {
          id: "moment-001",
          sourceStartMs: 90_000,
          sourceEndMs: 120_000,
          durationMs: 30_000,
          transcriptText: "This is stale highlight transcript text.",
          reason: "stale",
          evidence: [],
          warnings: [],
          score: 1,
          sourceWindowIds: [],
          sourceFrameIds: [],
          sourceObservationIds: [],
        },
      ],
      warnings: [],
    };

    const socialPackage = await createSocialPackage({
      projectDir,
      timeline,
      platform: "linkedin",
      renderPath: "renders/captioned.mp4",
      candidateId: storyCandidate.id,
      candidates: staleHighlightCandidates,
      storyCandidates: contentPackage.storyCandidates,
    });

    const postCopy = await readFile(join(projectDir, "release/post-copy.md"), "utf8");

    expect(socialPackage.sourceCandidateId).toBe(storyCandidate.id);
    expect(socialPackage.sourceTimestamps).toEqual([storyCandidate.timestamp]);
    expect(postCopy).toContain(`- Candidate: ${storyCandidate.id}`);
    expect(postCopy).toContain(storyCandidate.transcriptText.slice(0, 32));
    expect(postCopy).not.toContain("stale highlight transcript text");
    expect(postCopy).not.toContain("story-001");
    expect(socialPackage.titleOptions).toContain(storyCandidate.title);
  });
});
