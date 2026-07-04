import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Frame, Timeline } from "./schema.js";
import { ensureDir } from "./files.js";
import { formatTimestamp } from "./time.js";

function frameById(timeline: Timeline): Map<string, Frame> {
  return new Map(timeline.frames.map((frame) => [frame.id, frame]));
}

export async function writeReviewPack({
  projectDir,
  timeline,
  contactSheetPath,
}: {
  projectDir: string;
  timeline: Timeline;
  contactSheetPath?: string | null;
}): Promise<string> {
  await ensureDir(resolve(projectDir, "review"));
  const frames = frameById(timeline);
  const lines: string[] = [
    "# Agent Cutroom Review Pack",
    "",
    "Use this file as the agent-facing review surface. Inspect the referenced frames/contact sheet, then write observations back with `agent-cutroom observe`.",
    "",
  ];

  if (contactSheetPath) {
    lines.push("## Contact Sheet", "", `![Contact sheet](../${contactSheetPath})`, "");
  }

  lines.push("## Windows", "");
  for (const window of timeline.windows) {
    lines.push(`### ${window.id} (${window.timestamp})`, "");
    lines.push(`- Range: ${formatTimestamp(window.startMs)} to ${formatTimestamp(window.endMs)}`);
    lines.push(`- Silence IDs: ${window.silenceIds.length ? window.silenceIds.join(", ") : "none"}`);
    lines.push(`- Transcript: ${window.transcriptText || "(none)"}`);
    lines.push("- Frames:");
    if (window.frameIds.length === 0) {
      lines.push("  - none");
    } else {
      for (const frameId of window.frameIds) {
        const frame = frames.get(frameId);
        if (!frame) continue;
        lines.push(`  - ${frame.id} at ${frame.timestamp}: ../${frame.path}`);
      }
    }
    lines.push("");
    lines.push("Observation command:");
    lines.push("");
    lines.push("```sh");
    lines.push(
      `agent-cutroom observe . --window ${window.id} --summary "..." --editing-use keep --broll none --visible-text "" --note "..."`,
    );
    lines.push("```");
    lines.push("");
  }

  const output = join("review", "review-pack.md");
  await writeFile(resolve(projectDir, output), `${lines.join("\n")}\n`);
  return output;
}
