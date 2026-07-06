import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ffprobeMedia } from "./ffmpeg.js";
import { runCommand } from "./process.js";
import {
  CUTROOM_VERSION,
  ColorGradePlanSchema,
  type ColorGradePlan,
  type MediaInfo,
} from "./schema.js";
import { msToSeconds } from "./time.js";

export interface SubjectMaskGradeOptions {
  centerXPct: number;
  centerYPct: number;
  radiusXPct: number;
  radiusYPct: number;
  featherPx: number;
  shadowThreshold: number;
  highlightThreshold: number;
  shadowFeatherPx: number;
  finalBlurPx: number;
  brightness: number;
  contrast: number;
  gamma: number;
  gammaWeight: number;
  saturation: number;
}

export const DEFAULT_SUBJECT_MASK_GRADE_OPTIONS: SubjectMaskGradeOptions = {
  centerXPct: 0.5,
  centerYPct: 0.39,
  radiusXPct: 0.324,
  radiusYPct: 0.365,
  featherPx: 120,
  shadowThreshold: 95,
  highlightThreshold: 185,
  shadowFeatherPx: 24,
  finalBlurPx: 8,
  brightness: 0.035,
  contrast: 1.02,
  gamma: 1.35,
  gammaWeight: 0.76,
  saturation: 1.04,
};

interface BuildFilterOptions {
  media: Pick<MediaInfo, "width" | "height" | "fps" | "durationMs">;
  options?: Partial<SubjectMaskGradeOptions>;
}

export interface ApplySubjectMaskGradeOptions {
  projectDir: string;
  targetPath: string;
  outputPath: string;
  options?: Partial<SubjectMaskGradeOptions>;
}

export interface PreviewSubjectMaskGradeOptions {
  projectDir: string;
  targetPath: string;
  outputDir: string;
  count: number;
  options?: Partial<SubjectMaskGradeOptions>;
}

function clampPct(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeOptions(options: Partial<SubjectMaskGradeOptions> | undefined): SubjectMaskGradeOptions {
  const merged = { ...DEFAULT_SUBJECT_MASK_GRADE_OPTIONS, ...(options ?? {}) };
  return {
    centerXPct: clampPct(merged.centerXPct, DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.centerXPct),
    centerYPct: clampPct(merged.centerYPct, DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.centerYPct),
    radiusXPct: Math.max(0.01, merged.radiusXPct),
    radiusYPct: Math.max(0.01, merged.radiusYPct),
    featherPx: Math.max(0, Math.round(merged.featherPx)),
    shadowThreshold: Math.min(254, Math.max(0, Math.round(merged.shadowThreshold))),
    highlightThreshold: Math.min(255, Math.max(1, Math.round(merged.highlightThreshold))),
    shadowFeatherPx: Math.max(0, Math.round(merged.shadowFeatherPx)),
    finalBlurPx: Math.max(0, Math.round(merged.finalBlurPx)),
    brightness: merged.brightness,
    contrast: Math.max(0.01, merged.contrast),
    gamma: Math.max(0.01, merged.gamma),
    gammaWeight: clampPct(merged.gammaWeight, DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.gammaWeight),
    saturation: Math.max(0.01, merged.saturation),
  };
}

function filterNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function requireVideoGeometry(media: Pick<MediaInfo, "width" | "height">): { width: number; height: number } {
  if (!media.width || !media.height) {
    throw new Error("Subject-mask grade requires known video width and height.");
  }
  return { width: media.width, height: media.height };
}

export function buildSubjectMaskFilter({ media, options }: BuildFilterOptions): {
  filterGraph: string;
  normalizedOptions: SubjectMaskGradeOptions;
} {
  const normalizedOptions = normalizeOptions(options);
  const { width, height } = requireVideoGeometry(media);
  const fps = media.fps && Number.isFinite(media.fps) ? media.fps : 30;
  const durationSeconds = Math.max(0.04, msToSeconds(media.durationMs || 40));
  const centerX = Math.round(width * normalizedOptions.centerXPct);
  const centerY = Math.round(height * normalizedOptions.centerYPct);
  const radiusX = Math.max(1, Math.round(width * normalizedOptions.radiusXPct));
  const radiusY = Math.max(1, Math.round(height * normalizedOptions.radiusYPct));
  const shadowThreshold = Math.min(
    normalizedOptions.shadowThreshold,
    normalizedOptions.highlightThreshold - 1,
  );
  const highlightThreshold = Math.max(normalizedOptions.highlightThreshold, shadowThreshold + 1);
  const shadowRange = Math.max(1, highlightThreshold - shadowThreshold);
  const grade = [
    `brightness=${filterNumber(normalizedOptions.brightness)}`,
    `contrast=${filterNumber(normalizedOptions.contrast)}`,
    `gamma=${filterNumber(normalizedOptions.gamma)}`,
    `gamma_weight=${filterNumber(normalizedOptions.gammaWeight)}`,
    `saturation=${filterNumber(normalizedOptions.saturation)}`,
  ].join(":");
  const maskExpression = `if(lte(pow((X-${centerX})/${radiusX},2)+pow((Y-${centerY})/${radiusY},2),1),255,0)`;
  const shadowExpression = `if(lte(lum(X,Y),${shadowThreshold}),255,if(gte(lum(X,Y),${highlightThreshold}),0,(${highlightThreshold}-lum(X,Y))*255/${shadowRange}))`;
  const filterGraph = [
    "[0:v]format=yuv444p,split=3[base][grade][shadowSrc]",
    `[grade]eq=${grade}[lit]`,
    `color=c=black:s=${width}x${height}:r=${filterNumber(fps)}:d=${filterNumber(durationSeconds)},format=gray,geq=lum='${maskExpression}',gblur=sigma=${normalizedOptions.featherPx}[ellipseMask]`,
    `[shadowSrc]format=gray,geq=lum='${shadowExpression}',gblur=sigma=${normalizedOptions.shadowFeatherPx}[shadowMask]`,
    `[ellipseMask][shadowMask]blend=all_mode=multiply,gblur=sigma=${normalizedOptions.finalBlurPx}[mask]`,
    "[base][lit][mask]maskedmerge[outv]",
  ].join(";");
  return { filterGraph, normalizedOptions };
}

function colorGradePlan({
  targetPath,
  outputPath,
  previewFrames,
  filterGraph,
  options,
}: {
  targetPath: string;
  outputPath: string | null;
  previewFrames: string[];
  filterGraph: string;
  options: SubjectMaskGradeOptions;
}): ColorGradePlan {
  return ColorGradePlanSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    method: "subject-mask-shadow-lift",
    targetPath,
    outputPath,
    previewFrames,
    mask: {
      centerXPct: options.centerXPct,
      centerYPct: options.centerYPct,
      radiusXPct: options.radiusXPct,
      radiusYPct: options.radiusYPct,
      featherPx: options.featherPx,
      shadowThreshold: options.shadowThreshold,
      highlightThreshold: options.highlightThreshold,
      shadowFeatherPx: options.shadowFeatherPx,
      finalBlurPx: options.finalBlurPx,
    },
    grade: {
      brightness: options.brightness,
      contrast: options.contrast,
      gamma: options.gamma,
      gammaWeight: options.gammaWeight,
      saturation: options.saturation,
    },
    filterGraph,
    warnings: [],
  });
}

