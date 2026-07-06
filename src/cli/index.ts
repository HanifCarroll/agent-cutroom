#!/usr/bin/env bun
import { Command } from "commander";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { commandExists, runCommand } from "../core/process.js";
import {
  captionPlanPath,
  clipSlateMarkdownPath,
  clipSlatePath,
  colorGradePlanPath,
  contentInventoryPath,
  createProject,
  editPlanPath,
  highlightCandidatesPath,
  platformExportPlanPath,
  readManifest,
  readTimeline,
  shortFormPacingPath,
  socialPackagePath,
  storyCandidatesPath,
  storySelectionPath,
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
import { defaultPlatformExportPath, exportPlatformRender } from "../core/platform-export.js";
import { createOtioTimeline } from "../core/otio.js";
import {
  loadContentProfile,
  loadContentRecipe,
  readStoryCandidates,
  writeContentPackage,
} from "../core/content-package/index.js";
import {
  DEFAULT_SHORT_FORM_PACING_OPTIONS,
  createShortFormPacing,
} from "../core/pacing.js";
import {
  DEFAULT_SUBJECT_MASK_GRADE_OPTIONS,
  applySubjectMaskGrade,
  previewSubjectMaskGrade,
  type SubjectMaskGradeOptions,
} from "../core/color-grade.js";

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
  .option("--link-source", "Symlink source media instead of copying it")
  .description("Create an Agent Cutroom project folder.")
  .action(async (video: string, options: { out: string; transcript?: string; title?: string; linkSource?: boolean }) => {
    const manifest = await createProject({
      videoPath: video,
      transcriptPath: options.transcript,
      outDir: options.out,
      title: options.title,
      linkSource: Boolean(options.linkSource),
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
  .option("--source-plan <path>", "Source edit plan path, relative to project", "edit-plan.json")
  .option("--out <path>", "Output path relative to project", "renders/rough-cut.mp4")
  .description("Render an edit plan to an MP4 rough cut.")
  .action(async (project: string, options: { sourcePlan: string; out: string }) => {
    const plan = await readJson(resolve(project, options.sourcePlan), EditPlanSchema);
    await mkdir(resolve(project, "renders"), { recursive: true });
    const output = await renderEditPlan({
      projectDir: project,
      plan,
      outputRelativePath: options.out,
    });
    console.log(`source plan ${resolve(project, options.sourcePlan)}`);
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

interface ContentPackageCliOptions {
  recipe: string;
  profile: string;
  objective?: string;
  targetSeconds: string;
  minSeconds: string;
  maxSeconds: string;
  max: string;
  select?: string;
  approve?: string;
  leadPaddingMs: string;
  tailPaddingMs: string;
}

function parseApprovedCandidateIds(raw?: string): string[] {
  return raw
    ? raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
}

async function runContentPackageCommand(project: string, options: ContentPackageCliOptions): Promise<void> {
  const manifest = await readManifest(project);
  const timeline = await readTimeline(project);
  const recipe = loadContentRecipe(options.recipe);
  const profile = await loadContentProfile(options.profile);
  const result = await writeContentPackage({
    projectDir: project,
    timeline,
    sourcePath: manifest.sourcePath,
    title: manifest.title,
    recipe,
    profile,
    objective: options.objective,
    targetDurationMs: Math.max(1000, Math.round(Number(options.targetSeconds) * 1000)),
    minDurationMs: Math.max(1000, Math.round(Number(options.minSeconds) * 1000)),
    maxDurationMs: Math.max(1000, Math.round(Number(options.maxSeconds) * 1000)),
    maxCandidates: Math.max(1, Number(options.max)),
    selectedId: options.select,
    approvedCandidateIds: parseApprovedCandidateIds(options.approve),
    leadPaddingMs: Math.max(0, Number(options.leadPaddingMs)),
    tailPaddingMs: Math.max(0, Number(options.tailPaddingMs)),
  });
  console.log(`wrote ${result.storyCandidates.candidates.length} story candidates`);
  console.log(`inventory ${contentInventoryPath(project)}`);
  console.log(`candidates ${storyCandidatesPath(project)}`);
  console.log(`clip slate ${clipSlateMarkdownPath(project)}`);
  console.log(`clip slate json ${clipSlatePath(project)}`);
  console.log(`selection ${storySelectionPath(project)}`);
  if (result.approvedEditPlans.length === 0) {
    console.log("approval needed: review the clip slate before rendering clips");
  } else {
    for (const approvedPlan of result.approvedEditPlans) {
      console.log(`approved clip plan ${approvedPlan.candidateId}: ${resolve(project, approvedPlan.editPlanPath)}`);
    }
    if (result.editPlan) console.log(`single approved edit plan ${editPlanPath(project)}`);
  }
  for (const warning of result.clipSlate.warnings) console.log(`warning: ${warning}`);
}

program
  .command("content-package")
  .argument("<project>", "Project directory")
  .option("--recipe <id>", "Content package recipe. Built-in: talking-head-story", "talking-head-story")
  .option("--profile <id-or-path>", "Content profile for themes, audience, scoring defaults, and post copy", "hanif")
  .option("--objective <text>", "Selection objective")
  .option("--target-seconds <seconds>", "Target selected clip duration in seconds", "75")
  .option("--min-seconds <seconds>", "Minimum candidate duration in seconds", "35")
  .option("--max-seconds <seconds>", "Maximum candidate duration in seconds", "125")
  .option("--max <count>", "Maximum story candidates to keep", "8")
  .option("--approve <ids>", "Comma-separated story candidate IDs approved for clip edit plans")
  .option("--select <id>", "Approve one story candidate ID and write a single selected edit plan")
  .option("--lead-padding-ms <ms>", "Source padding before selected story", "800")
  .option("--tail-padding-ms <ms>", "Source padding after selected story", "1200")
  .description("Build a source-backed content package from a recipe and profile.")
  .action(runContentPackageCommand);

program
  .command("shortform-pacing")
  .argument("<project>", "Project directory")
  .option("--source-plan <path>", "Source edit plan path, relative to project", "edit-plan.json")
  .option("--out-plan <path>", "Output edit plan path, relative to project", "edit-plan.json")
  .option("--min-pause-ms <ms>", "Transcript-word pause duration to tighten", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.minPauseMs))
  .option("--keep-pause-ms <ms>", "Total pause duration to preserve around each cut", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.keepPauseMs))
  .option("--lead-in-ms <ms>", "Speech lead-in to preserve at the start of each segment", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.leadInMs))
  .option("--tail-out-ms <ms>", "Speech tail-out to preserve at the end of each segment", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.tailOutMs))
  .option("--min-cut-ms <ms>", "Minimum removed gap duration", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.minCutMs))
  .option("--min-segment-ms <ms>", "Minimum kept segment duration", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.minSegmentMs))
  .option("--protected-question-pause-ms <ms>", "Question-chain pauses at or below this duration are preserved", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.protectedQuestionPauseMs))
  .option("--protected-question-keep-pause-ms <ms>", "Pause duration to preserve when cutting a long question-chain pause", String(DEFAULT_SHORT_FORM_PACING_OPTIONS.protectedQuestionKeepPauseMs))
  .description("Tighten edit-plan.json for modern short-form pacing using transcript word timings.")
  .action(
    async (
      project: string,
      options: {
        sourcePlan: string;
        outPlan: string;
        minPauseMs: string;
        keepPauseMs: string;
        leadInMs: string;
        tailOutMs: string;
        minCutMs: string;
        minSegmentMs: string;
        protectedQuestionPauseMs: string;
        protectedQuestionKeepPauseMs: string;
      },
    ) => {
      const timeline = await readTimeline(project);
      const sourcePlanPath = resolve(project, options.sourcePlan);
      const outputPlanPath = resolve(project, options.outPlan);
      const editPlan = await readJson(sourcePlanPath, EditPlanSchema);
      const result = createShortFormPacing({
        timeline,
        editPlan,
        sourceEditPlanPath: options.sourcePlan,
        outputEditPlanPath: options.outPlan,
        options: {
          minPauseMs: Number(options.minPauseMs),
          keepPauseMs: Number(options.keepPauseMs),
          leadInMs: Number(options.leadInMs),
          tailOutMs: Number(options.tailOutMs),
          minCutMs: Number(options.minCutMs),
          minSegmentMs: Number(options.minSegmentMs),
          protectedQuestionPauseMs: Number(options.protectedQuestionPauseMs),
          protectedQuestionKeepPauseMs: Number(options.protectedQuestionKeepPauseMs),
        },
      });
      await writeJson(outputPlanPath, result.editPlan);
      await writeJson(shortFormPacingPath(project), result.pacingPlan);
      console.log(`tightened ${result.pacingPlan.beforeDurationMs}ms -> ${result.pacingPlan.afterDurationMs}ms`);
      console.log(`removed ${result.pacingPlan.removedMs}ms across ${result.pacingPlan.cuts.length} cuts`);
      console.log(`protected ${result.pacingPlan.protectedPauses.length} question-chain pauses`);
      console.log(`edit plan ${outputPlanPath}`);
      console.log(`pacing plan ${shortFormPacingPath(project)}`);
      for (const warning of result.pacingPlan.warnings) console.log(`warning: ${warning}`);
    },
  );

