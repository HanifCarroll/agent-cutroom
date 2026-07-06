import {
  CUTROOM_VERSION,
  EditPlanSchema,
  ShortFormPacingPlanSchema,
  type EditPlan,
  type EditSegment,
  type ShortFormPacingCut,
  type ShortFormPacingPlan,
  type ShortFormPacingProtectedPause,
  type Timeline,
  type TranscriptWord,
} from "./schema.js";

export interface ShortFormPacingOptions {
  minPauseMs: number;
  keepPauseMs: number;
  leadInMs: number;
  tailOutMs: number;
  minCutMs: number;
  minSegmentMs: number;
  protectedQuestionPauseMs: number;
  protectedQuestionKeepPauseMs: number;
}

export const DEFAULT_SHORT_FORM_PACING_OPTIONS: ShortFormPacingOptions = {
  minPauseMs: 500,
  keepPauseMs: 160,
  leadInMs: 120,
  tailOutMs: 220,
  minCutMs: 350,
  minSegmentMs: 80,
  protectedQuestionPauseMs: 700,
  protectedQuestionKeepPauseMs: 360,
};

export interface CreateShortFormPacingOptions {
  timeline: Timeline;
  editPlan: EditPlan;
  sourceEditPlanPath: string;
  outputEditPlanPath: string;
  options?: Partial<ShortFormPacingOptions>;
}

export interface ShortFormPacingResult {
  editPlan: EditPlan;
  pacingPlan: ShortFormPacingPlan;
}

function normalizeOptions(options: Partial<ShortFormPacingOptions> | undefined): ShortFormPacingOptions {
  const merged = { ...DEFAULT_SHORT_FORM_PACING_OPTIONS, ...(options ?? {}) };
  return {
    minPauseMs: Math.max(0, Math.round(merged.minPauseMs)),
    keepPauseMs: Math.max(0, Math.round(merged.keepPauseMs)),
    leadInMs: Math.max(0, Math.round(merged.leadInMs)),
    tailOutMs: Math.max(0, Math.round(merged.tailOutMs)),
    minCutMs: Math.max(0, Math.round(merged.minCutMs)),
    minSegmentMs: Math.max(1, Math.round(merged.minSegmentMs)),
    protectedQuestionPauseMs: Math.max(0, Math.round(merged.protectedQuestionPauseMs)),
    protectedQuestionKeepPauseMs: Math.max(0, Math.round(merged.protectedQuestionKeepPauseMs)),
  };
}

function editPlanDuration(plan: EditPlan): number {
  return plan.segments.reduce(
    (total, segment) => total + Math.max(0, segment.sourceEndMs - segment.sourceStartMs),
    0,
  );
}