export async function applySubjectMaskGrade(options: ApplySubjectMaskGradeOptions): Promise<ColorGradePlan> {
  const media = await ffprobeMedia(options.projectDir, options.targetPath);
  const { filterGraph, normalizedOptions } = buildSubjectMaskFilter({
    media,
    options: options.options,
  });
  await mkdir(dirname(resolve(options.projectDir, options.outputPath)), { recursive: true });
  await runCommand(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      options.targetPath,
      "-filter_complex",
      filterGraph,
      "-map",
      "[outv]",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      options.outputPath,
    ],
    { cwd: options.projectDir },
  );
  return colorGradePlan({
    targetPath: options.targetPath,
    outputPath: options.outputPath,
    previewFrames: [],
    filterGraph,
    options: normalizedOptions,
  });
}

export async function previewSubjectMaskGrade(options: PreviewSubjectMaskGradeOptions): Promise<ColorGradePlan> {
  const media = await ffprobeMedia(options.projectDir, options.targetPath);
  const { filterGraph, normalizedOptions } = buildSubjectMaskFilter({
    media,
    options: options.options,
  });
  const count = Math.max(1, options.count);
  await mkdir(resolve(options.projectDir, options.outputDir), { recursive: true });
  const previewFrames: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const atMs = Math.round((media.durationMs * (index + 1)) / (count + 1));
    const outputPath = `${options.outputDir}/subject-mask-grade-${String(index + 1).padStart(3, "0")}.jpg`;
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
        options.targetPath,
        "-frames:v",
        "1",
        "-filter_complex",
        filterGraph,
        "-map",
        "[outv]",
        "-q:v",
        "3",
        outputPath,
      ],
      { cwd: options.projectDir },
    );
    previewFrames.push(outputPath);
  }
  return colorGradePlan({
    targetPath: options.targetPath,
    outputPath: null,
    previewFrames,
    filterGraph,
    options: normalizedOptions,
  });
}
