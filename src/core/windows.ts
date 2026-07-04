import type {
  Frame,
  SilenceRange,
  Timeline,
  TimelineWindow,
  TranscriptSegment,
} from "./schema.js";
import { formatTimestamp } from "./time.js";

function overlaps(
  item: { startMs: number; endMs: number },
  startMs: number,
  endMs: number,
): boolean {
  return item.startMs < endMs && item.endMs > startMs;
}

function framesInside(frames: Frame[], startMs: number, endMs: number): string[] {
  return frames
    .filter((frame) => frame.atMs >= startMs && frame.atMs < endMs)
    .map((frame) => frame.id);
}

function transcriptText(
  segments: TranscriptSegment[],
  startMs: number,
  endMs: number,
): string {
  return segments
    .filter((segment) => overlaps(segment, startMs, endMs))
    .map((segment) => segment.text)
    .join(" ")
    .trim();
}

function silenceIds(
  silences: SilenceRange[],
  startMs: number,
  endMs: number,
): string[] {
  return silences
    .filter((silence) => overlaps(silence, startMs, endMs))
    .map((silence) => silence.id);
}

export function buildReviewWindows(
  timeline: Timeline,
  windowMs: number,
): TimelineWindow[] {
  const durationMs = timeline.media?.durationMs ?? 0;
  if (durationMs <= 0) return [];
  const windows: TimelineWindow[] = [];
  for (let startMs = 0; startMs < durationMs; startMs += windowMs) {
    const endMs = Math.min(durationMs, startMs + windowMs);
    windows.push({
      id: `window-${String(windows.length + 1).padStart(3, "0")}`,
      startMs,
      endMs,
      timestamp: `${formatTimestamp(startMs)}-${formatTimestamp(endMs)}`,
      transcriptText: transcriptText(timeline.transcriptSegments, startMs, endMs),
      frameIds: framesInside(timeline.frames, startMs, endMs),
      silenceIds: silenceIds(timeline.silences, startMs, endMs),
    });
  }
  return windows;
}
