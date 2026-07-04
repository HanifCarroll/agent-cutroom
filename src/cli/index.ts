#!/usr/bin/env bun
import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { commandExists, runCommand } from "../core/process.js";
import {
  createProject,
  editPlanPath,
  readManifest,
  readTimeline,
  writeTimeline,
} from "../core/project.js";
import { loadTranscript } from "../core/transcript.js";
import {
  createContactSheet,
  detectSilences,
  extractFrames,
  ffprobeMedia,
  renderEditPlan,
} from "../core/ffmpeg.js";
import { chooseFrameTimestamps } from "../core/frames.js";
import { buildReviewWindows } from "../core/windows.js";
import { writeJson, readJson } from "../core/files.js";
import { EditPlanSchema, type Observation } from "../core/schema.js";
import { createEditPlan } from "../core/plan.js";
import { writeReviewPack } from "../core/review.js";
import { writeHyperframesBrief } from "../core/hyperframes.js";
import { transcribeProject } from "../core/transcribe-audio.js";

const program = new Command();

program
  .name("agent-cutroom")
  .description(
    "Agent-accessible tools for video review, timeline metadata, edit planning, and rough-cut rendering.",
  )
  .version("0.1.0");

async function transcribeAudioDoctor(): Promise<boolean> {
  try {
    await runCommand("transcribe-audio", ["doctor", "--json"]);
    return true;
  } catch {
    return false;
  }
}

program.command("doctor").description("Check local media and transcript dependencies.").action(async () => {
  const [ffmpeg, ffprobe, transcribeAudio] = await Promise.all([
    commandExists("ffmpeg"),
    commandExists("ffprobe"),
    transcribeAudioDoctor(),
  ]);
  console.log(`ffmpeg: ${ffmpeg ? "ok" : "missing"}`);
  console.log(`ffprobe: ${ffprobe ? "ok" : "missing"}`);
  console.log(
    `transcribe-audio: ${transcribeAudio ? "ok" : "missing"} (required for the transcribe command)`,
  );
  if (!ffmpeg || !ffprobe) process.exitCode = 1;
});

program
  .command("init")
  .argument("<video>", "Source video file")
  .requiredOption("-o, --out <dir>", "Project output directory")
  .option("-t, --transcript <path>", "Timestamped transcript JSON")
  .option("--title <title>", "Project title")
  .description("Create an Agent Cutroom project folder.")
  .action(async (video: string, options: { out: string; transcript?: string; title?: string }) => {
    const manifest = await createProject({
      videoPath: video,
      transcriptPath: options.transcript,
      outDir: options.out,
      title: options.title,
    });
    console.log(`created ${resolve(options.out)}`);
    console.log(`source ${manifest.sourcePath}`);
  });

program
  .command("probe")
  .argument("<project>", "Project directory")
  .description("Probe source media with ffprobe and update timeline.json.")
  .action(async (project: string) => {
    const manifest = await readManifest(project);
    const timeline = await readTimeline(project);
    timeline.media = await ffprobeMedia(project, manifest.sourcePath);
    await writeTimeline(project, timeline);
    console.log(`probed ${timeline.media.durationMs}ms`);
  });

program
  .command("transcript")
  .argument("<project>", "Project directory")
  .description("Import the project transcript into timeline.json.")
  .action(async (project: string) => {
    const manifest = await readManifest(project);
    if (!manifest.transcriptPath) {
      throw new Error("Project has no transcriptPath. Re-run init with --transcript.");
    }
    const loaded = await loadTranscript(resolve(project, manifest.transcriptPath));
    const timeline = await readTimeline(project);
    timeline.transcriptSegments = loaded.segments;
    timeline.transcriptUntimedText = loaded.untimedText;
    timeline.warnings = [...new Set([...timeline.warnings, ...loaded.warnings])];
    await writeTimeline(project, timeline);
    console.log(`imported ${loaded.segments.length} transcript segments`);
  });

