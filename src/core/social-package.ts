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
  type Timeline,
} from "./schema.js";
import { getPlatformStylePack } from "./style-packs.js";
import { formatTimestamp } from "./time.js";
import type { HanifStoryCandidate, HanifStoryCandidates } from "./hanif-content-package.js";

export interface CreateSocialPackageOptions {
  projectDir: string;
  timeline: Timeline;
  platform: Platform;
  renderPath: string;
  candidateId?: string | null;
  candidates?: HighlightCandidates | null;
  storyCandidates?: HanifStoryCandidates | null;
  title?: string | null;
}

function selectedHighlightCandidate(candidates: HighlightCandidates | null, candidateId?: string | null) {
  if (!candidates) return null;
  return candidateId
    ? candidates.candidates.find((item) => item.id === candidateId) ?? null
    : candidates.candidates[0] ?? null;
}

function selectedStoryCandidate(
  storyCandidates: HanifStoryCandidates | null,
  candidateId?: string | null,
): HanifStoryCandidate | null {
  if (!storyCandidates) return null;
  return candidateId
    ? storyCandidates.candidates.find((item) => item.id === candidateId) ?? null
    : storyCandidates.candidates[0] ?? null;
}

function firstTranscriptText(
  timeline: Timeline,
  candidates: HighlightCandidates | null,
  storyCandidates: HanifStoryCandidates | null,
  candidateId?: string | null,
): string {
  const candidate = candidateId
    ? candidates?.candidates.find((item) => item.id === candidateId)
    : candidates?.candidates[0];
  if (candidate?.transcriptText) return candidate.transcriptText;
  const storyCandidate = selectedStoryCandidate(storyCandidates, candidateId);
  if (storyCandidate?.transcriptText) return storyCandidate.transcriptText;
  return timeline.transcriptSegments
    .slice(0, 2)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromText(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 9);
  if (words.length === 0) return "Untitled Clip";
  return words.join(" ").replace(/[.!?,:;]+$/, "");
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

function storyPostDraft(candidate: HanifStoryCandidate): string {
  switch (candidate.theme) {
    case "consulting-focus":
      return [
        "Specificity keeps showing up everywhere: sales, marketing, product, and consulting.",
        "",
        "The broad version of an offer can sound flexible, but the useful version says who it is for, what it changes, and why it matters.",
        "",
        "This is the clip where I was narrowing my consulting focus around paid-media agency operations.",
      ].join("\n");
    case "raw-thinking-to-content":
      return [
        "The useful part of recording raw thoughts is not the recording itself.",
        "",
        "It is having a process that can turn a long, messy take into clips, writing, vault notes, and next actions.",
      ].join("\n");
    case "public-building-proof":
      return [
        "Building quietly has a cost.",
        "",
        "At some point the work needs to become visible so people can react to it, try it, and tell you what is actually useful.",
      ].join("\n");
    case "codex-operating-system":
      return [
        "The agent is most useful when it has a real operating surface.",
        "",
        "For me, that means source notes, decisions, tasks, and review artifacts that all point back to evidence.",
      ].join("\n");
    case "effectiveness-and-task-graph":
      return [
        "Efficiency is getting through tasks quickly.",
        "",
        "Effectiveness is choosing the right task in the first place, then making the next action obvious enough to do.",
      ].join("\n");
    default:
      return candidate.point;
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
  storyCandidate: HanifStoryCandidate | null;
}): string[] {
  if (storyCandidate) {
    return [
      `# ${storyCandidate.title}`,
      "",
      "## Clip Angle",
      "",
      storyCandidate.point,
      "",
      "## Post Draft",
      "",
      storyPostDraft(storyCandidate),
      "",
      "## Source",
      "",
      `- Candidate: ${storyCandidate.id}`,
      `- Theme: ${storyCandidate.themeLabel}`,
      `- Timestamp: ${sourceTimestamps.join(", ") || "not selected"}`,
      "",
      "## Transcript Excerpt",
      "",
      `> ${shortText(sourceText, 90)}`,
      "",
      hashtagsForPlatform(platform).join(" "),
      "",
    ];
  }
  return [
    `# ${title}`,
    "",
    sourceText || "Post copy placeholder. Review the source transcript before publishing.",
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
  const highlightCandidate = selectedHighlightCandidate(options.candidates ?? null, options.candidateId);
  const storyCandidate = selectedStoryCandidate(options.storyCandidates ?? null, options.candidateId);
  const sourceText = firstTranscriptText(
    options.timeline,
    options.candidates ?? null,
    options.storyCandidates ?? null,
    options.candidateId,
  );
  const primaryTitle = options.title?.trim() || storyCandidate?.title || titleFromText(sourceText);
  const titleOptions = [
    primaryTitle,
    storyCandidate?.point ? titleFromText(storyCandidate.point) : null,
    sourceText ? titleFromText(sourceText.split(/[.!?]/)[0] ?? sourceText) : primaryTitle,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  const coverFramePath = await writeCoverFrame(options.projectDir, options.renderPath);
  const sourceCandidate = highlightCandidate ?? storyCandidate;
  const sourceTimestamps = sourceCandidate
    ? [`${formatTimestamp(sourceCandidate.sourceStartMs)}-${formatTimestamp(sourceCandidate.sourceEndMs)}`]
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
    sourceCandidateId: sourceCandidate?.id ?? null,
    sourceTimestamps,
    warnings,
  });
}
