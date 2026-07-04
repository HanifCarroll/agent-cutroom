import type { SilenceRange, Timeline, TranscriptSegment } from "./schema.js";

function addTimestamp(
  timestamps: Set<number>,
  atMs: number,
  durationMs: number,
): void {
  if (durationMs <= 0) return;
  timestamps.add(Math.min(Math.max(0, Math.round(atMs)), Math.max(0, durationMs - 1)));
}

function isNearExisting(
  timestamps: Set<number>,
  atMs: number,
  minGapMs: number,
): boolean {
  for (const existing of timestamps) {
    if (Math.abs(existing - atMs) < minGapMs) return true;
  }
  return false;
}

function addExtraTimestamp(
  timestamps: Set<number>,
  atMs: number,
  durationMs: number,
  maxFrames: number,
  minGapMs: number,
): void {
  if (timestamps.size >= maxFrames) return;
  const normalized = Math.min(
    Math.max(0, Math.round(atMs)),
    Math.max(0, durationMs - 1),
  );
  if (isNearExisting(timestamps, normalized, minGapMs)) return;
  timestamps.add(normalized);
}

function evenlySampleDuration(durationMs: number, maxFrames: number): number[] {
  if (durationMs <= 0 || maxFrames <= 0) return [];
  if (maxFrames === 1) return [0];
  return Array.from({ length: maxFrames }, (_, index) =>
    Math.round(((durationMs - 1) * index) / (maxFrames - 1)),
  );
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
  if (durationMs <= 0 || maxFrames <= 0) return [];
  const timestamps = new Set<number>();

  const coverage: number[] = [];
  for (let atMs = intervalMs; atMs < durationMs; atMs += intervalMs) {
    coverage.push(atMs);
  }
  coverage.unshift(0);
  if (durationMs > intervalMs) coverage.push(durationMs - 1);

  const uniqueCoverage = [...new Set(coverage.map((ms) => Math.round(ms)))].sort(
    (a, b) => a - b,
  );
  if (uniqueCoverage.length > maxFrames) {
    return evenlySampleDuration(durationMs, maxFrames);
  }

  for (const atMs of uniqueCoverage) {
    addTimestamp(timestamps, atMs, durationMs);
  }

  const minGapMs = Math.max(750, Math.round(intervalMs / 3));
  for (const segment of timeline.transcriptSegments.slice(0, maxFrames)) {
    addTranscriptFrames(timestamps, segment, durationMs, maxFrames, minGapMs);
  }

  for (const silence of timeline.silences.slice(0, maxFrames)) {
    addSilenceBoundaryFrames(timestamps, silence, durationMs, maxFrames, minGapMs);
  }

  return [...timestamps].sort((a, b) => a - b);
}

function addTranscriptFrames(
  timestamps: Set<number>,
  segment: TranscriptSegment,
  durationMs: number,
  maxFrames: number,
  minGapMs: number,
): void {
  addExtraTimestamp(timestamps, segment.startMs, durationMs, maxFrames, minGapMs);
  addExtraTimestamp(
    timestamps,
    Math.round((segment.startMs + segment.endMs) / 2),
    durationMs,
    maxFrames,
    minGapMs,
  );
}

function addSilenceBoundaryFrames(
  timestamps: Set<number>,
  silence: SilenceRange,
  durationMs: number,
  maxFrames: number,
  minGapMs: number,
): void {
  addExtraTimestamp(
    timestamps,
    silence.startMs - 250,
    durationMs,
    maxFrames,
    minGapMs,
  );
  addExtraTimestamp(
    timestamps,
    silence.endMs + 250,
    durationMs,
    maxFrames,
    minGapMs,
  );
}
