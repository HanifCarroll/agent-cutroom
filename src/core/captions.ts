import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readJson, writeJson } from "./files.js";
import { runCommand } from "./process.js";
import { captionPlanPath, editPlanPath } from "./project.js";
import {
  CUTROOM_VERSION,
  CaptionPlanSchema,
  EditPlanSchema,
  type CaptionEvent,
  type CaptionPlan,
  type CaptionStyle,
  type EditPlan,
  type Timeline,
  type TranscriptWord,
} from "./schema.js";
import { DEFAULT_CAPTION_STYLE } from "./style-packs.js";

interface MappedWord extends TranscriptWord {
  outputStartMs: number;
  outputEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
}

export interface CreateCaptionPlanOptions {
  projectDir: string;
  timeline: Timeline;
  sourceMediaPath: string;
  targetMediaPath: string;
  subtitlePath: string;
  outputPath: string | null;
  format: "ass" | "srt" | "vtt";
  style?: CaptionStyle;
  editPlan?: EditPlan | null;
}

function wordsFromTimeline(timeline: Timeline): TranscriptWord[] {
  return timeline.transcriptSegments.flatMap((segment) => segment.words);
}

function mapWordsThroughEditPlan(words: TranscriptWord[], editPlan: EditPlan | null): MappedWord[] {
  if (!editPlan) {
    return words.map((word) => ({
      ...word,
      outputStartMs: word.startMs,
      outputEndMs: word.endMs,
      sourceStartMs: word.startMs,
      sourceEndMs: word.endMs,
    }));
  }

  const mapped: MappedWord[] = [];
  let outputCursorMs = 0;
  for (const segment of editPlan.segments) {
    for (const word of words) {
      if (word.endMs <= segment.sourceStartMs || word.startMs >= segment.sourceEndMs) continue;
      const sourceStartMs = Math.max(word.startMs, segment.sourceStartMs);
      const sourceEndMs = Math.min(word.endMs, segment.sourceEndMs);
      if (sourceEndMs - sourceStartMs < 40) continue;
      mapped.push({
        ...word,
        outputStartMs: outputCursorMs + (sourceStartMs - segment.sourceStartMs),
        outputEndMs: outputCursorMs + (sourceEndMs - segment.sourceStartMs),
        sourceStartMs,
        sourceEndMs,
      });
    }
    outputCursorMs += segment.sourceEndMs - segment.sourceStartMs;
  }
  return mapped.sort((a, b) => a.outputStartMs - b.outputStartMs);
}

