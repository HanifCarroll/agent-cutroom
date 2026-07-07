import { copyFile, symlink, stat } from "node:fs/promises";
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
export const HIGHLIGHT_CANDIDATES_FILE = "analysis/highlight-candidates.json";
export const CONTENT_INVENTORY_FILE = "review/content-inventory.md";
export const STORY_CANDIDATES_FILE = "analysis/story-candidates.json";
export const STORY_SELECTION_FILE = "analysis/story-selection.md";
export const CAPTION_PLAN_FILE = "plans/caption-plan.json";
export const SOCIAL_PACKAGE_FILE = "plans/social-package.json";
export const VERIFY_REPORT_FILE = "renders/verify-report.json";
export const OTIO_EXPORT_FILE = "exports/edit.otio";
export const MUSIC_GENERATION_FILE = "plans/music-generation.json";
export const MUSIC_MIX_FILE = "plans/music-mix.json";

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

export function highlightCandidatesPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), HIGHLIGHT_CANDIDATES_FILE);
}

export function contentInventoryPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), CONTENT_INVENTORY_FILE);
}

export function storyCandidatesPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), STORY_CANDIDATES_FILE);
}

export function storySelectionPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), STORY_SELECTION_FILE);
}

export function captionPlanPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), CAPTION_PLAN_FILE);
}

export function socialPackagePath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), SOCIAL_PACKAGE_FILE);
}

export function verifyReportPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), VERIFY_REPORT_FILE);
}

export function otioExportPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), OTIO_EXPORT_FILE);
}

export function musicGenerationPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), MUSIC_GENERATION_FILE);
}

export function musicMixPath(projectDir: string): string {
  return join(resolveProjectDir(projectDir), MUSIC_MIX_FILE);
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
  linkSource,
}: {
  videoPath: string;
  transcriptPath?: string;
  outDir: string;
  title?: string;
  linkSource?: boolean;
}): Promise<CutroomManifest> {
  const projectDir = resolveProjectDir(outDir);
  const sourceDir = join(projectDir, "source");
  const transcriptDir = join(projectDir, "transcript");
  await ensureDir(sourceDir);
  await ensureDir(join(projectDir, "frames"));
  await ensureDir(join(projectDir, "contact-sheets"));
  await ensureDir(join(projectDir, "review"));
  await ensureDir(join(projectDir, "analysis"));
  await ensureDir(join(projectDir, "assets"));
  await ensureDir(join(projectDir, "assets/music"));
  await ensureDir(join(projectDir, "plans"));
  await ensureDir(join(projectDir, "captions"));
  await ensureDir(join(projectDir, "renders"));
  await ensureDir(join(projectDir, "exports"));
  await ensureDir(join(projectDir, "release"));

  const videoAbs = resolve(videoPath);
  const extension = extname(videoAbs) || ".mp4";
  const sourcePath = join(sourceDir, `source${extension}`);
  if (linkSource) {
    await symlink(videoAbs, sourcePath);
  } else {
    await copyFile(videoAbs, sourcePath);
  }
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
