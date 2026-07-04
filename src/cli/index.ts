#!/usr/bin/env bun
import { Command } from "commander";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { commandExists, runCommand } from "../core/process.js";
import {
  captionPlanPath,
  createProject,
  editPlanPath,
  highlightCandidatesPath,
  readManifest,
  readTimeline,
  socialPackagePath,
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
import {
  EditPlanSchema,
  HighlightCandidatesSchema,
  PlatformSchema,
  type Observation,
} from "../core/schema.js";
import { createEditPlan } from "../core/plan.js";
import { writeReviewPack } from "../core/review.js";
import { writeHyperframesBrief } from "../core/hyperframes.js";
import { transcribeProject } from "../core/transcribe-audio.js";
import {
  burnCaptionPlan,
  createCaptionPlan,
  readProjectEditPlan,
  writeCaptionArtifacts,
} from "../core/captions.js";
import { findMoments } from "../core/find-moments.js";
import { verifyRender } from "../core/verify.js";
import { createSocialPackage } from "../core/social-package.js";
import { createOtioTimeline } from "../core/otio.js";

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

async function relativePathExists(project: string, relativePath: string): Promise<boolean> {
  try {
    const stats = await stat(resolve(project, relativePath));
    return stats.isFile();
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
  .command("find-moments")
  .argument("<project>", "Project directory")
  .option("--objective <text>", "Editorial objective for the candidate list", "Find a complete social-ready moment.")
  .option("--target-seconds <seconds>", "Target clip duration in seconds", "30")
  .option("--max <count>", "Maximum candidates to write", "8")
  .description("Write ranked, evidence-backed candidate clip windows to analysis/highlight-candidates.json.")
  .action(
    async (
      project: string,
      options: { objective: string; targetSeconds: string; max: string },
    ) => {
      const timeline = await readTimeline(project);
      const candidates = findMoments({
        timeline,
        objective: options.objective,
        targetDurationMs: Math.max(1000, Math.round(Number(options.targetSeconds) * 1000)),
        maxCandidates: Math.max(1, Number(options.max)),
      });
      await writeJson(highlightCandidatesPath(project), candidates);
      console.log(`wrote ${candidates.candidates.length} candidates`);
      console.log(`analysis ${highlightCandidatesPath(project)}`);
      for (const candidate of candidates.candidates.slice(0, 3)) {
        console.log(
          `${candidate.id}: ${candidate.sourceStartMs}-${candidate.sourceEndMs}ms score=${candidate.score.toFixed(2)} ${candidate.reason}`,
        );
      }
    },
  );

program
  .command("caption")
  .argument("<project>", "Project directory")
  .option("--target <path>", "Media path to caption, relative to project", "renders/rough-cut.mp4")
  .option("--format <format>", "Subtitle format: ass|srt|vtt", "ass")
  .option("--subtitle-out <path>", "Subtitle output path, relative to project")
  .option("--out <path>", "Burned caption video path, relative to project", "renders/captioned.mp4")
  .option("--no-burn", "Only write subtitle files and plans; do not render burned captions")
  .option("--no-edit-plan-timing", "Use source transcript timing directly instead of mapping through edit-plan.json")
  .description("Generate word-timed subtitle artifacts and optionally burn active-word ASS captions.")
  .action(
    async (
      project: string,
      options: {
        target: string;
        format: string;
        subtitleOut?: string;
        out: string;
        burn: boolean;
        editPlanTiming: boolean;
      },
    ) => {
      const manifest = await readManifest(project);
      const timeline = await readTimeline(project);
      const format = options.format === "srt" || options.format === "vtt" ? options.format : "ass";
      if (options.burn !== false && format !== "ass") {
        throw new Error("Burned captions require --format ass. Use --no-burn for srt or vtt.");
      }
      const editPlan =
        options.editPlanTiming === false || options.target === manifest.sourcePath
          ? null
          : await readProjectEditPlan(project);
      const subtitlePath = options.subtitleOut ?? `captions/captions.${format}`;
      const plan = await createCaptionPlan({
        projectDir: project,
        timeline,
        sourceMediaPath: manifest.sourcePath,
        targetMediaPath: options.target,
        subtitlePath,
        outputPath: options.burn === false ? null : options.out,
        format,
        editPlan,
      });
      await writeCaptionArtifacts({ projectDir: project, plan });
      console.log(`wrote ${plan.events.length} caption events`);
      console.log(`subtitle ${resolve(project, plan.subtitlePath)}`);
      console.log(`plan ${captionPlanPath(project)}`);
      if (plan.warnings.length > 0) {
        for (const warning of plan.warnings) console.log(`warning: ${warning}`);
      }
      if (options.burn !== false && plan.events.length > 0) {
        const output = await burnCaptionPlan({ projectDir: project, plan });
        console.log(`rendered ${resolve(project, output)}`);
      }
    },
  );

program
  .command("verify")
  .argument("<project>", "Project directory")
  .option("--target <path>", "Media path to verify, relative to project")
  .option("--out <path>", "Report path, relative to project", "renders/verify-report.json")
  .option("--min-duration-ms <ms>", "Minimum expected duration in milliseconds")
  .option("--preview-frames <count>", "Number of preview frames to extract", "3")
  .description("Probe, decode, and preview-check a rendered video.")
  .action(
    async (
      project: string,
      options: { target?: string; out: string; minDurationMs?: string; previewFrames: string },
    ) => {
      const target =
        options.target ??
        ((await relativePathExists(project, "renders/captioned.mp4"))
          ? "renders/captioned.mp4"
          : "renders/rough-cut.mp4");
      const report = await verifyRender({
        projectDir: project,
        targetPath: target,
        minDurationMs: options.minDurationMs ? Number(options.minDurationMs) : undefined,
        previewCount: Math.max(0, Number(options.previewFrames)),
      });
      await writeJson(resolve(project, options.out), report);
      console.log(`${report.ok ? "ok" : "failed"} ${target}`);
      console.log(`report ${resolve(project, options.out)}`);
      for (const check of report.checks) {
        console.log(`${check.status}: ${check.id} - ${check.message}`);
      }
      if (!report.ok) process.exitCode = 1;
    },
  );

program
  .command("social-package")
  .argument("<project>", "Project directory")
  .option("--platform <platform>", "instagram|tiktok|youtube-shorts|linkedin", "instagram")
  .option("--render <path>", "Render path to package, relative to project")
  .option("--candidate <id>", "Highlight candidate id to package")
  .option("--title <title>", "Override package title")
  .description("Create a platform style pack, cover frame, post copy, and social-package.json.")
  .action(
    async (
      project: string,
      options: { platform: string; render?: string; candidate?: string; title?: string },
    ) => {
      const platform = PlatformSchema.parse(options.platform);
      const timeline = await readTimeline(project);
      const renderPath =
        options.render ??
        ((await relativePathExists(project, "renders/captioned.mp4"))
          ? "renders/captioned.mp4"
          : "renders/rough-cut.mp4");
      const candidates = await readJson(highlightCandidatesPath(project), HighlightCandidatesSchema).catch(
        () => null,
      );
      const socialPackage = await createSocialPackage({
        projectDir: project,
        timeline,
        platform,
        renderPath,
        candidateId: options.candidate,
        candidates,
        title: options.title,
      });
      await writeJson(socialPackagePath(project), socialPackage);
      console.log(`packaged ${socialPackage.platform}`);
      console.log(`manifest ${socialPackagePath(project)}`);
      if (socialPackage.coverFramePath) console.log(`cover ${resolve(project, socialPackage.coverFramePath)}`);
      console.log(`post ${resolve(project, socialPackage.postCopyPath)}`);
      for (const warning of socialPackage.warnings) console.log(`warning: ${warning}`);
    },
  );

program
  .command("export-otio")
  .argument("<project>", "Project directory")
  .option("--out <path>", "OTIO output path, relative to project", "exports/edit.otio")
  .description("Export edit-plan.json to an OpenTimelineIO-compatible JSON file.")
  .action(async (project: string, options: { out: string }) => {
    const manifest = await readManifest(project);
    const editPlan = await readJson(editPlanPath(project), EditPlanSchema);
    const otio = createOtioTimeline({ manifest, editPlan });
    await writeJson(resolve(project, options.out), otio);
    console.log(`exported ${resolve(project, options.out)}`);
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