function chunkWords(words: MappedWord[], maxWords: number): MappedWord[][] {
  const chunks: MappedWord[][] = [];
  let chunk: MappedWord[] = [];
  for (const word of words) {
    const last = chunk.at(-1);
    if (last && (chunk.length >= maxWords || word.outputStartMs - last.outputEndMs > 900)) {
      chunks.push(chunk);
      chunk = [];
    }
    chunk.push(word);
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function createEvents(words: MappedWord[], style: CaptionStyle): CaptionEvent[] {
  const events: CaptionEvent[] = [];
  for (const chunk of chunkWords(words, style.maxWordsPerLine * style.maxLines)) {
    for (const active of chunk) {
      events.push({
        id: `caption-${String(events.length + 1).padStart(4, "0")}`,
        startMs: active.outputStartMs,
        endMs: Math.max(active.outputEndMs, active.outputStartMs + 80),
        sourceStartMs: active.sourceStartMs,
        sourceEndMs: active.sourceEndMs,
        text: chunk.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim(),
        activeWord: active.text.trim(),
      });
    }
  }
  return events;
}

function assTime(ms: number): string {
  const totalCentiseconds = Math.max(0, Math.round(ms / 10));
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function srtTime(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms));
  const milliseconds = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function vttTime(ms: number): string {
  return srtTime(ms).replace(",", ".");
}

function escapeAssText(text: string): string {
  return text.replace(/[{}]/g, "").replace(/\n/g, "\\N").trim();
}

function activeAssText(event: CaptionEvent, style: CaptionStyle): string {
  const words = event.text.split(/\s+/);
  let used = false;
  return words
    .map((word) => {
      if (!used && word === event.activeWord) {
        used = true;
        return `{\\c${style.activeColor}\\b1}${escapeAssText(word)}{\\c${style.primaryColor}\\b0}`;
      }
      return escapeAssText(word);
    })
    .join(" ");
}

export function renderAss(plan: CaptionPlan): string {
  const style = plan.style;
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},${style.activeColor},${style.outlineColor},${style.backColor},1,0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${style.marginL},${style.marginR},${style.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  for (const event of plan.events) {
    lines.push(
      `Dialogue: 0,${assTime(event.startMs)},${assTime(event.endMs)},Default,,0,0,0,,${activeAssText(event, style)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderSrt(plan: CaptionPlan): string {
  return `${plan.events
    .map(
      (event, index) =>
        `${index + 1}\n${srtTime(event.startMs)} --> ${srtTime(event.endMs)}\n${event.text}`,
    )
    .join("\n\n")}\n`;
}

function renderVtt(plan: CaptionPlan): string {
  return `WEBVTT\n\n${plan.events
    .map((event) => `${vttTime(event.startMs)} --> ${vttTime(event.endMs)}\n${event.text}`)
    .join("\n\n")}\n`;
}

export async function createCaptionPlan(options: CreateCaptionPlanOptions): Promise<CaptionPlan> {
  const style = options.style ?? DEFAULT_CAPTION_STYLE;
  const words = wordsFromTimeline(options.timeline);
  const warnings: string[] = [];
  if (words.length === 0) {
    warnings.push("No transcript word timings were found. Active-word captions require segments[].words[].");
  }
  const mappedWords = mapWordsThroughEditPlan(words, options.editPlan ?? null);
  if (options.editPlan && mappedWords.length === 0 && words.length > 0) {
    warnings.push("Transcript words exist, but none overlap the edit plan segments.");
  }
  return CaptionPlanSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    sourceMediaPath: options.sourceMediaPath,
    targetMediaPath: options.targetMediaPath,
    subtitlePath: options.subtitlePath,
    outputPath: options.outputPath,
    format: options.format,
    style,
    events: createEvents(mappedWords, style),
    warnings,
  });
}

export async function writeCaptionArtifacts({
  projectDir,
  plan,
}: {
  projectDir: string;
  plan: CaptionPlan;
}): Promise<void> {
  await mkdir(dirname(resolve(projectDir, plan.subtitlePath)), { recursive: true });
  await mkdir(dirname(captionPlanPath(projectDir)), { recursive: true });
  const subtitle =
    plan.format === "ass" ? renderAss(plan) : plan.format === "srt" ? renderSrt(plan) : renderVtt(plan);
  await writeFile(resolve(projectDir, plan.subtitlePath), subtitle);
  await writeJson(captionPlanPath(projectDir), plan);
}

export async function burnCaptionPlan({
  projectDir,
  plan,
}: {
  projectDir: string;
  plan: CaptionPlan;
}): Promise<string> {
  if (!plan.outputPath) {
    throw new Error("Caption plan has no outputPath.");
  }
  if (plan.format !== "ass") {
    throw new Error("Burned captions currently require ASS format.");
  }
  await mkdir(dirname(resolve(projectDir, plan.outputPath)), { recursive: true });
  await runCommand(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      plan.targetMediaPath,
      "-vf",
      `ass=${plan.subtitlePath}`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      plan.outputPath,
    ],
    { cwd: projectDir },
  );
  return plan.outputPath;
}

export async function readProjectEditPlan(projectDir: string): Promise<EditPlan | null> {
  const path = editPlanPath(projectDir);
  try {
    await stat(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
  return readJson(path, EditPlanSchema);
}
