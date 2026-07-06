#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { runCommand } from "../core/process.js";

const server = new McpServer({
  name: "agent-cutroom",
  version: "0.1.0",
});

const mcpDir = dirname(fileURLToPath(import.meta.url));
const builtCliPath = resolve(mcpDir, "../cli/index.js");
const sourceCliPath = resolve(mcpDir, "../cli/index.ts");
const cliPath = existsSync(builtCliPath) ? builtCliPath : sourceCliPath;

function encodeArtifact(project: string, path: string): string {
  return Buffer.from(JSON.stringify({ project: resolve(project), path }), "utf8").toString("base64url");
}

function decodeArtifact(token: string): { project: string; path: string } {
  const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid artifact token.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.project !== "string" || typeof record.path !== "string") {
    throw new Error("Invalid artifact token.");
  }
  return { project: record.project, path: record.path };
}

function artifactLink(project: string, path: string, description: string): Record<string, unknown> {
  return {
    type: "resource_link",
    uri: `cutroom://artifact/${encodeArtifact(project, path)}`,
    name: path,
    description,
    mimeType: path.endsWith(".md")
      ? "text/markdown"
      : path.endsWith(".json") || path.endsWith(".otio")
        ? "application/json"
        : "text/plain",
  };
}

async function callCli(args: string[]): Promise<string> {
  const { stdout, stderr } = await runCommand(process.execPath, [cliPath, ...args]);
  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}

function toolResult(text: string, links: Record<string, unknown>[] = []): CallToolResult {
  return {
    content: [{ type: "text", text }, ...links] as CallToolResult["content"],
    structuredContent: {
      status: "ok",
      text,
      resources: links.map((link) => ({ uri: link.uri, name: link.name })),
    },
  };
}

const ProjectArg = z.string().describe("Agent Cutroom project directory path.");

server.registerResource(
  "project-artifact",
  new ResourceTemplate("cutroom://artifact/{token}", { list: undefined }),
  {
    title: "Agent Cutroom Project Artifact",
    description: "Read an artifact returned by an Agent Cutroom MCP tool.",
    mimeType: "text/plain",
  },
  async (uri, variables) => {
    const token = String(variables.token);
    const { project, path } = decodeArtifact(token);
    const absolutePath = resolve(project, path);
    if (!absolutePath.startsWith(resolve(project))) {
      throw new Error("Artifact path escapes project directory.");
    }
    const text = await readFile(absolutePath, "utf8");
    return {
      contents: [
        {
          uri: uri.href,
          text,
          mimeType: path.endsWith(".md")
            ? "text/markdown"
            : path.endsWith(".json") || path.endsWith(".otio")
              ? "application/json"
              : "text/plain",
        },
      ],
    };
  },
);

