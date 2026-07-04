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
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ video, out, transcript, title }) => {
    const args = ["init", video, "--out", out];
    if (transcript) args.push("--transcript", transcript);
    if (title) args.push("--title", title);
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
  "social_package",
  {
    title: "Create Social Package",
    description:
      "Use `social_package` after a render exists to write a platform style pack, cover frame, post copy, and plans/social-package.json.",
    inputSchema: {
      project: ProjectArg,
      platform: z.enum(["instagram", "tiktok", "youtube-shorts", "linkedin"]).default("instagram"),
      render: z.string().optional(),
      candidate: z.string().optional(),
      title: z.string().optional(),
    },
    outputSchema: { status: z.string(), text: z.string(), resources: z.array(z.object({ uri: z.string(), name: z.string() })) },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  async ({ project, platform, render, candidate, title }) => {
    const args = ["social-package", project, "--platform", platform];
    if (render) args.push("--render", render);
    if (candidate) args.push("--candidate", candidate);
    if (title) args.push("--title", title);
    return toolResult(await callCli(args), [
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
          text: `Package Agent Cutroom project ${project} for ${platform}. Run find_moments, review the candidate artifact, render the selected cut, run caption with burned ASS captions, verify the render, then run social_package.`,
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