interface GradeCliOptions {
  target: string;
  out?: string;
  outDir?: string;
  frames?: string;
  centerXPct: string;
  centerYPct: string;
  radiusXPct: string;
  radiusYPct: string;
  featherPx: string;
  shadowThreshold: string;
  highlightThreshold: string;
  shadowFeatherPx: string;
  finalBlurPx: string;
  brightness: string;
  contrast: string;
  gamma: string;
  gammaWeight: string;
  saturation: string;
}

function gradeOptionsFromCli(options: GradeCliOptions): Partial<SubjectMaskGradeOptions> {
  return {
    centerXPct: Number(options.centerXPct),
    centerYPct: Number(options.centerYPct),
    radiusXPct: Number(options.radiusXPct),
    radiusYPct: Number(options.radiusYPct),
    featherPx: Number(options.featherPx),
    shadowThreshold: Number(options.shadowThreshold),
    highlightThreshold: Number(options.highlightThreshold),
    shadowFeatherPx: Number(options.shadowFeatherPx),
    finalBlurPx: Number(options.finalBlurPx),
    brightness: Number(options.brightness),
    contrast: Number(options.contrast),
    gamma: Number(options.gamma),
    gammaWeight: Number(options.gammaWeight),
    saturation: Number(options.saturation),
  };
}