program
  .command("transcribe")
  .argument("<project>", "Project directory")
  .option("--backend <backend>", "transcribe-audio backend", "mlx-whisper")
  .option("--model <model>", "transcribe-audio model", "large-v3")
  .option("--language <language>", "Transcript language, or auto", "auto")
  .option("--prompt <text>", "Initial prompt for names, places, or vocabulary")
  .option("--prompt-file <path>", "Prompt file for names, places, or vocabulary")
  .option("--preprocess", "Remove long silences before transcription", false)
  .option("--vault-note <path>", "Optional Obsidian/vault note output path")
  .option("--note-title <title>", "Vault note title; defaults to project title")
  .option("--date <date>", "Vault note date, YYYY-MM-DD")
  .option("--skip-quality", "Skip transcribe-audio quality checks", false)
  .description("Extract project audio, run transcribe-audio, import timestamped transcript metadata, and optionally write a vault note.")
  .action(
    async (
      project: string,
      options: {
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
      },
    ) => {
      const result = await transcribeProject(project, options);
      console.log(`transcribed ${result.transcriptSegments} timestamped segments`);
      console.log(`audio ${result.sourceAudioPath}`);
      if (result.rawTextPath) console.log(`text ${result.rawTextPath}`);
      if (result.rawJsonPath) console.log(`json ${result.rawJsonPath}`);
      if (result.vaultNotePath) console.log(`vault note ${result.vaultNotePath}`);
      if (result.qualityWarningCount > 0) {
        console.log(`quality warnings ${result.qualityWarningCount}`);
      }
    },
  );

program
  .command("silence")
  .argument("<project>", "Project directory")
  .option("--noise <db>", "FFmpeg silencedetect noise threshold", "-35dB")
  .option("--min-duration <seconds>", "Minimum silence duration in seconds", "0.45")
  .description("Detect audio silence ranges with FFmpeg.")
  .action(async (project: string, options: { noise: string; minDuration: string }) => {
    const manifest = await readManifest(project);
    const timeline = await readTimeline(project);
    timeline.silences = await detectSilences({
      projectDir: project,
      sourceRelativePath: manifest.sourcePath,
      noiseDb: options.noise,
      minDurationSeconds: Number(options.minDuration),
    });
    await writeTimeline(project, timeline);
    console.log(`detected ${timeline.silences.length} silence ranges`);
  });

program
  .command("frames")
  .argument("<project>", "Project directory")
  .option("--interval-ms <ms>", "Interval frame sampling in milliseconds", "5000")
  .option("--max <count>", "Maximum frames to extract", "24")
  .description("Extract review frames and a contact sheet.")
  .action(async (project: string, options: { intervalMs: string; max: string }) => {
    const manifest = await readManifest(project);
    const timeline = await readTimeline(project);
    const timestamps = chooseFrameTimestamps({
      timeline,
      intervalMs: Number(options.intervalMs),
      maxFrames: Number(options.max),
    });
    timeline.frames = await extractFrames({
      projectDir: project,
      sourceRelativePath: manifest.sourcePath,
      timestampsMs: timestamps,
    });
    const contactSheet = await createContactSheet({ projectDir: project });
    if (contactSheet) {
      timeline.warnings = timeline.warnings.filter(
        (warning) => !warning.startsWith("Contact sheet:"),
      );
      timeline.warnings.push(`Contact sheet: ${contactSheet}`);
    }
    await writeTimeline(project, timeline);
    console.log(`extracted ${timeline.frames.length} frames`);
  });

program
  .command("review-pack")
  .argument("<project>", "Project directory")
  .option("--window-ms <ms>", "Review window size in milliseconds", "30000")
  .description("Create an agent-facing markdown review pack.")
  .action(async (project: string, options: { windowMs: string }) => {
    const timeline = await readTimeline(project);
    timeline.windows = buildReviewWindows(timeline, Number(options.windowMs));
    const contactSheet = timeline.warnings
      .find((warning) => warning.startsWith("Contact sheet:"))
      ?.replace("Contact sheet:", "")
      .trim();
    await writeTimeline(project, timeline);
    const output = await writeReviewPack({
      projectDir: project,
      timeline,
      contactSheetPath: contactSheet,
    });
    console.log(`wrote ${output}`);
  });

