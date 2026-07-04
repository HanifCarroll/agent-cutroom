import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { runCommand } from "./process.js";
import { formatTimestamp, msToSeconds, secondsToMs } from "./time.js";
import type { EditPlan, Frame, MediaInfo, SilenceRange } from "./schema.js";

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeFormat {
  duration?: string;
  format_name?: string;
}

interface FfprobeJson {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

function parseRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [nRaw, dRaw] = rate.split("/");
  const n = Number(nRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  const value = n / d;
  return value > 0 ? value : null;
}

export async function ffprobeMedia(
  projectDir: string,
  sourceRelativePath: string,
  originalPath?: string,
): Promise<MediaInfo> {
  const sourcePath = resolve(projectDir, sourceRelativePath);
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    sourcePath,
  ]);
  const parsed = JSON.parse(stdout) as FfprobeJson;
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const stats = await stat(sourcePath);
  return {
    path: sourceRelativePath,
    originalPath,
    durationMs: secondsToMs(Number(parsed.format?.duration ?? 0)),
    width: Number.isInteger(video?.width) ? video?.width ?? null : null,
    height: Number.isInteger(video?.height) ? video?.height ?? null : null,
    fps: parseRate(video?.avg_frame_rate) ?? parseRate(video?.r_frame_rate),
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    sizeBytes: stats.size,
    formatName: parsed.format?.format_name ?? null,
  };
}

export function parseSilencedetect(stderr: string): SilenceRange[] {
  const starts: number[] = [];
  const ranges: SilenceRange[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([0-9.]+)/);
    if (start) {
      starts.push(Number(start[1]));
      continue;
    }
    const end = line.match(
      /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/,
    );
    if (end) {
      const startSeconds = starts.shift();
      if (startSeconds === undefined) continue;
      const startMs = secondsToMs(startSeconds);
      const endMs = secondsToMs(Number(end[1]));
      ranges.push({
        id: `silence-${String(ranges.length + 1).padStart(3, "0")}`,
        startMs,
        endMs,
        durationMs: Math.max(0, endMs - startMs),
      });
    }
  }
  return ranges;
}

export async function detectSilences({
  projectDir,
  sourceRelativePath,
  noiseDb,
  minDurationSeconds,
}: {
  projectDir: string;
  sourceRelativePath: string;
  noiseDb: string;
  minDurationSeconds: number;
}): Promise<SilenceRange[]> {
  const sourcePath = resolve(projectDir, sourceRelativePath);
  const { stderr } = await runCommand("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-i",
    sourcePath,
    "-af",
    `silencedetect=noise=${noiseDb}:d=${minDurationSeconds}`,
    "-f",
    "null",
    "-",
  ]);
  return parseSilencedetect(stderr);
}

function frameFileName(atMs: number): string {
  return `frame-${String(Math.round(atMs)).padStart(9, "0")}ms.jpg`;
}

export async function extractFrames({
  projectDir,
  sourceRelativePath,
  timestampsMs,
}: {
  projectDir: string;
  sourceRelativePath: string;
  timestampsMs: number[];
}): Promise<Frame[]> {
  const sourcePath = resolve(projectDir, sourceRelativePath);
  const frameDir = resolve(projectDir, "frames");
  const unique = [...new Set(timestampsMs.map((ms) => Math.max(0, Math.round(ms))))].sort(
    (a, b) => a - b,
  );
  const frames: Frame[] = [];
  for (const atMs of unique) {
    const outputRelative = join("frames", frameFileName(atMs));
    const outputPath = resolve(projectDir, outputRelative);
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-ss",
      String(msToSeconds(atMs)),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(1280,iw)':-2,format=yuvj420p",
      "-q:v",
      "3",
      outputPath,
    ]);
    frames.push({
      id: `frame-${String(frames.length + 1).padStart(3, "0")}`,
      atMs,
      timestamp: formatTimestamp(atMs),
      path: relative(projectDir, outputPath),
      reason: "sampled for agent review",
    });
  }
  return frames;
}

export async function createContactSheet({
  projectDir,
  outputName = "frames.jpg",
}: {
  projectDir: string;
  outputName?: string;
}): Promise<string | null> {
  const outputRelative = join("contact-sheets", outputName);
  const outputPath = resolve(projectDir, outputRelative);
  const frameDir = resolve(projectDir, "frames");
  const frameCount = (
    await readdir(frameDir).catch((): string[] => [])
  ).filter((name) => /^frame-\d+ms\.jpg$/.test(name)).length;
  if (frameCount === 0) return null;
  const columns = Math.min(3, frameCount);
  const rows = Math.ceil(frameCount / columns);
  const glob = join(frameDir, "frame-*.jpg");
  try {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-pattern_type",
      "glob",
      "-i",
      glob,
      "-vf",
      `scale=320:-1,tile=${columns}x${rows}:padding=12:margin=12:color=white`,
      "-frames:v",
      "1",
      outputPath,
    ]);
    return outputRelative;
  } catch {
    return null;
  }
}

export async function renderEditPlan({
  projectDir,
  plan,
  outputRelativePath,
}: {
  projectDir: string;
  plan: EditPlan;
  outputRelativePath: string;
}): Promise<string> {
  if (plan.segments.length === 0) {
    throw new Error("Edit plan has no segments to render.");
  }

  const sourcePath = resolve(projectDir, plan.sourcePath);
  const outputPath = resolve(projectDir, outputRelativePath);
  const dir = await mkdtemp(join(tmpdir(), "agent-cutroom-render-"));
  try {
    const listPath = join(dir, "segments.txt");
    const segmentPaths: string[] = [];
    for (const [index, segment] of plan.segments.entries()) {
      const segmentPath = join(dir, `segment-${String(index).padStart(4, "0")}.mp4`);
      segmentPaths.push(segmentPath);
      await runCommand("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        String(msToSeconds(segment.sourceStartMs)),
        "-to",
        String(msToSeconds(segment.sourceEndMs)),
        "-i",
        sourcePath,
        "-map",
        "0:v:0?",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        segmentPath,
      ]);
    }
    await writeFile(
      listPath,
      segmentPaths
        .map((path) => `file '${path.replaceAll("'", "'\\''")}'`)
        .join("\n"),
    );
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return outputRelativePath;
}