function addGradeOptions(command: Command): Command {
  return command
    .option("--center-x-pct <n>", "Subject mask center X as a 0-1 percentage", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.centerXPct))
    .option("--center-y-pct <n>", "Subject mask center Y as a 0-1 percentage", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.centerYPct))
    .option("--radius-x-pct <n>", "Subject mask horizontal radius as a 0-1 percentage", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.radiusXPct))
    .option("--radius-y-pct <n>", "Subject mask vertical radius as a 0-1 percentage", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.radiusYPct))
    .option("--feather-px <px>", "Subject mask feather radius in pixels", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.featherPx))
    .option("--shadow-threshold <n>", "Luma value at or below which the grade mask is fully active", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.shadowThreshold))
    .option("--highlight-threshold <n>", "Luma value at or above which the grade mask is inactive", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.highlightThreshold))
    .option("--shadow-feather-px <px>", "Blur radius for the luma shadow matte", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.shadowFeatherPx))
    .option("--final-blur-px <px>", "Blur radius for the combined subject/shadow mask", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.finalBlurPx))
    .option("--brightness <n>", "FFmpeg eq brightness adjustment", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.brightness))
    .option("--contrast <n>", "FFmpeg eq contrast multiplier", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.contrast))
    .option("--gamma <n>", "FFmpeg eq gamma multiplier", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.gamma))
    .option("--gamma-weight <n>", "FFmpeg eq gamma weight", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.gammaWeight))
    .option("--saturation <n>", "FFmpeg eq saturation multiplier", String(DEFAULT_SUBJECT_MASK_GRADE_OPTIONS.saturation));
}

addGradeOptions(
  program
    .command("grade-preview")
    .argument("<project>", "Project directory")
    .option("--target <path>", "Media path to preview-grade, relative to project", "renders/rough-cut.mp4")
    .option("--out-dir <path>", "Preview frame output directory, relative to project", "review/color-grade")
    .option("--frames <count>", "Number of preview frames to write", "3")
    .description("Write preview frames for a feathered subject-mask shadow lift."),
).action(async (project: string, options: GradeCliOptions) => {
  const plan = await previewSubjectMaskGrade({
    projectDir: project,
    targetPath: options.target,
    outputDir: options.outDir ?? "review/color-grade",
    count: Math.max(1, Number(options.frames ?? "3")),
    options: gradeOptionsFromCli(options),
  });
  await writeJson(colorGradePlanPath(project), plan);
  console.log(`wrote ${plan.previewFrames.length} grade preview frames`);
  for (const frame of plan.previewFrames) console.log(`preview ${resolve(project, frame)}`);
  console.log(`plan ${colorGradePlanPath(project)}`);
});

