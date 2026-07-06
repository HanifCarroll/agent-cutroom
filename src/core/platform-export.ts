import { dirname, resolve } from "node:path";
import { CUTROOM_VERSION, type MediaInfo, type Platform, type PlatformExportPlan, type PlatformStylePack } from "./schema.js";
import { ensureDir } from "./files.js";
import { ffprobeMedia } from "./ffmpeg.js";
import { runCommand } from "./process.js";
import { getPlatformStylePack } from "./style-packs.js";

export interface PlatformExportOptions {
  projectDir: string;
  platform: Platform;
  sourcePath: string;
  outputPath?: string;
}

export function defaultPlatformExportPath(platform: Platform): string {
  return `renders/platform-${platform}.mp4`;
}

export function platformRenderMatches(media: MediaInfo | null, stylePack: PlatformStylePack): boolean {
  if (!media) return false;
  if (media.width !== stylePack.width || media.height !== stylePack.height) return false;
  if (typeof media.fps !== "number") return false;
  if (Math.abs(media.fps - stylePack.fps) > 1) return false;
  if (media.videoCodec !== stylePack.videoCodec) return false;
  if (media.hasAudio && media.audioCodec !== stylePack.audioCodec) return false;
  return true;
}

export function buildPlatformExportFilter(stylePack: PlatformStylePack): string {
  return [
    `scale=${stylePack.width}:${stylePack.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${stylePack.width}:${stylePack.height}`,
    `fps=${stylePack.fps}`,
    "format=yuv420p",
  ].join(",");
}

export async function exportPlatformRender(options: PlatformExportOptions): Promise<PlatformExportPlan> {
  const stylePack = getPlatformStylePack(options.platform);
  const outputPath = options.outputPath ?? defaultPlatformExportPath(options.platform);
  const sourceMedia = await ffprobeMedia(options.projectDir, options.sourcePath).catch(() => null);

  const absoluteOutputPath = resolve(options.projectDir, outputPath);
  const absoluteSourcePath = resolve(options.projectDir, options.sourcePath);
  if (absoluteSourcePath === absoluteOutputPath) {
    throw new Error("Platform export output path must differ from the source render path.");
  }
  await ensureDir(dirname(absoluteOutputPath));
  const filterGraph = buildPlatformExportFilter(stylePack);
  await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    absoluteSourcePath,
    "-vf",
    filterGraph,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-b:v",
    stylePack.videoBitrate,
    "-maxrate",
    stylePack.videoBitrate,
    "-bufsize",
    stylePack.videoBitrate,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    stylePack.audioBitrate,
    "-movflags",
    "+faststart",
    absoluteOutputPath,
  ]);

  const outputMedia = await ffprobeMedia(options.projectDir, outputPath).catch(() => null);
  const warnings: string[] = [];
  if (!platformRenderMatches(outputMedia, stylePack)) {
    warnings.push("Platform export did not match the selected style pack after rendering.");
  }

  return {
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    platform: options.platform,
    sourcePath: options.sourcePath,
    outputPath,
    stylePack,
    filterGraph,
    skipped: false,
    reason: null,
    sourceMedia,
    outputMedia,
    warnings,
  };
}
