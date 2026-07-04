import { basename, relative, resolve } from "node:path";
import { extractAudioTrack } from "./ffmpeg.js";
import { loadTranscript } from "./transcript.js";
import { runCommand } from "./process.js";
import {
  readManifest,
  readTimeline,
  writeManifest,
  writeTimeline,
} from "./project.js";
import { buildReviewWindows } from "./windows.js";
import type { TranscriptProvenance } from "./schema.js";

export interface TranscribeProjectOptions {
  backend: string;
  model: string;
  language: string;
  prompt?: string;
  promptFile?: string;
  preprocess: boolean;
  vaultNote?: string;
  noteTitle?: string;
  date?: string;
  skipQuality: boolean;
}

export interface TranscribeProjectResult {
  transcriptSegments: number;
  rawTextPath: string | null;
  rawJsonPath: string | null;
  sourceAudioPath: string;
  vaultNotePath: string | null;
  qualityWarningCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(stdout: string, stage: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (isRecord(parsed)) return parsed;
  } catch {
    // Fall through to the structured error below.
  }
  throw new Error(`${stage} did not return a JSON object.`);
}

function outputFor(payload: Record<string, unknown>, format: "txt" | "json"): string | null {
  const outputs = payload.outputs;
  if (!isRecord(outputs)) return null;
  const value = outputs[format];
  return typeof value === "string" && value ? value : null;
}

function modelName(payload: Record<string, unknown>): string | null {
  const model = payload.model;
  if (!isRecord(model)) return null;
  const name = model.name;
  return typeof name === "string" && name ? name : null;
}

function qualityWarnings(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(payload.warnings)
    ? payload.warnings.filter((warning): warning is Record<string, unknown> =>
        isRecord(warning),
      )
    : [];
}

async function runTranscribeAudio(args: string[], stage: string): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await runCommand("transcribe-audio", args);
    return parseJson(stdout, stage);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`transcribe-audio ${stage} failed: ${detail}`);
  }
}

function relativeToProject(projectDir: string, path: string | null): string | null {
  return path ? relative(resolve(projectDir), resolve(path)) : null;
}

export async function transcribeProject(
  projectDir: string,
  options: TranscribeProjectOptions,
): Promise<TranscribeProjectResult> {
  const manifest = await readManifest(projectDir);
  const timeline = await readTimeline(projectDir);

  const sourceAudioPath = await extractAudioTrack({
    projectDir,
    sourceRelativePath: manifest.sourcePath,
    outputRelativePath: "audio/source.wav",
  });
  let transcribedAudioPath = resolve(projectDir, sourceAudioPath);
  let preprocessingNote: string | null = null;

  if (options.preprocess) {
    const output = resolve(projectDir, "audio/source-desilenced.flac");
    const preprocess = await runTranscribeAudio(
      ["preprocess", transcribedAudioPath, "--output", output, "--json"],
      "preprocess",
    );
    const removedSeconds = preprocess.removed_seconds;
    preprocessingNote =
      typeof removedSeconds === "number"
        ? `Long silent stretches were removed before transcription; preprocessing removed ${removedSeconds.toFixed(1)} seconds.`
        : "Long silent stretches were removed before transcription.";
    const preprocessedOutput = preprocess.output;
    if (typeof preprocessedOutput === "string" && preprocessedOutput) {
      transcribedAudioPath = preprocessedOutput;
    }
  }

  const transcriptDir = resolve(projectDir, "transcript");
  const outputName = `${basename(manifest.sourcePath).replace(/\.[^.]+$/, "")}-${options.model}-transcript`;
  const transcribeArgs = [
    "transcribe",
    transcribedAudioPath,
    "--output-dir",
    transcriptDir,
    "--output-name",
    outputName,
    "--backend",
    options.backend,
    "--model",
    options.model,
    "--language",
    options.language,
    "--formats",
    "txt,json",
    "--json",
  ];
  if (options.prompt) transcribeArgs.push("--prompt", options.prompt);
  if (options.promptFile) transcribeArgs.push("--prompt-file", options.promptFile);
  const transcribe = await runTranscribeAudio(transcribeArgs, "transcribe");

  const rawTextPath = outputFor(transcribe, "txt");
  const rawJsonPath = outputFor(transcribe, "json");
  if (!rawJsonPath) {
    throw new Error("transcribe-audio did not return a JSON transcript path.");
  }

  const loaded = await loadTranscript(rawJsonPath);
  const quality = rawTextPath && !options.skipQuality
    ? await runTranscribeAudio(["quality", rawTextPath, "--json"], "quality")
    : { warnings: [] };
  const warnings = qualityWarnings(quality);

  let vaultNotePath: string | null = null;
  if (options.vaultNote) {
    if (!rawTextPath) {
      throw new Error("Cannot write a vault note because no text transcript was produced.");
    }
    const noteArgs = [
      "note",
      rawTextPath,
      "--output",
      options.vaultNote,
      "--title",
      options.noteTitle || manifest.title,
      "--source",
      resolve(projectDir, manifest.sourcePath),
      "--backend",
      typeof transcribe.backend === "string" ? transcribe.backend : options.backend,
      "--model",
      modelName(transcribe) || options.model,
      "--raw-json",
      rawJsonPath,
      "--json",
    ];
    if (options.date) noteArgs.push("--date", options.date);
    if (preprocessingNote) noteArgs.push("--preprocessing-note", preprocessingNote);
    const note = await runTranscribeAudio(noteArgs, "note");
    vaultNotePath = typeof note.output === "string" ? note.output : options.vaultNote;
  }

  const rawJsonRelative = relativeToProject(projectDir, rawJsonPath);
  manifest.transcriptPath = rawJsonRelative;
  timeline.transcriptSegments = loaded.segments;
  timeline.transcriptUntimedText = loaded.untimedText;
  if (timeline.windows.length > 0) {
    const windowMs = Math.max(1, timeline.windows[0].endMs - timeline.windows[0].startMs);
    timeline.windows = buildReviewWindows(timeline, windowMs);
  }
  timeline.transcriptProvenance = {
    tool: "transcribe-audio",
    createdAt: new Date().toISOString(),
    sourceAudioPath: relativeToProject(projectDir, transcribedAudioPath) || sourceAudioPath,
    rawTextPath: relativeToProject(projectDir, rawTextPath),
    rawJsonPath: rawJsonRelative,
    vaultNotePath,
    backend: typeof transcribe.backend === "string" ? transcribe.backend : options.backend,
    model: modelName(transcribe) || options.model,
    qualityWarnings: warnings,
  } satisfies TranscriptProvenance;
  timeline.warnings = [
    ...new Set([
      ...timeline.warnings,
      ...loaded.warnings,
      ...warnings.map((warning) =>
        typeof warning.code === "string"
          ? `Transcript quality warning: ${warning.code}`
          : "Transcript quality warning",
      ),
    ]),
  ];

  await writeManifest(projectDir, manifest);
  await writeTimeline(projectDir, timeline);

  return {
    transcriptSegments: loaded.segments.length,
    rawTextPath: timeline.transcriptProvenance.rawTextPath,
    rawJsonPath: timeline.transcriptProvenance.rawJsonPath,
    sourceAudioPath: timeline.transcriptProvenance.sourceAudioPath,
    vaultNotePath,
    qualityWarningCount: warnings.length,
  };
}
