import type { SilenceRange, Timeline, TranscriptSegment } from "./schema.js";

function addTimestamp(
  timestamps: Set<number>,
  atMs: number,
  durationMs: number,
): void {
  if (durationMs <= 0) return;
  timestamps.add(Math.min(Math.max(0, Math.round(atMs)), Math.max(0, durationMs - 1)));
}

export function chooseFrameTimestamps({
  timeline,
  intervalMs,
  maxFrames,
}: {
  timeline: Timeline;
  intervalMs: number;
  maxFrames: number;
}): number[] {
  const durationMs = timeline.media?.durationMs ?? 0;
  const timestamps = new Set<number>();
  addTimestamp(timestamps, 0, durationMs);

  for (let atMs = intervalMs; atMs < durationMs; atMs += intervalMs) {
    addTimestamp(timestamps, atMs, durationMs);
  }

  for (const segment of timeline.transcriptSegments.slice(0, maxFrames)) {
    addTranscriptFrames(timestamps, segment, durationMs);
  }

  for (const silence of timeline.silences.slice(0, maxFrames)) {
    addSilenceBoundaryFrames(timestamps, silence, durationMs);
  }

  return [...timestamps].sort((a, b) => a - b).slice(0, maxFrames);
}

function addTranscriptFrames(
  timestamps: Set<number>,
  segment: TranscriptSegment,
  durationMs: number,
): void {
  addTimestamp(timestamps, segment.startMs, durationMs);
  addTimestamp(timestamps, Math.round((segment.startMs + segment.endMs) / 2), durationMs);
}

function addSilenceBoundaryFrames(
  timestamps: Set<number>,
  silence: SilenceRange,
  durationMs: number,
): void {
  addTimestamp(timestamps, silence.startMs - 250, durationMs);
  addTimestamp(timestamps, silence.endMs + 250, durationMs);
}
