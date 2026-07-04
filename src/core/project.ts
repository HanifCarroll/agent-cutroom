import { copyFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import {
  CUTROOM_VERSION,
  CutroomManifestSchema,
  TimelineSchema,
  emptyTimeline,
  type CutroomManifest,
  type Timeline,
} from "./schema.js";
import { ensureDir, readJson, writeJson } from "./files.js";

export const MANIFEST_FILE = "cutroom.json";
export const TIMELINE_FILE = "timeline.json";
export const EDIT_PLAN_FILE = "edit-plan.json";

export function resolveProjectDir(projectDir: string): string {
  return resolve(projectDir);
}

export function manifestPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), MANIFEST_FILE);
}

export function timelinePath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), TIMELINE_FILE);
}

export function editPlanPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), EDIT_PLAN_FILE);
}

export async function readManifest(projectDir: string): Promise<CutroomManifest> {
  return readJson(manifestPath(projectDir), CutroomManifestSchema);
}

export async function writeManifest(
  projectDir: string,
  manifest: CutroomManifest,
): Promise<void> {
  await writeJson(manifestPath(projectDir), manifest);
}

export async function readTimeline(projectDir: string): Promise<Timeline> {
  return readJson(timelinePath(projectDir), TimelineSchema);
}

export async function writeTimeline(
  projectDir: string,
  timeline: Timeline,
): Promise<void> {
  await writeJson(timelinePath(projectDir), TimelineSchema.parse(timeline));
}

export async function createProject({
  videoPath,
  transcriptPath,
  outDir,
  title,
}: {
  videoPath: string;
  transcriptPath?: string;
  outDir: string;
  title?: string;
}): Promise<CutroomManifest> {
  const projectDir = resolveProjectDir(outDir);
  const sourceDir = join(projectDir, "source");
  const transcriptDir = join(projectDir, "transcript");
  await ensureDir(sourceDir);
  await ensureDir(join(projectDir, "frames"));
  await ensureDir(join(projectDir, "contact-sheets"));
  await ensureDir(join(projectDir, "review"));
  await ensureDir(join(projectDir, "renders"));

  const videoAbs = resolve(videoPath);
  const extension = extname(videoAbs) || ".mp4";
  const sourcePath = join(sourceDir, `source${extension}`);
  await copyFile(videoAbs, sourcePath);
  const sourceStats = await stat(sourcePath);
  if (!sourceStats.isFile()) {
    throw new Error(`Source video was not copied to ${sourcePath}`);
  }

  let storedTranscriptPath: string | null = null;
  if (transcriptPath) {
    await ensureDir(transcriptDir);
    const transcriptAbs = resolve(transcriptPath);
    storedTranscriptPath = join(transcriptDir, basename(transcriptAbs));
    await copyFile(transcriptAbs, storedTranscriptPath);
  }

  const manifest: CutroomManifest = {
    version: CUTROOM_VERSION,
    title: title || basename(videoAbs, extname(videoAbs)),
    createdAt: new Date().toISOString(),
    sourcePath: relative(projectDir, sourcePath),
    transcriptPath: storedTranscriptPath
      ? relative(projectDir, storedTranscriptPath)
      : null,
    timelinePath: TIMELINE_FILE,
    editPlanPath: EDIT_PLAN_FILE,
    renderDir: "renders",
  };

  await writeManifest(projectDir, manifest);
  await writeTimeline(projectDir, emptyTimeline());
  return manifest;
}
