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

export interface CreateSocialPackageOptions {
  projectDir: string;
  timeline: Timeline;
  platform: Platform;
  renderPath: string;
  candidateId?: string | null;
  candidates?: HighlightCandidates | null;
  title?: string | null;
}

function firstTranscriptText(timeline: Timeline, candidates: HighlightCandidates | null, candidateId?: string | null): string {
  const candidate = candidateId
    ? candidates?.candidates.find((item) => item.id === candidateId)
    : candidates?.candidates[0];
  if (candidate?.transcriptText) return candidate.transcriptText;
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
  const sourceText = firstTranscriptText(options.timeline, options.candidates ?? null, options.candidateId);
  const primaryTitle = options.title?.trim() || titleFromText(sourceText);
  const titleOptions = [
    primaryTitle,
    sourceText ? titleFromText(sourceText.split(/[.!?]/)[0] ?? sourceText) : primaryTitle,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const candidate = options.candidateId
    ? options.candidates?.candidates.find((item) => item.id === options.candidateId)
    : options.candidates?.candidates[0];
  const coverFramePath = await writeCoverFrame(options.projectDir, options.renderPath);
  const sourceTimestamps = candidate
    ? [`${formatTimestamp(candidate.sourceStartMs)}-${formatTimestamp(candidate.sourceEndMs)}`]
    : [];
  const postCopyPath = "release/post-copy.md";
  const lines = [
    `# ${primaryTitle}`,
    "",
    sourceText || "Post copy placeholder. Review the source transcript before publishing.",
    "",
    `Source: ${sourceTimestamps.join(", ") || "not selected"}`,
    "",
    hashtagsForPlatform(options.platform).join(" "),
    "",
  ];
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
    sourceCandidateId: candidate?.id ?? null,
    sourceTimestamps,
    warnings,
  });
}