server.registerTool(
  "doctor",
  {
    title: "Check Agent Cutroom Dependencies",
    description:
      "Use `doctor` to check whether ffmpeg, ffprobe, and optional transcribe-audio support are available. This is read-only and has no project prerequisite.",
    inputSchema: {},
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => toolResult(await callCli(["doctor"])),
);

server.registerTool(
  "init_project",
  {
    title: "Create Project",
    description:
      "Use `init_project` to create a project folder from a source video and optional timestamped transcript. Side effects: copies media and writes cutroom.json and timeline.json.",
    inputSchema: {
      video: z.string().describe("Source video file path."),
      out: z.string().describe("Project output directory."),
      transcript: z.string().optional().describe("Optional timestamped transcript JSON path."),
      title: z.string().optional().describe("Optional project title."),
      linkSource: z.boolean().default(false).describe("Symlink source media instead of copying it."),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ video, out, transcript, title, linkSource }) => {
    const args = ["init", video, "--out", out];
    if (transcript) args.push("--transcript", transcript);
    if (title) args.push("--title", title);
    if (linkSource) args.push("--link-source");
    return toolResult(await callCli(args), [
      artifactLink(out, "cutroom.json", "Project manifest"),
      artifactLink(out, "timeline.json", "Project timeline"),
    ]);
  },
);

server.registerTool(
  "prepare_project",
  {
    title: "Prepare Review Pack",
    description:
      "Use `prepare_project` after init/transcription to probe media, import transcript data, detect silence, extract frames, create a contact sheet, and write review/review-pack.md.",
    inputSchema: {
      project: ProjectArg,
      maxFrames: z.number().int().positive().optional(),
      windowMs: z.number().int().positive().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, maxFrames, windowMs }) => {
    const args = ["prepare", project];
    if (maxFrames) args.push("--max-frames", String(maxFrames));
    if (windowMs) args.push("--window-ms", String(windowMs));
    return toolResult(await callCli(args), [
      artifactLink(project, "timeline.json", "Prepared timeline"),
      artifactLink(project, "review/review-pack.md", "Agent review pack"),
    ]);
  },
);

server.registerTool(
  "record_observation",
  {
    title: "Record Observation",
    description:
      "Use `record_observation` after inspecting review frames/contact sheets to write the agent's visual and editorial judgment into timeline.json.",
    inputSchema: {
      project: ProjectArg,
      window: z.string(),
      summary: z.string(),
      visibleText: z.string().optional(),
      editingUse: z.enum(["keep", "tighten", "cut", "broll"]).default("keep"),
      broll: z.enum(["none", "low", "medium", "high"]).default("none"),
      notes: z.array(z.string()).optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, window, summary, visibleText, editingUse, broll, notes }) => {
    const args = ["observe", project, "--window", window, "--summary", summary, "--editing-use", editingUse, "--broll", broll];
    if (visibleText) args.push("--visible-text", visibleText);
    for (const note of notes ?? []) args.push("--note", note);
    return toolResult(await callCli(args), [artifactLink(project, "timeline.json", "Timeline with observation")]);
  },
);

server.registerTool(
  "plan_render",
  {
    title: "Plan And Render Rough Cut",
    description:
      "Use `plan_render` after observations are recorded to write edit-plan.json and render renders/rough-cut.mp4. This mutates project artifacts and may take time.",
    inputSchema: {
      project: ProjectArg,
      minSilenceMs: z.number().int().nonnegative().optional(),
      minKeepMs: z.number().int().nonnegative().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, minSilenceMs, minKeepMs }) => {
    const planArgs = ["plan", project];
    if (minSilenceMs !== undefined) planArgs.push("--min-silence-ms", String(minSilenceMs));
    if (minKeepMs !== undefined) planArgs.push("--min-keep-ms", String(minKeepMs));
    const text = [await callCli(planArgs), await callCli(["render", project])].join("\n");
    return toolResult(text, [
      artifactLink(project, "edit-plan.json", "Edit plan"),
      artifactLink(project, "renders/rough-cut.mp4", "Rough cut render"),
    ]);
  },
);

server.registerTool(
  "find_moments",
  {
    title: "Find Candidate Moments",
    description:
      "Use `find_moments` to write ranked candidate clip windows with reasons and source evidence. Use after prepare so windows, transcript, frames, and observations are available.",
    inputSchema: {
      project: ProjectArg,
      objective: z.string().optional(),
      targetSeconds: z.number().positive().optional(),
      max: z.number().int().positive().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, objective, targetSeconds, max }) => {
    const args = ["find-moments", project];
    if (objective) args.push("--objective", objective);
    if (targetSeconds) args.push("--target-seconds", String(targetSeconds));
    if (max) args.push("--max", String(max));
    return toolResult(await callCli(args), [
      artifactLink(project, "analysis/highlight-candidates.json", "Candidate moments"),
    ]);
  },
);

server.registerTool(
  "content_package",
  {
    title: "Create Content Package",
    description:
      "Use `content_package` after prepare to build a source-backed content inventory, story candidates, and clip approval slate. Pass approved candidate IDs to create per-clip edit plans.",
    inputSchema: {
      project: ProjectArg,
      recipe: z.string().default("talking-head-story"),
      profile: z.string().default("hanif"),
      objective: z.string().optional(),
      targetSeconds: z.number().positive().optional(),
      minSeconds: z.number().positive().optional(),
      maxSeconds: z.number().positive().optional(),
      max: z.number().int().positive().optional(),
      approve: z.string().optional(),
      select: z.string().optional(),
      leadPaddingMs: z.number().int().nonnegative().optional(),
      tailPaddingMs: z.number().int().nonnegative().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({
    project,
    recipe,
    profile,
    objective,
    targetSeconds,
    minSeconds,
    maxSeconds,
    max,
    approve,
    select,
    leadPaddingMs,
    tailPaddingMs,
  }) => {
    const args = ["content-package", project, "--recipe", recipe, "--profile", profile];
    if (objective) args.push("--objective", objective);
    if (targetSeconds) args.push("--target-seconds", String(targetSeconds));
    if (minSeconds) args.push("--min-seconds", String(minSeconds));
    if (maxSeconds) args.push("--max-seconds", String(maxSeconds));
    if (max) args.push("--max", String(max));
    if (approve) args.push("--approve", approve);
    if (select) args.push("--select", select);
    if (leadPaddingMs !== undefined) args.push("--lead-padding-ms", String(leadPaddingMs));
    if (tailPaddingMs !== undefined) args.push("--tail-padding-ms", String(tailPaddingMs));
    return toolResult(await callCli(args), [
      artifactLink(project, "review/content-inventory.md", "Content inventory"),
      artifactLink(project, "analysis/story-candidates.json", "Story candidates"),
      artifactLink(project, "review/clip-slate.md", "Clip approval slate"),
      artifactLink(project, "analysis/clip-slate.json", "Clip approval slate JSON"),
      artifactLink(project, "analysis/story-selection.md", "Story selection"),
    ]);
  },
);

server.registerTool(
  "shortform_pacing",
  {
    title: "Apply Short-Form Pacing",
    description:
      "Use `shortform_pacing` after content_package or plan to tighten edit-plan.json by cutting meaningful dead-air pauses while preserving small breath gaps and rhetorical question-chain pauses.",
    inputSchema: {
      project: ProjectArg,
      sourcePlan: z.string().default("edit-plan.json"),
      outPlan: z.string().default("edit-plan.json"),
      minPauseMs: z.number().int().nonnegative().optional(),
      keepPauseMs: z.number().int().nonnegative().optional(),
      leadInMs: z.number().int().nonnegative().optional(),
      tailOutMs: z.number().int().nonnegative().optional(),
      protectedQuestionPauseMs: z.number().int().nonnegative().optional(),
      protectedQuestionKeepPauseMs: z.number().int().nonnegative().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({
    project,
    sourcePlan,
    outPlan,
    minPauseMs,
    keepPauseMs,
    leadInMs,
    tailOutMs,
    protectedQuestionPauseMs,
    protectedQuestionKeepPauseMs,
  }) => {
    const args = ["shortform-pacing", project, "--source-plan", sourcePlan, "--out-plan", outPlan];
    if (minPauseMs !== undefined) args.push("--min-pause-ms", String(minPauseMs));
    if (keepPauseMs !== undefined) args.push("--keep-pause-ms", String(keepPauseMs));
    if (leadInMs !== undefined) args.push("--lead-in-ms", String(leadInMs));
    if (tailOutMs !== undefined) args.push("--tail-out-ms", String(tailOutMs));
    if (protectedQuestionPauseMs !== undefined) args.push("--protected-question-pause-ms", String(protectedQuestionPauseMs));
    if (protectedQuestionKeepPauseMs !== undefined) args.push("--protected-question-keep-pause-ms", String(protectedQuestionKeepPauseMs));
    return toolResult(await callCli(args), [
      artifactLink(project, outPlan, "Short-form edit plan"),
      artifactLink(project, "plans/short-form-pacing.json", "Short-form pacing plan"),
    ]);
  },
);

server.registerTool(
  "grade_preview",
  {
    title: "Preview Subject Mask Grade",
    description:
      "Use `grade_preview` after rendering to write preview frames for a highlight-protected subject-mask shadow lift.",
    inputSchema: {
      project: ProjectArg,
      target: z.string().default("renders/rough-cut.mp4"),
      outDir: z.string().default("review/color-grade"),
      frames: z.number().int().positive().optional(),
      centerXPct: z.number().min(0).max(1).optional(),
      centerYPct: z.number().min(0).max(1).optional(),
      radiusXPct: z.number().positive().optional(),
      radiusYPct: z.number().positive().optional(),
      featherPx: z.number().nonnegative().optional(),
      shadowThreshold: z.number().min(0).max(255).optional(),
      highlightThreshold: z.number().min(0).max(255).optional(),
      shadowFeatherPx: z.number().nonnegative().optional(),
      finalBlurPx: z.number().nonnegative().optional(),
      brightness: z.number().optional(),
      contrast: z.number().positive().optional(),
      gamma: z.number().positive().optional(),
      gammaWeight: z.number().min(0).max(1).optional(),
      saturation: z.number().positive().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({
    project,
    target,
    outDir,
    frames,
    centerXPct,
    centerYPct,
    radiusXPct,
    radiusYPct,
    featherPx,
    shadowThreshold,
    highlightThreshold,
    shadowFeatherPx,
    finalBlurPx,
    brightness,
    contrast,
    gamma,
    gammaWeight,
    saturation,
  }) => {
    const args = ["grade-preview", project, "--target", target, "--out-dir", outDir];
    if (frames !== undefined) args.push("--frames", String(frames));
    if (centerXPct !== undefined) args.push("--center-x-pct", String(centerXPct));
    if (centerYPct !== undefined) args.push("--center-y-pct", String(centerYPct));
    if (radiusXPct !== undefined) args.push("--radius-x-pct", String(radiusXPct));
    if (radiusYPct !== undefined) args.push("--radius-y-pct", String(radiusYPct));
    if (featherPx !== undefined) args.push("--feather-px", String(featherPx));
    if (shadowThreshold !== undefined) args.push("--shadow-threshold", String(shadowThreshold));
    if (highlightThreshold !== undefined) args.push("--highlight-threshold", String(highlightThreshold));
    if (shadowFeatherPx !== undefined) args.push("--shadow-feather-px", String(shadowFeatherPx));
    if (finalBlurPx !== undefined) args.push("--final-blur-px", String(finalBlurPx));
    if (brightness !== undefined) args.push("--brightness", String(brightness));
    if (contrast !== undefined) args.push("--contrast", String(contrast));
    if (gamma !== undefined) args.push("--gamma", String(gamma));
    if (gammaWeight !== undefined) args.push("--gamma-weight", String(gammaWeight));
    if (saturation !== undefined) args.push("--saturation", String(saturation));
    return toolResult(await callCli(args), [
      artifactLink(project, "plans/color-grade.json", "Color grade plan"),
    ]);
  },
);

server.registerTool(
  "grade_apply",
  {
    title: "Apply Subject Mask Grade",
    description:
      "Use `grade_apply` after rendering to create a shadow-lifted render through a subject mask combined with luma highlight protection.",
    inputSchema: {
      project: ProjectArg,
      target: z.string().default("renders/rough-cut.mp4"),
      out: z.string().default("renders/graded.mp4"),
      centerXPct: z.number().min(0).max(1).optional(),
      centerYPct: z.number().min(0).max(1).optional(),
      radiusXPct: z.number().positive().optional(),
      radiusYPct: z.number().positive().optional(),
      featherPx: z.number().nonnegative().optional(),
      shadowThreshold: z.number().min(0).max(255).optional(),
      highlightThreshold: z.number().min(0).max(255).optional(),
      shadowFeatherPx: z.number().nonnegative().optional(),
      finalBlurPx: z.number().nonnegative().optional(),
      brightness: z.number().optional(),
      contrast: z.number().positive().optional(),
      gamma: z.number().positive().optional(),
      gammaWeight: z.number().min(0).max(1).optional(),
      saturation: z.number().positive().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({
    project,
    target,
    out,
    centerXPct,
    centerYPct,
    radiusXPct,
    radiusYPct,
    featherPx,
    shadowThreshold,
    highlightThreshold,
    shadowFeatherPx,
    finalBlurPx,
    brightness,
    contrast,
    gamma,
    gammaWeight,
    saturation,
  }) => {
    const args = ["grade-apply", project, "--target", target, "--out", out];
    if (centerXPct !== undefined) args.push("--center-x-pct", String(centerXPct));
    if (centerYPct !== undefined) args.push("--center-y-pct", String(centerYPct));
    if (radiusXPct !== undefined) args.push("--radius-x-pct", String(radiusXPct));
    if (radiusYPct !== undefined) args.push("--radius-y-pct", String(radiusYPct));
    if (featherPx !== undefined) args.push("--feather-px", String(featherPx));
    if (shadowThreshold !== undefined) args.push("--shadow-threshold", String(shadowThreshold));
    if (highlightThreshold !== undefined) args.push("--highlight-threshold", String(highlightThreshold));
    if (shadowFeatherPx !== undefined) args.push("--shadow-feather-px", String(shadowFeatherPx));
    if (finalBlurPx !== undefined) args.push("--final-blur-px", String(finalBlurPx));
    if (brightness !== undefined) args.push("--brightness", String(brightness));
    if (contrast !== undefined) args.push("--contrast", String(contrast));
    if (gamma !== undefined) args.push("--gamma", String(gamma));
    if (gammaWeight !== undefined) args.push("--gamma-weight", String(gammaWeight));
    if (saturation !== undefined) args.push("--saturation", String(saturation));
    return toolResult(await callCli(args), [
      artifactLink(project, out, "Graded render"),
      artifactLink(project, "plans/color-grade.json", "Color grade plan"),
    ]);
  },
);

server.registerTool(
  "caption",
  {
    title: "Create Captions",
    description:
      "Use `caption` after render to create word-timed subtitle artifacts and optionally burn active-word ASS captions. Requires transcript word timings.",
    inputSchema: {
      project: ProjectArg,
      target: z.string().optional(),
      out: z.string().optional(),
      burn: z.boolean().default(true),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, target, out, burn }) => {
    const args = ["caption", project];
    if (target) args.push("--target", target);
    if (out) args.push("--out", out);
    if (!burn) args.push("--no-burn");
    return toolResult(await callCli(args), [
      artifactLink(project, "plans/caption-plan.json", "Caption plan"),
      artifactLink(project, out ?? "renders/captioned.mp4", "Captioned render"),
    ]);
  },
);

server.registerTool(
  "verify",
  {
    title: "Verify Render",
    description:
      "Use `verify` to probe, decode, and extract preview frames for a render. This writes renders/verify-report.json.",
    inputSchema: {
      project: ProjectArg,
      target: z.string().optional(),
      previewFrames: z.number().int().nonnegative().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, target, previewFrames }) => {
    const args = ["verify", project];
    if (target) args.push("--target", target);
    if (previewFrames !== undefined) args.push("--preview-frames", String(previewFrames));
    return toolResult(await callCli(args), [
      artifactLink(project, "renders/verify-report.json", "Verification report"),
    ]);
  },
);

server.registerTool(
  "platform_export",
  {
    title: "Export Platform Render",
    description:
      "Use `platform_export` after a render exists to create a platform-matched MP4 using the selected style pack dimensions, fps, video bitrate, and audio bitrate.",
    inputSchema: {
      project: ProjectArg,
      platform: z.enum(["instagram", "tiktok", "youtube-shorts", "linkedin"]).default("instagram"),
      target: z.string().default("renders/captioned.mp4"),
      out: z.string().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, platform, target, out }) => {
    const args = ["platform-export", project, "--platform", platform, "--target", target];
    if (out) args.push("--out", out);
    return toolResult(await callCli(args), [
      artifactLink(project, "plans/platform-export.json", "Platform export plan"),
    ]);
  },
);

server.registerTool(
  "social_package",
  {
    title: "Create Social Package",
    description:
      "Use `social_package` after a render exists to create a platform-matched render, style pack, cover frame, post copy, and plans/social-package.json.",
    inputSchema: {
      project: ProjectArg,
      platform: z.enum(["instagram", "tiktok", "youtube-shorts", "linkedin"]).default("instagram"),
      render: z.string().optional(),
      platformOut: z.string().optional(),
      candidate: z.string().optional(),
      title: z.string().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, platform, render, platformOut, candidate, title }) => {
    const args = ["social-package", project, "--platform", platform];
    if (render) args.push("--render", render);
    if (platformOut) args.push("--platform-out", platformOut);
    if (candidate) args.push("--candidate", candidate);
    if (title) args.push("--title", title);
    return toolResult(await callCli(args), [
      artifactLink(project, "plans/platform-export.json", "Platform export plan"),
      artifactLink(project, "plans/social-package.json", "Social package manifest"),
      artifactLink(project, "release/post-copy.md", "Post copy"),
    ]);
  },
);

server.registerTool(
  "export_otio",
  {
    title: "Export OTIO",
    description:
      "Use `export_otio` after edit-plan.json exists to write an OpenTimelineIO-compatible JSON timeline at exports/edit.otio.",
    inputSchema: { project: ProjectArg },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project }) =>
    toolResult(await callCli(["export-otio", project]), [
      artifactLink(project, "exports/edit.otio", "OpenTimelineIO export"),
    ]),
);

server.registerTool(
  "hyperframes_brief",
  {
    title: "Write HyperFrames Brief",
    description:
      "Use `hyperframes_brief` after a rough edit plan exists to write hyperframes/brief.md for a polished HyperFrames pass.",
    inputSchema: { project: ProjectArg },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project }) =>
    toolResult(await callCli(["hyperframes-brief", project]), [
      artifactLink(project, "hyperframes/brief.md", "HyperFrames brief"),
    ]),
);

server.registerPrompt(
  "review-footage",
  {
    title: "Review Footage",
    description: "Guide an agent through preparing and reviewing footage with Agent Cutroom.",
    argsSchema: { project: ProjectArg },
  },
  async ({ project }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Prepare and review Agent Cutroom project ${project}. Run prepare_project, inspect review/review-pack.md and the contact sheet, then record observations before planning a cut.`,
        },
      },
    ],
  }),
);

server.registerPrompt(
  "package-for-social",
  {
    title: "Package For Social",
    description: "Guide an agent through candidate selection, captioning, verification, and social packaging.",
    argsSchema: {
      project: ProjectArg,
      platform: z.enum(["instagram", "tiktok", "youtube-shorts", "linkedin"]).default("instagram"),
    },
  },
  async ({ project, platform }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Package Agent Cutroom project ${project} for ${platform}. Run find_moments or content_package, review the candidate artifact, render the selected cut, run caption with burned ASS captions, verify the render, then run social_package.`,
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
