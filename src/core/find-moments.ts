import {
  CUTROOM_VERSION,
  HighlightCandidatesSchema,
  type HighlightCandidate,
  type HighlightCandidates,
  type Timeline,
} from "./schema.js";
import { formatTimestamp } from "./time.js";

export interface FindMomentsOptions {
  timeline: Timeline;
  objective: string;
  targetDurationMs: number;
  maxCandidates: number;
}

function overlapMs(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
): number {
  return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
}

function transcriptForRange(timeline: Timeline, startMs: number, endMs: number): string {
  return timeline.transcriptSegments
    .filter((segment) => segment.startMs < endMs && segment.endMs > startMs)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateForWindow(
  timeline: Timeline,
  window: Timeline["windows"][number],
  index: number,
  targetDurationMs: number,
): HighlightCandidate {
  const observations = timeline.observations.filter((observation) => observation.windowId === window.id);
  const keepObservation = observations.find((observation) =>
    ["keep", "broll", "tighten"].includes(observation.editingUse),
  );
  const cutObservation = observations.find((observation) => observation.editingUse === "cut");
  const transcriptText = transcriptForRange(timeline, window.startMs, window.endMs);
  const durationMs = window.endMs - window.startMs;
  const evidence: string[] = [];
  const warnings: string[] = [];

  if (keepObservation) {
    evidence.push(`${keepObservation.id}: agent marked ${keepObservation.editingUse}`);
  }
  if (transcriptText) evidence.push("timestamped transcript overlaps this window");
  if (window.frameIds.length > 0) evidence.push(`review frames: ${window.frameIds.join(", ")}`);
  if (window.silenceIds.length > 0) evidence.push(`contains silence markers: ${window.silenceIds.join(", ")}`);
  if (cutObservation) warnings.push(`${cutObservation.id}: agent marked this window cut`);
  if (!transcriptText) warnings.push("No transcript text overlaps this window.");
  if (durationMs > targetDurationMs * 1.7) warnings.push("Window is much longer than target duration.");

  const targetFit = 1 - Math.min(1, Math.abs(durationMs - targetDurationMs) / Math.max(1, targetDurationMs));
  const observationScore = keepObservation ? 0.35 : observations.length > 0 ? 0.2 : 0;
  const transcriptScore = transcriptText ? 0.25 : 0;
  const frameScore = window.frameIds.length > 0 ? 0.15 : 0;
  const penalty = cutObservation ? 0.5 : 0;
  const score = Math.max(0, Math.min(1, 0.25 * targetFit + observationScore + transcriptScore + frameScore - penalty));

  return {
    id: `moment-${String(index + 1).padStart(3, "0")}`,
    sourceStartMs: window.startMs,
    sourceEndMs: window.endMs,
    durationMs,
    transcriptText,
    reason:
      keepObservation?.visualSummary ??
      `Window ${window.id} has ${transcriptText ? "timestamped transcript" : "review material"} from ${formatTimestamp(window.startMs)} to ${formatTimestamp(window.endMs)}.`,
    evidence,
    warnings,
    score,
    sourceWindowIds: [window.id],
    sourceFrameIds: window.frameIds,
    sourceObservationIds: observations.map((observation) => observation.id),
  };
}

function candidatesFromSegments(
  timeline: Timeline,
  offset: number,
  targetDurationMs: number,
): HighlightCandidate[] {
  return timeline.transcriptSegments.map((segment, index) => {
    const overlappingWindows = timeline.windows.filter((window) => overlapMs(window, segment) > 0);
    const overlappingFrames = timeline.frames
      .filter((frame) => frame.atMs >= segment.startMs && frame.atMs <= segment.endMs)
      .map((frame) => frame.id);
    const durationMs = segment.endMs - segment.startMs;
    const targetFit = 1 - Math.min(1, Math.abs(durationMs - targetDurationMs) / Math.max(1, targetDurationMs));
    return {
      id: `moment-${String(offset + index + 1).padStart(3, "0")}`,
      sourceStartMs: segment.startMs,
      sourceEndMs: segment.endMs,
      durationMs,
      transcriptText: segment.text,
      reason: `Transcript segment ${segment.id} is a self-contained timestamped span.`,
      evidence: [`transcript segment ${segment.id}`],
      warnings: durationMs < 2500 ? ["Segment is short; review neighboring context."] : [],
      score: Math.max(0, Math.min(1, 0.55 + 0.25 * targetFit + (overlappingFrames.length > 0 ? 0.1 : 0))),
      sourceWindowIds: overlappingWindows.map((window) => window.id),
      sourceFrameIds: overlappingFrames,
      sourceObservationIds: [],
    };
  });
}

export function findMoments(options: FindMomentsOptions): HighlightCandidates {
  const warnings: string[] = [];
  const windowCandidates = options.timeline.windows.map((window, index) =>
    candidateForWindow(options.timeline, window, index, options.targetDurationMs),
  );
  const segmentCandidates =
    windowCandidates.length === 0
      ? candidatesFromSegments(options.timeline, windowCandidates.length, options.targetDurationMs)
      : [];
  if (windowCandidates.length === 0 && segmentCandidates.length === 0) {
    warnings.push("No review windows or transcript segments are available. Run prepare first.");
  }
  const candidates = [...windowCandidates, ...segmentCandidates]
    .sort((a, b) => b.score - a.score || a.sourceStartMs - b.sourceStartMs)
    .slice(0, options.maxCandidates)
    .map((candidate, index) => ({ ...candidate, id: `moment-${String(index + 1).padStart(3, "0")}` }));

  return HighlightCandidatesSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    objective: options.objective,
    targetDurationMs: options.targetDurationMs,
    candidates,
    warnings,
  });
}
