import type { EditPlan, EditSegment, Timeline } from "./schema.js";

function mergeRanges(
  ranges: Array<{ startMs: number; endMs: number }>,
): Array<{ startMs: number; endMs: number }> {
  const sorted = ranges
    .filter((range) => range.endMs > range.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range.startMs > last.endMs) {
      merged.push({ ...range });
      continue;
    }
    last.endMs = Math.max(last.endMs, range.endMs);
  }
  return merged;
}

export function createEditPlan({
  timeline,
  sourcePath,
  minSilenceMs,
  minKeepMs,
}: {
  timeline: Timeline;
  sourcePath: string;
  minSilenceMs: number;
  minKeepMs: number;
}): EditPlan {
  const durationMs = timeline.media?.durationMs ?? 0;
  const cutWindowIds = new Set(
    timeline.observations
      .filter((observation) => observation.editingUse === "cut")
      .map((observation) => observation.windowId),
  );
  const cutWindows = timeline.windows
    .filter((window) => cutWindowIds.has(window.id))
    .map((window) => ({ startMs: window.startMs, endMs: window.endMs }));
  const cutSilences = timeline.silences
    .filter((silence) => silence.durationMs >= minSilenceMs)
    .map((silence) => ({ startMs: silence.startMs, endMs: silence.endMs }));
  const excluded = mergeRanges([...cutSilences, ...cutWindows]);
  const segments: EditSegment[] = [];
  let cursor = 0;
  for (const range of excluded) {
    if (range.startMs - cursor >= minKeepMs) {
      segments.push({
        id: `keep-${String(segments.length + 1).padStart(3, "0")}`,
        sourceStartMs: cursor,
        sourceEndMs: range.startMs,
        reason: "kept range between cut ranges",
        sourceWindowIds: windowsForRange(timeline, cursor, range.startMs),
        evidence: evidenceForRange(timeline, cursor, range.startMs),
        confidence: 1,
        warnings: warningsForRange(timeline, cursor, range.startMs),
      });
    }
    cursor = Math.max(cursor, range.endMs);
  }
  if (durationMs - cursor >= minKeepMs) {
    segments.push({
      id: `keep-${String(segments.length + 1).padStart(3, "0")}`,
      sourceStartMs: cursor,
      sourceEndMs: durationMs,
      reason: "kept final range",
      sourceWindowIds: windowsForRange(timeline, cursor, durationMs),
      evidence: evidenceForRange(timeline, cursor, durationMs),
      confidence: 1,
      warnings: warningsForRange(timeline, cursor, durationMs),
    });
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    sourcePath,
    segments,
    notes: [
      `Removed silences >= ${minSilenceMs}ms and windows observed as cut.`,
      "Review edit-plan.json before final export; this is a deterministic rough cut.",
    ],
  };
}

function windowsForRange(
  timeline: Timeline,
  startMs: number,
  endMs: number,
): string[] {
  return timeline.windows
    .filter((window) => window.startMs < endMs && window.endMs > startMs)
    .map((window) => window.id);
}

function evidenceForRange(timeline: Timeline, startMs: number, endMs: number): string[] {
  const windowIds = windowsForRange(timeline, startMs, endMs);
  const observations = timeline.observations.filter((observation) =>
    windowIds.includes(observation.windowId),
  );
  const evidence = observations.map(
    (observation) =>
      `${observation.id}:${observation.windowId}:${observation.editingUse}:${observation.visualSummary}`,
  );
  if (timeline.transcriptSegments.some((segment) => segment.startMs < endMs && segment.endMs > startMs)) {
    evidence.push("timestamped transcript overlaps this range");
  }
  return evidence;
}

function warningsForRange(timeline: Timeline, startMs: number, endMs: number): string[] {
  const warnings: string[] = [];
  const windowIds = windowsForRange(timeline, startMs, endMs);
  const unreviewed = timeline.windows
    .filter((window) => windowIds.includes(window.id))
    .filter(
      (window) => !timeline.observations.some((observation) => observation.windowId === window.id),
    );
  if (unreviewed.length > 0) {
    warnings.push(`Includes unreviewed windows: ${unreviewed.map((window) => window.id).join(", ")}`);
  }
  return warnings;
}
