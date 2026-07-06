import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ffprobeMedia } from "./ffmpeg.js";
import { runCommand } from "./process.js";
import {
  CUTROOM_VERSION,
  SocialPackageSchema,
  type HighlightCandidates,
  type Platform,
  type SocialPackage,
  type HighlightCandidate,
  type Timeline,
} from "./schema.js";
import { getPlatformStylePack } from "./style-packs.js";
import { formatTimestamp } from "./time.js";
import type { StoryCandidate, StoryCandidates } from "./content-package/index.js";

export interface CreateSocialPackageOptions {
  projectDir: string;
  timeline: Timeline;
  platform: Platform;
  renderPath: string;
  candidateId?: string | null;
  candidates?: HighlightCandidates | null;
  storyCandidates?: StoryCandidates | null;
  title?: string | null;
}

function selectedHighlightCandidate(candidates: HighlightCandidates | null, candidateId?: string | null) {
  if (!candidates) return null;
  return candidateId
    ? candidates.candidates.find((item) => item.id === candidateId) ?? null
    : candidates.candidates[0] ?? null;
}

function selectedStoryCandidate(
  storyCandidates: StoryCandidates | null,
  candidateId?: string | null,
): StoryCandidate | null {
  if (!storyCandidates) return null;
  if (candidateId) {
    return storyCandidates.candidates.find((item) => item.id === candidateId) ?? null;
  }
  if (storyCandidates.selectedCandidateId) {
    return storyCandidates.candidates.find((item) => item.id === storyCandidates.selectedCandidateId) ?? null;
  }
  return storyCandidates.candidates[0] ?? null;
}

type SelectedSourceCandidate =
  | { kind: "story"; candidate: StoryCandidate }
  | { kind: "highlight"; candidate: HighlightCandidate }
  | { kind: "none"; candidate: null };

function selectedSourceCandidate(options: {
  candidates: HighlightCandidates | null;
  storyCandidates: StoryCandidates | null;
  candidateId?: string | null;
}): SelectedSourceCandidate {
  const storyCandidate = selectedStoryCandidate(options.storyCandidates, options.candidateId);
  if (storyCandidate) return { kind: "story", candidate: storyCandidate };
  const highlightCandidate = selectedHighlightCandidate(options.candidates, options.candidateId);
  if (highlightCandidate) return { kind: "highlight", candidate: highlightCandidate };
  return { kind: "none", candidate: null };
}

function firstTranscriptText(timeline: Timeline, selected: SelectedSourceCandidate): string {
  if (selected.candidate?.transcriptText) return selected.candidate.transcriptText;
  return timeline.transcriptSegments
    .slice(0, 2)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(text: string, maxWords: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function hashtagsForPlatform(platform: Platform): string[] {
  switch (platform) {
    case "instagram":
      return ["#reels", "#video", "#interview"];
    case "tiktok":
      return ["#tiktok", "#shortvideo", "#interview"];
    case "youtube-shorts":
      return ["#shorts", "#video", "#interview"];
    case "linkedin":
      return ["#video", "#content", "#workflow"];
  }
}

function postCopyLines({
  platform,
  title,
  sourceText,
  sourceTimestamps,
  storyCandidate,
}: {
  platform: Platform;
  title: string;
  sourceText: string;
  sourceTimestamps: string[];
  storyCandidate: StoryCandidate | null;
}): string[] {
  if (storyCandidate) {
    return [
      title ? `# ${title}` : "# Agent-authored post copy required",
      "",
      "## Source Candidate",
      "",
      `- Candidate: ${storyCandidate.id}`,
      `- Timestamp: ${sourceTimestamps.join(", ") || "not selected"}`,
      `- Heuristic theme: ${storyCandidate.heuristicThemeLabel}`,
      "",
      "## Agent Notes",
      "",
      "Write the publishable title, post copy, and caption angle from the source evidence. Do not publish this placeholder.",
      "",
      "## Transcript Excerpt",
      "",
      `> ${shortText(sourceText, 90)}`,
      "",
      "## Platform Tags",
      "",
      hashtagsForPlatform(platform).join(" "),
      "",
      `Platform: ${platform}`,
      "",
    ];
  }
  return [
    title ? `# ${title}` : "# Agent-authored post copy required",
    "",
    "Write the publishable title, post copy, and caption angle from the source evidence. Do not publish this placeholder.",
    "",
    "## Transcript Excerpt",
    "",
    sourceText ? `> ${shortText(sourceText, 90)}` : "> No transcript excerpt available.",
    "",
    `Source: ${sourceTimestamps.join(", ") || "not selected"}`,
    "",
    hashtagsForPlatform(platform).join(" "),
    "",
  ];
}

async function writeCoverFrame(projectDir: string, renderPath: string): Promise<string | null> {
  const output = "release/cover-frame.jpg";
  await mkdir(resolve(projectDir, "release"), { recursive: true });
  try {
    await runCommand(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        "1",
        "-i",
        renderPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(1080,iw)':-2,format=yuvj420p",
        "-q:v",
        "3",
        output,
      ],
      { cwd: projectDir },
    );
    return output;
  } catch {
    return null;
  }
}

export async function createSocialPackage(options: CreateSocialPackageOptions): Promise<SocialPackage> {
  const stylePack = getPlatformStylePack(options.platform);
  const media = await ffprobeMedia(options.projectDir, options.renderPath).catch(() => null);
  const selected = selectedSourceCandidate({
    candidates: options.candidates ?? null,
    storyCandidates: options.storyCandidates ?? null,
    candidateId: options.candidateId,
  });
  const storyCandidate = selected.kind === "story" ? selected.candidate : null;
  const sourceText = firstTranscriptText(options.timeline, selected);
  const primaryTitle = options.title?.trim() || "";
  const titleOptions = primaryTitle ? [primaryTitle] : [];
  const coverFramePath = await writeCoverFrame(options.projectDir, options.renderPath);
  const sourceTimestamps = selected.candidate
    ? [`${formatTimestamp(selected.candidate.sourceStartMs)}-${formatTimestamp(selected.candidate.sourceEndMs)}`]
    : [];
  const postCopyPath = "release/post-copy.md";
  const lines = postCopyLines({
    platform: options.platform,
    title: primaryTitle,
    sourceText,
    sourceTimestamps,
    storyCandidate,
  });
  await writeFile(resolve(options.projectDir, postCopyPath), lines.join("\n"));

  const warnings: string[] = [];
  if (!coverFramePath) warnings.push("Could not extract a cover frame from the render.");
  if (media?.width && media?.height) {
    if (media.width !== stylePack.width || media.height !== stylePack.height) {
      warnings.push(
        `Render dimensions ${media.width}x${media.height} do not match ${options.platform} style pack ${stylePack.width}x${stylePack.height}. Use HyperFrames or an export pass for final platform sizing.`,
      );
    }
  } else {
    warnings.push("Could not confirm render dimensions for the social package.");
  }
  if (typeof media?.fps === "number" && Math.abs(media.fps - stylePack.fps) > 1) {
    warnings.push(
      `Render fps ${media.fps.toFixed(2)} does not match ${options.platform} style pack ${stylePack.fps}fps. Export at the platform frame rate before publishing.`,
    );
  }

  return SocialPackageSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    platform: options.platform,
    renderPath: options.renderPath,
    coverFramePath,
    titleOptions,
    postCopyPath,
    hashtags: hashtagsForPlatform(options.platform),
    stylePack,
    sourceCandidateId: selected.candidate?.id ?? null,
    sourceTimestamps,
    warnings,
  });
}