program
  .command("prepare")
  .argument("<project>", "Project directory")
  .option("--noise <db>", "FFmpeg silencedetect noise threshold", "-35dB")
  .option("--min-duration <seconds>", "Minimum silence duration in seconds", "0.45")
  .option("--interval-ms <ms>", "Interval frame sampling in milliseconds", "5000")
  .option("--max-frames <count>", "Maximum frames to extract", "24")
  .option("--window-ms <ms>", "Review window size in milliseconds", "30000")
  .description("Run probe, transcript import, silence detection, frame extraction, and review-pack generation.")
  .action(
    async (
      project: string,
      options: {
        noise: string;
        minDuration: string;
        intervalMs: string;
        maxFrames: string;
        windowMs: string;
      },
    ) => {
      const manifest = await readManifest(project);
      const timeline = await readTimeline(project);
      timeline.media = await ffprobeMedia(project, manifest.sourcePath);
      if (manifest.transcriptPath) {
        const loaded = await loadTranscript(resolve(project, manifest.transcriptPath));
        timeline.transcriptSegments = loaded.segments;
        timeline.transcriptUntimedText = loaded.untimedText;
        timeline.warnings = [...new Set([...timeline.warnings, ...loaded.warnings])];
      }
      timeline.silences = await detectSilences({
        projectDir: project,
        sourceRelativePath: manifest.sourcePath,
        noiseDb: options.noise,
        minDurationSeconds: Number(options.minDuration),
      });
      const timestamps = chooseFrameTimestamps({
        timeline,
        intervalMs: Number(options.intervalMs),
        maxFrames: Number(options.maxFrames),
      });
      timeline.frames = await extractFrames({
        projectDir: project,
        sourceRelativePath: manifest.sourcePath,
        timestampsMs: timestamps,
      });
      const contactSheet = await createContactSheet({ projectDir: project });
      timeline.warnings = timeline.warnings.filter(
        (warning) => !warning.startsWith("Contact sheet:"),
      );
      if (contactSheet) timeline.warnings.push(`Contact sheet: ${contactSheet}`);
      timeline.windows = buildReviewWindows(timeline, Number(options.windowMs));
      await writeTimeline(project, timeline);
      const output = await writeReviewPack({
        projectDir: project,
        timeline,
        contactSheetPath: contactSheet,
      });
      console.log(`prepared ${resolve(project)}`);
      console.log(`review ${output}`);
    },
  );

program
  .command("observe")
  .argument("<project>", "Project directory")
  .requiredOption("--window <id>", "Window id from review-pack.md")
  .requiredOption("--summary <text>", "Visual summary written by the agent")
  .option("--visible-text <text>", "Text visible in reviewed frames", "")
  .option("--editing-use <use>", "keep|tighten|cut|broll", "keep")
  .option("--broll <need>", "none|low|medium|high", "none")
  .option("--note <note...>", "Additional notes")
  .description("Record an agent observation for a review window.")
  .action(
    async (
      project: string,
      options: {
        window: string;
        summary: string;
        visibleText: string;
        editingUse: Observation["editingUse"];
        broll: Observation["brollNeed"];
        note?: string[];
      },
    ) => {
      const timeline = await readTimeline(project);
      if (!timeline.windows.some((window) => window.id === options.window)) {
        throw new Error(`Unknown window id: ${options.window}`);
      }
      const observation: Observation = {
        id: `obs-${String(timeline.observations.length + 1).padStart(3, "0")}`,
        windowId: options.window,
        createdAt: new Date().toISOString(),
        visualSummary: options.summary,
        visibleText: options.visibleText,
        editingUse: options.editingUse,
        brollNeed: options.broll,
        notes: options.note ?? [],
      };
      timeline.observations = [
        ...timeline.observations.filter((item) => item.windowId !== options.window),
        observation,
      ];
      await writeTimeline(project, timeline);
      console.log(`recorded observation ${observation.id}`);
    },
  );

program
  .command("plan")
  .argument("<project>", "Project directory")
  .option("--min-silence-ms <ms>", "Silence duration to cut", "700")
  .option("--min-keep-ms <ms>", "Minimum keep segment duration", "300")
  .description("Create edit-plan.json from timeline silences and observations.")
  .action(async (project: string, options: { minSilenceMs: string; minKeepMs: string }) => {
    const manifest = await readManifest(project);
    const timeline = await readTimeline(project);
    const plan = createEditPlan({
      timeline,
      sourcePath: manifest.sourcePath,
      minSilenceMs: Number(options.minSilenceMs),
      minKeepMs: Number(options.minKeepMs),
    });
    await writeJson(editPlanPath(project), plan);
    console.log(`planned ${plan.segments.length} keep segments`);
  });

program
  .command("render")
  .argument("<project>", "Project directory")
  .option("--out <path>", "Output path relative to project", "renders/rough-cut.mp4")
  .description("Render edit-plan.json to an MP4 rough cut.")
  .action(async (project: string, options: { out: string }) => {
    const plan = await readJson(editPlanPath(project), EditPlanSchema);
    await mkdir(resolve(project, "renders"), { recursive: true });
    const output = await renderEditPlan({
      projectDir: project,
      plan,
      outputRelativePath: options.out,
    });
    console.log(`rendered ${join(resolve(project), output)}`);
  });

program
  .command("hyperframes-brief")
  .argument("<project>", "Project directory")
  .description("Generate a brief for a polished HyperFrames composition.")
  .action(async (project: string) => {
    const timeline = await readTimeline(project);
    const plan = await readJson(editPlanPath(project), EditPlanSchema);
    const output = await writeHyperframesBrief({ projectDir: project, timeline, editPlan: plan });
    console.log(`wrote ${output}`);
  });

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