function wordsFromTimeline(timeline: Timeline): TranscriptWord[] {
  return timeline.transcriptSegments
    .flatMap((segment) => segment.words)
    .filter((word) => word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function wordsForSegment(words: TranscriptWord[], segment: EditSegment): TranscriptWord[] {
  return words.filter(
    (word) => word.endMs > segment.sourceStartMs && word.startMs < segment.sourceEndMs,
  );
}

function pushKeepSegment({
  output,
  source,
  sourceStartMs,
  sourceEndMs,
  index,
}: {
  output: EditSegment[];
  source: EditSegment;
  sourceStartMs: number;
  sourceEndMs: number;
  index: number;
}): void {
  if (sourceEndMs <= sourceStartMs) return;
  output.push({
    ...source,
    id: `short-${String(index).padStart(3, "0")}`,
    sourceStartMs,
    sourceEndMs,
    reason: `Short-form pacing from ${source.id}: ${source.reason}`,
    evidence: [...source.evidence, `source segment ${source.id}`],
  });
}

function addCut(cuts: ShortFormPacingCut[], cut: Omit<ShortFormPacingCut, "id">): void {
  if (cut.sourceEndMs <= cut.sourceStartMs) return;
  cuts.push({
    id: `pacing-cut-${String(cuts.length + 1).padStart(4, "0")}`,
    ...cut,
  });
}

function addProtectedPause(
  protectedPauses: ShortFormPacingProtectedPause[],
  pause: Omit<ShortFormPacingProtectedPause, "id">,
): void {
  if (pause.sourceEndMs <= pause.sourceStartMs) return;
  protectedPauses.push({
    id: `protected-pause-${String(protectedPauses.length + 1).padStart(4, "0")}`,
    ...pause,
  });
}

const QUESTION_OPENERS = new Set(["who", "what", "why", "how", "where", "when", "which"]);
const QUESTION_CONNECTORS = new Set(["and", "or"]);

function normalizedWord(word: TranscriptWord): string {
  return word.text.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function isQuestionOpener(word: TranscriptWord | undefined): boolean {
  return Boolean(word && QUESTION_OPENERS.has(normalizedWord(word)));
}

function endsQuestion(word: TranscriptWord | undefined): boolean {
  return Boolean(word && /\?\s*$/.test(word.text));
}

function isQuestionConnector(word: TranscriptWord | undefined): boolean {
  return Boolean(word && QUESTION_CONNECTORS.has(normalizedWord(word)));
}

function isProtectedQuestionGap({
  previous,
  next,
  following,
}: {
  previous: TranscriptWord;
  next: TranscriptWord;
  following?: TranscriptWord;
}): boolean {
  if (isQuestionOpener(next)) return true;
  if (endsQuestion(previous)) return true;
  if (isQuestionConnector(next) && isQuestionOpener(following)) return true;
  return false;
}

export function createShortFormPacing(options: CreateShortFormPacingOptions): ShortFormPacingResult {
  const settings = normalizeOptions(options.options);
  const words = wordsFromTimeline(options.timeline);
  const warnings: string[] = [];
  const cuts: ShortFormPacingCut[] = [];
  const protectedPauses: ShortFormPacingProtectedPause[] = [];
  const segments: EditSegment[] = [];
  let segmentIndex = 1;

  if (words.length === 0) {
    warnings.push("No transcript word timings were found. Short-form pacing left the edit plan unchanged.");
  }

  for (const segment of options.editPlan.segments) {
    const segmentWords = wordsForSegment(words, segment);
    if (segmentWords.length === 0) {
      warnings.push(`No transcript words overlap ${segment.id}; preserved the segment unchanged.`);
      pushKeepSegment({
        output: segments,
        source: segment,
        sourceStartMs: segment.sourceStartMs,
        sourceEndMs: segment.sourceEndMs,
        index: segmentIndex++,
      });
      continue;
    }

    const firstWord = segmentWords[0]!;
    const lastWord = segmentWords[segmentWords.length - 1]!;
    const clipStartMs = Math.max(segment.sourceStartMs, firstWord.startMs - settings.leadInMs);
    const clipEndMs = Math.min(segment.sourceEndMs, lastWord.endMs + settings.tailOutMs);
    let cursorMs = clipStartMs;

    if (clipStartMs > segment.sourceStartMs) {
      addCut(cuts, {
        sourceSegmentId: segment.id,
        sourceStartMs: segment.sourceStartMs,
        sourceEndMs: clipStartMs,
        removedMs: clipStartMs - segment.sourceStartMs,
        keptPauseMs: Math.min(settings.leadInMs, clipStartMs - segment.sourceStartMs),
        classification: "dead-air",
        reason: "trimmed leading non-speech padding",
        precedingWord: null,
        followingWord: firstWord.text,
      });
    }

    for (let index = 1; index < segmentWords.length; index += 1) {
      const previous = segmentWords[index - 1]!;
      const next = segmentWords[index]!;
      const following = segmentWords[index + 1];
      const gapStartMs = Math.max(previous.endMs, clipStartMs);
      const gapEndMs = Math.min(next.startMs, clipEndMs);
      const gapMs = gapEndMs - gapStartMs;
      if (gapMs < settings.minPauseMs) continue;

      const protectedQuestionGap = isProtectedQuestionGap({ previous, next, following });
      if (protectedQuestionGap && gapMs <= settings.protectedQuestionPauseMs) {
        addProtectedPause(protectedPauses, {
          sourceSegmentId: segment.id,
          sourceStartMs: gapStartMs,
          sourceEndMs: gapEndMs,
          durationMs: gapMs,
          reason: "preserved rhetorical question-chain pause",
          precedingWord: previous.text,
          followingWord: next.text,
        });
        continue;
      }

      const keepPauseMs = protectedQuestionGap
        ? Math.max(settings.keepPauseMs, settings.protectedQuestionKeepPauseMs)
        : settings.keepPauseMs;
      const keepBeforeMs = Math.floor(keepPauseMs / 2);
      const keepAfterMs = keepPauseMs - keepBeforeMs;
      const cutStartMs = Math.min(gapEndMs, gapStartMs + keepBeforeMs);
      const cutEndMs = Math.max(cutStartMs, gapEndMs - keepAfterMs);
      const removedMs = cutEndMs - cutStartMs;
      if (removedMs < settings.minCutMs) continue;

      if (cutStartMs - cursorMs >= settings.minSegmentMs) {
        pushKeepSegment({
          output: segments,
          source: segment,
          sourceStartMs: cursorMs,
          sourceEndMs: cutStartMs,
          index: segmentIndex++,
        });
      }
      addCut(cuts, {
        sourceSegmentId: segment.id,
        sourceStartMs: cutStartMs,
        sourceEndMs: cutEndMs,
        removedMs,
        keptPauseMs: gapMs - removedMs,
        classification: protectedQuestionGap ? "semantic-beat" : "dead-air",
        reason: protectedQuestionGap
          ? "tightened long rhetorical question-chain pause"
          : "tightened transcript-word pause",
        precedingWord: previous.text,
        followingWord: next.text,
      });
      cursorMs = cutEndMs;
    }

    if (clipEndMs - cursorMs >= settings.minSegmentMs) {
      pushKeepSegment({
        output: segments,
        source: segment,
        sourceStartMs: cursorMs,
        sourceEndMs: clipEndMs,
        index: segmentIndex++,
      });
    }

    if (segment.sourceEndMs > clipEndMs) {
      addCut(cuts, {
        sourceSegmentId: segment.id,
        sourceStartMs: clipEndMs,
        sourceEndMs: segment.sourceEndMs,
        removedMs: segment.sourceEndMs - clipEndMs,
        keptPauseMs: Math.min(settings.tailOutMs, segment.sourceEndMs - clipEndMs),
        classification: "dead-air",
        reason: "trimmed trailing non-speech padding",
        precedingWord: lastWord.text,
        followingWord: null,
      });
    }
  }

  const editPlan = EditPlanSchema.parse({
    ...options.editPlan,
    createdAt: new Date().toISOString(),
    segments,
    notes: [
      ...options.editPlan.notes,
      `Applied short-form pacing: removed ${cuts.reduce((total, cut) => total + cut.removedMs, 0)}ms across ${cuts.length} cuts.`,
    ],
  });
  const beforeDurationMs = editPlanDuration(options.editPlan);
  const afterDurationMs = editPlanDuration(editPlan);

  const pacingPlan = ShortFormPacingPlanSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    sourceEditPlanPath: options.sourceEditPlanPath,
    outputEditPlanPath: options.outputEditPlanPath,
    beforeDurationMs,
    afterDurationMs,
    removedMs: Math.max(0, beforeDurationMs - afterDurationMs),
    options: settings,
    cuts,
    protectedPauses,
    warnings,
  });

  return { editPlan, pacingPlan };
}
