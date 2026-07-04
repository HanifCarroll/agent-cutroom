import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ffprobeMedia } from "./ffmpeg.js";
import { runCommand } from "./process.js";
import {
  CUTROOM_VERSION,
  VerificationReportSchema,
  type Frame,
  type VerificationCheck,
  type VerificationReport,
} from "./schema.js";
import { formatTimestamp, msToSeconds } from "./time.js";

export interface VerifyOptions {
  projectDir: string;
  targetPath: string;
  minDurationMs?: number;
  previewCount?: number;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function decodeMedia(projectDir: string, targetPath: string): Promise<VerificationCheck> {
  try {
    await runCommand(
      "ffmpeg",
      ["-hide_banner", "-v", "error", "-nostdin", "-i", targetPath, "-f", "null", "-"],
      { cwd: projectDir },
    );
    return { id: "decode", status: "pass", message: "ffmpeg decoded the target without errors." };
  } catch (error) {
    return {
      id: "decode",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function extractPreviewFrames({
  projectDir,
  targetPath,
  durationMs,
  count,
}: {
  projectDir: string;
  targetPath: string;
  durationMs: number;
  count: number;
}): Promise<Frame[]> {
  if (durationMs <= 0 || count <= 0) return [];
  const outputDir = "renders/verify-frames";
  await mkdir(resolve(projectDir, outputDir), { recursive: true });
  const points = Array.from({ length: count }, (_, index) =>
    Math.round((durationMs * (index + 1)) / (count + 1)),
  );
  const frames: Frame[] = [];
  for (const [index, atMs] of points.entries()) {
    const output = `${outputDir}/frame-${String(index + 1).padStart(3, "0")}.jpg`;
    await runCommand(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        String(msToSeconds(atMs)),
        "-i",
        targetPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(720,iw)':-2,format=yuvj420p",
        "-q:v",
        "3",
        output,
      ],
      { cwd: projectDir },
    );
    frames.push({
      id: `verify-frame-${String(index + 1).padStart(3, "0")}`,
      atMs,
      timestamp: formatTimestamp(atMs),
      path: output,
      reason: "verification preview frame",
    });
  }
  return frames;
}

export async function verifyRender(options: VerifyOptions): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [];
  const absoluteTarget = resolve(options.projectDir, options.targetPath);
  if (!(await pathExists(absoluteTarget))) {
    checks.push({
      id: "exists",
      status: "fail",
      message: `Target does not exist: ${options.targetPath}`,
      path: options.targetPath,
    });
    return VerificationReportSchema.parse({
      version: CUTROOM_VERSION,
      createdAt: new Date().toISOString(),
      targetPath: options.targetPath,
      ok: false,
      media: null,
      checks,
      previewFrames: [],
    });
  }

  checks.push({
    id: "exists",
    status: "pass",
    message: `Target exists: ${options.targetPath}`,
    path: options.targetPath,
  });
  const media = await ffprobeMedia(options.projectDir, options.targetPath);
  checks.push({
    id: "probe",
    status: media.hasVideo ? "pass" : "fail",
    message: `duration=${media.durationMs}ms width=${media.width ?? "unknown"} height=${media.height ?? "unknown"} audio=${media.hasAudio}`,
  });
  if (options.minDurationMs && media.durationMs < options.minDurationMs) {
    checks.push({
      id: "duration",
      status: "fail",
      message: `Duration ${media.durationMs}ms is shorter than required ${options.minDurationMs}ms.`,
    });
  } else {
    checks.push({
      id: "duration",
      status: "pass",
      message: `Duration ${media.durationMs}ms is acceptable.`,
    });
  }
  checks.push(await decodeMedia(options.projectDir, options.targetPath));
  const previewFrames = await extractPreviewFrames({
    projectDir: options.projectDir,
    targetPath: options.targetPath,
    durationMs: media.durationMs,
    count: options.previewCount ?? 3,
  }).catch((error): Frame[] => {
    checks.push({
      id: "preview-frames",
      status: "warn",
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  });
  if (previewFrames.length > 0) {
    checks.push({
      id: "preview-frames",
      status: "pass",
      message: `Extracted ${previewFrames.length} preview frames.`,
      path: dirname(previewFrames[0].path),
    });
  }

  const ok = !checks.some((check) => check.status === "fail");
  return VerificationReportSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    targetPath: options.targetPath,
    ok,
    media,
    checks,
    previewFrames,
  });
}
