import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditPlan, Timeline } from "./schema.js";
import { ensureDir } from "./files.js";
import { formatTimestamp } from "./time.js";

export async function writeHyperframesBrief({
  projectDir,
  timeline,
  editPlan,
}: {
  projectDir: string;
  timeline: Timeline;
  editPlan: EditPlan;
}): Promise<string> {
  const dir = resolve(projectDir, "hyperframes");
  await ensureDir(dir);
  const observations = new Map(
    timeline.observations.map((observation) => [observation.windowId, observation]),
  );
  const lines: string[] = [
    "# HyperFrames Brief",
    "",
    "This brief is generated from Agent Cutroom timeline data. Use it to author a polished HyperFrames composition after the rough cut is approved.",
    "",
    "## Source",
    "",
    `- Source video: \`${editPlan.sourcePath}\``,
    `- Rough-cut segments: ${editPlan.segments.length}`,
    "",
    "## Segment Notes",
    "",
  ];

  for (const segment of editPlan.segments) {
    lines.push(
      `### ${segment.id}: ${formatTimestamp(segment.sourceStartMs)}-${formatTimestamp(segment.sourceEndMs)}`,
    );
    lines.push("");
    lines.push(`- Reason: ${segment.reason}`);
    for (const windowId of segment.sourceWindowIds) {
      const observation = observations.get(windowId);
      if (!observation) continue;
      lines.push(
        `- ${windowId}: ${observation.visualSummary} | editing=${observation.editingUse} | broll=${observation.brollNeed}`,
      );
    }
    lines.push("");
  }

  lines.push("## Suggested HyperFrames Work");
  lines.push("");
  lines.push("- Add title cards, lower thirds, pull quotes, captions, and B-roll cards where observations request them.");
  lines.push("- Keep the rough-cut timing as source truth unless the edit plan is updated.");
  lines.push("");

  const output = "hyperframes/brief.md";
  await writeFile(resolve(projectDir, output), `${lines.join("\n")}\n`);
  return output;
}