addGradeOptions(
  program
    .command("grade-apply")
    .argument("<project>", "Project directory")
    .option("--target <path>", "Media path to grade, relative to project", "renders/rough-cut.mp4")
    .option("--out <path>", "Graded render output path, relative to project", "renders/graded.mp4")
    .description("Apply a feathered subject-mask shadow lift to a render."),
).action(async (project: string, options: GradeCliOptions) => {
  const output = options.out ?? "renders/graded.mp4";
  const plan = await applySubjectMaskGrade({
    projectDir: project,
    targetPath: options.target,
    outputPath: output,
    options: gradeOptionsFromCli(options),
  });
  await writeJson(colorGradePlanPath(project), plan);
  console.log(`rendered ${resolve(project, output)}`);
  console.log(`plan ${colorGradePlanPath(project)}`);
});

program
  .command("caption")
  .argument("<project>", "Project directory")
  .option("--target <path>", "Media path to caption, relative to project", "renders/rough-cut.mp4")
  .option("--source-plan <path>", "Edit plan path for transcript timing, relative to project", "edit-plan.json")
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
        sourcePlan: string;
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
          : await readProjectEditPlan(project, options.sourcePlan);
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
  .option("--no-platform-export", "Do not create a platform-matched render before packaging")
  .option("--platform-out <path>", "Platform-matched render output path, relative to project")
  .option("--candidate <id>", "Highlight candidate id to package")
  .option("--title <title>", "Override package title")
  .description("Create a platform-matched render, style pack, cover frame, post copy, and social-package.json.")
  .action(
    async (
      project: string,
      options: {
        platform: string;
        render?: string;
        platformExport?: boolean;
        platformOut?: string;
        candidate?: string;
        title?: string;
      },
    ) => {
      const platform = PlatformSchema.parse(options.platform);
      const timeline = await readTimeline(project);
      const sourceRenderPath =
        options.render ??
        ((await relativePathExists(project, "renders/captioned.mp4"))
          ? "renders/captioned.mp4"
          : "renders/rough-cut.mp4");
      let renderPath = sourceRenderPath;
      if (options.platformExport !== false) {
        const exportPlan = await exportPlatformRender({
          projectDir: project,
          platform,
          sourcePath: sourceRenderPath,
          outputPath: options.platformOut ?? defaultPlatformExportPath(platform),
        });
        await writeJson(platformExportPlanPath(project), exportPlan);
        renderPath = exportPlan.outputPath;
        console.log(exportPlan.skipped ? `platform export skipped ${renderPath}` : `platform export ${renderPath}`);
        console.log(`platform export plan ${platformExportPlanPath(project)}`);
        for (const warning of exportPlan.warnings) console.log(`warning: ${warning}`);
      }
      const candidates = await readJson(highlightCandidatesPath(project), HighlightCandidatesSchema).catch(
        () => null,
      );
      const storyCandidates = await readStoryCandidates(project);
      const socialPackage = await createSocialPackage({
        projectDir: project,
        timeline,
        platform,
        renderPath,
        candidateId: options.candidate,
        candidates,
        storyCandidates,
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
  .command("platform-export")
  .argument("<project>", "Project directory")
  .requiredOption("--platform <platform>", "instagram|tiktok|youtube-shorts|linkedin")
  .option("--target <path>", "Source render path, relative to project", "renders/captioned.mp4")
  .option("--out <path>", "Platform-matched render output path, relative to project")
  .description("Export a render so dimensions, fps, codecs, and bitrates match a platform style pack.")
  .action(async (project: string, options: { platform: string; target: string; out?: string }) => {
    const platform = PlatformSchema.parse(options.platform);
    const exportPlan = await exportPlatformRender({
      projectDir: project,
      platform,
      sourcePath: options.target,
      outputPath: options.out ?? defaultPlatformExportPath(platform),
    });
    await writeJson(platformExportPlanPath(project), exportPlan);
    console.log(exportPlan.skipped ? `platform export skipped ${exportPlan.outputPath}` : `exported ${exportPlan.outputPath}`);
    console.log(`plan ${platformExportPlanPath(project)}`);
    for (const warning of exportPlan.warnings) console.log(`warning: ${warning}`);
    if (exportPlan.warnings.length > 0) process.exitCode = 1;
  });

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
