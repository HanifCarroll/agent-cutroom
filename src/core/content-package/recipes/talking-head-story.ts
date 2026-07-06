import {
  CUTROOM_VERSION,
  type EditPlan,
  type EditSegment,
  type Timeline,
  type TranscriptSegment,
} from "../../schema.js";
import { formatTimestamp } from "../../time.js";
import {
  StoryCandidatesSchema,
  StoryCandidateSchema,
  ClipSlateSchema,
  type ApprovedClipPlan,
  type ClipSlate,
  type ContentProfile,
  type ResolvedContentPackageOptions,
  type StoryCandidate,
  type StoryCandidates,
  type SuggestedArtifact,
} from "../schema.js";

interface ThemeScore {
  theme: ContentProfile["themes"][number];
  score: number;
  matches: string[];
}

interface CandidateScore {
  score: number;
  theme: ContentProfile["themes"][number];
  themeScore: number;
  evidence: string[];
  warnings: string[];
}

interface PersonalTailTrim {
  endMs: number;
  pattern: string;
  sentenceEndText: string;
}

export const TALKING_HEAD_STORY_RECIPE = {
  id: "talking-head-story",
  version: 1,
  label: "Talking-Head Story Selector",
} as const;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanTranscriptText(text: string, profile: ContentProfile): string {
  return profile.transcriptReplacements.reduce((current, replacement) => {
    return current.replace(new RegExp(replacement.match, replacement.flags), replacement.replacement);
  }, compact(text));
}

function includesPhrase(text: string, phrase: string): boolean {
  return text.includes(phrase);
}

function phraseCount(text: string, phrases: string[]): number {
  return phrases.reduce((total, phrase) => {
    let count = 0;
    let index = text.indexOf(phrase);
    while (index !== -1) {
      count += 1;
      index = text.indexOf(phrase, index + phrase.length);
    }
    return total + count;
  }, 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sentenceSplit(text: string): string[] {
  return compact(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstUsefulSentence(text: string): string {
  const sentences = sentenceSplit(text);
  return sentences.find((sentence) => wordCount(sentence) >= 6) ?? sentences[0] ?? compact(text);
}

function shortText(text: string, maxWords: number): string {
  const words = compact(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function titleCase(raw: string): string {
  const small = new Set(["a", "an", "and", "as", "for", "in", "of", "on", "or", "the", "to", "with"]);
  return raw
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function bestTheme(text: string, profile: ContentProfile): ThemeScore {
  const lower = text.toLowerCase();
  const ranked = profile.themes
    .map((theme) => {
      const matches = theme.keywords.filter((keyword) => includesPhrase(lower, keyword));
      return {
        theme,
        matches,
        score: Math.min(1, matches.length / 5),
      };
    })
    .sort((a, b) => b.score - a.score || b.matches.length - a.matches.length);
  return ranked[0] ?? { theme: profile.themes[0], score: 0, matches: [] };
}

function hookScore(text: string, profile: ContentProfile): number {
  const lower = text.toLowerCase();
  const opening = lower.slice(0, 420);
  const firstHalf = lower.slice(0, Math.max(420, Math.floor(lower.length / 2)));
  const openingHits = profile.hookPatterns.filter((pattern) => includesPhrase(opening, pattern)).length;
  const totalHits = profile.hookPatterns.filter((pattern) => includesPhrase(firstHalf, pattern)).length;
  return Math.min(1, openingHits * 0.4 + totalHits * 0.18);
}

function payoffScore(text: string, profile: ContentProfile): number {
  const lower = text.toLowerCase();
  return Math.min(1, profile.payoffSignals.filter((signal) => includesPhrase(lower, signal)).length / 3);
}

function audienceValueScore(text: string, profile: ContentProfile): number {
  const lower = text.toLowerCase();
  return Math.min(1, profile.audienceValueSignals.filter((signal) => includesPhrase(lower, signal)).length / 3);
}

function personalDetailTailPenalty(text: string, profile: ContentProfile): number {
  if (profile.personalDetailPatterns.length === 0) return 0;
  const sentences = sentenceSplit(text);
  const tail = (sentences.length > 1 ? sentences.slice(Math.floor(sentences.length * 0.55)) : sentences).join(" ").toLowerCase();
  const hits = profile.personalDetailPatterns.filter((pattern) => includesPhrase(tail, pattern)).length;
  return Math.min(0.3, hits * 0.08);
}

function durationFit(durationMs: number, targetMs: number, minMs: number, maxMs: number): number {
  if (durationMs < minMs || durationMs > maxMs) return 0;
  return 1 - Math.min(1, Math.abs(durationMs - targetMs) / Math.max(1, targetMs));
}

function fillerPenalty(text: string, profile: ContentProfile): number {
  const words = Math.max(1, wordCount(text));
  const count = phraseCount(text.toLowerCase(), profile.fillerPatterns);
  return Math.min(0.22, (count / words) * 3.5);
}

function sourceWindowIds(timeline: Timeline, startMs: number, endMs: number): string[] {
  return timeline.windows
    .filter((window) => window.startMs < endMs && window.endMs > startMs)
    .map((window) => window.id);
}

function sourceFrameIds(timeline: Timeline, startMs: number, endMs: number): string[] {
  return timeline.frames
    .filter((frame) => frame.atMs >= startMs && frame.atMs <= endMs)
    .map((frame) => frame.id);
}

function sourceObservationIds(timeline: Timeline, windowIds: string[]): string[] {
  const windows = new Set(windowIds);
  return timeline.observations
    .filter((observation) => windows.has(observation.windowId))
    .map((observation) => observation.id);
}

function hasWordTimings(segments: TranscriptSegment[]): boolean {
  return segments.some((segment) => segment.words.length > 0);
}

function suggestedArtifacts(text: string, score: number, themeId: string, profile: ContentProfile): SuggestedArtifact[] {
  const lower = text.toLowerCase();
  const artifacts = new Set<SuggestedArtifact>();
  if (score >= 0.62) artifacts.add("clip");
  if (themeId === "raw-thinking-to-content" || themeId === "public-building-proof") artifacts.add("writing");
  if (themeId === "codex-operating-system" || themeId === "effectiveness-and-task-graph") {
    artifacts.add("atomic-note");
  }
  if (profile.taskPatterns.some((pattern) => includesPhrase(lower, pattern))) artifacts.add("task");
  if (artifacts.size === 0) artifacts.add(score >= 0.48 ? "writing" : "ignore");
  return [...artifacts];
}

function candidateTitle(theme: ContentProfile["themes"][number], text: string, profile: ContentProfile): string {
  const lower = text.toLowerCase();
  const rule = profile.titleRules.find((item) =>
    item.allPhrases.every((phrase) => includesPhrase(lower, phrase)),
  );
  if (rule) return rule.title;
  const hook = firstUsefulSentence(text);
  if (hook) return titleCase(hook);
  return theme.label;
}

function signalPoint(text: string, theme: ContentProfile["themes"][number], profile: ContentProfile): string {
  const sentences = sentenceSplit(text);
  return (
    sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return profile.pointSignals.some((pattern) => includesPhrase(lower, pattern));
    }) ??
    sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return theme.keywords.some((keyword) => includesPhrase(lower, keyword));
    }) ??
    firstUsefulSentence(text)
  );
}

function exactUseCaseBoost(text: string, profile: ContentProfile): number {
  const lower = text.toLowerCase();
  return profile.exactBoosts.reduce((total, rule) => {
    if (rule.allPhrases.every((phrase) => includesPhrase(lower, phrase))) return total + rule.boost;
    return total;
  }, 0);
}

function openingPenalty(text: string): number {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  let penalty = 0;
  if (/^(and|but|or|that|them|thing|well|with|to)\b/.test(lower)) penalty += 0.18;
  if (/^[a-z]/.test(trimmed)) penalty += 0.08;
  if (/^(well|anyways|anyway),?\s/i.test(trimmed)) penalty += 0.08;
  return Math.min(0.3, penalty);
}

function scoreCandidate({
  text,
  durationMs,
  targetDurationMs,
  minDurationMs,
  maxDurationMs,
  hasFrames,
  hasWindows,
  profile,
}: {
  text: string;
  durationMs: number;
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  hasFrames: boolean;
  hasWindows: boolean;
  profile: ContentProfile;
}): CandidateScore {
  const themeResult = bestTheme(text, profile);
  const duration = durationFit(durationMs, targetDurationMs, minDurationMs, maxDurationMs);
  const hook = hookScore(text, profile);
  const payoff = payoffScore(text, profile);
  const audienceValue = audienceValueScore(text, profile);
  const personalTail = personalDetailTailPenalty(text, profile);
  const filler = fillerPenalty(text, profile);
  const opening = openingPenalty(text);
  const frameScore = hasFrames ? 0.04 : 0;
  const windowScore = hasWindows ? 0.03 : 0;
  const baseScore = Math.max(
    0,
    0.31 * themeResult.score +
      0.18 * hook +
      0.2 * payoff +
      0.12 * audienceValue +
      0.19 * duration +
      frameScore +
      windowScore -
      filler -
      opening -
      personalTail,
  );
  const score = Math.min(1, baseScore * themeResult.theme.priority + exactUseCaseBoost(text, profile));
  const evidence = [
    `theme matches: ${themeResult.matches.length ? themeResult.matches.slice(0, 8).join(", ") : "none"}`,
    `duration fit: ${duration.toFixed(2)}`,
    `hook score: ${hook.toFixed(2)}`,
    `payoff score: ${payoff.toFixed(2)}`,
    `audience value score: ${audienceValue.toFixed(2)}`,
  ];
  if (opening > 0) evidence.push(`opening penalty: ${opening.toFixed(2)}`);
  if (personalTail > 0) evidence.push(`personal detail tail penalty: ${personalTail.toFixed(2)}`);
  const warnings: string[] = [];
  if (filler >= 0.14) warnings.push("High filler density; likely needs tightening before publishing.");
  if (durationMs > targetDurationMs * 1.35) warnings.push("Longer than target; clip should be tightened.");
  if (themeResult.score < 0.35) warnings.push(profile.weakThemeWarning);
  if (!hasWindows) warnings.push("No review windows overlap this span; run prepare for stronger evidence.");
  if (!hasFrames) warnings.push("No sampled frames overlap this span; inspect visuals before publishing.");
  if (opening >= 0.18) warnings.push("Opening looks mid-sentence; prefer a cleaner start before rendering.");
  if (personalTail >= 0.16) warnings.push("Tail shifts into personal process details after the listener-facing lesson lands.");
  return { score, theme: themeResult.theme, themeScore: themeResult.score, evidence, warnings };
}

function storyCandidateId(startMs: number, endMs: number): string {
  return `story-${String(startMs).padStart(9, "0")}-${String(endMs).padStart(9, "0")}`;
}

function sentenceEnds(text: string): boolean {
  return /[.!?]["')\]]*$/.test(text.trim());
}

function timelineWords(timeline: Timeline) {
  return timeline.transcriptSegments
    .flatMap((segment) => segment.words)
    .filter((word) => word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/^[^\w']+|[^\w']+$/g, "");
}

function patternTokens(pattern: string): string[] {
  return pattern.split(/\s+/).map(normalizeToken).filter(Boolean);
}

function wordsMatchPattern(words: ReturnType<typeof timelineWords>, startIndex: number, pattern: string): boolean {
  const tokens = patternTokens(pattern);
  if (tokens.length === 0 || startIndex + tokens.length > words.length) return false;
  return tokens.every((token, offset) => normalizeToken(words[startIndex + offset]?.text ?? "") === token);
}

function cleanLeadStartMs(timeline: Timeline, candidateStartMs: number, requestedStartMs: number): number {
  const words = timelineWords(timeline);
  const crossedWords = words.filter(
    (word) => word.endMs > requestedStartMs && word.endMs <= candidateStartMs,
  );
  let sentenceEnd = crossedWords.at(-1);
  while (sentenceEnd && !sentenceEnds(sentenceEnd.text)) {
    crossedWords.pop();
    sentenceEnd = crossedWords.at(-1);
  }
  if (sentenceEnd) return Math.max(requestedStartMs, sentenceEnd.endMs);
  if (crossedWords.length > 0) return candidateStartMs;
  return requestedStartMs;
}

function personalTailTrim(
  timeline: Timeline,
  candidate: StoryCandidate,
  profile: ContentProfile,
  minDurationMs: number,
): PersonalTailTrim | null {
  if (profile.personalDetailPatterns.length === 0) return null;
  const words = timelineWords(timeline).filter(
    (word) => word.startMs >= candidate.sourceStartMs && word.endMs <= candidate.sourceEndMs,
  );
  const minEndMs = candidate.sourceStartMs + minDurationMs;
  for (const [index, word] of words.entries()) {
    if (word.startMs < minEndMs) continue;
    const pattern = profile.personalDetailPatterns.find((item) => wordsMatchPattern(words, index, item));
    if (!pattern) continue;
    const sentenceEnd = [...words.slice(0, index)].reverse().find((item) => sentenceEnds(item.text));
    if (!sentenceEnd || sentenceEnd.endMs < minEndMs) continue;
    return {
      endMs: sentenceEnd.endMs,
      pattern,
      sentenceEndText: sentenceEnd.text,
    };
  }
  return null;
}

function platformFit(artifacts: SuggestedArtifact[]): string[] {
  const fit: string[] = [];
  if (artifacts.includes("clip")) fit.push("short-form video");
  if (artifacts.includes("writing")) fit.push("written post");
  if (artifacts.includes("atomic-note")) fit.push("vault knowledge");
  if (artifacts.includes("task")) fit.push("task follow-up");
  return fit;
}

function socialPostDraft(theme: string, point: string, profile: ContentProfile): string {
  return profile.socialDraftTemplates.find((template) => template.theme === theme)?.body ?? point;
}

function buildCandidate({
  timeline,
  segments,
  targetDurationMs,
  minDurationMs,
  maxDurationMs,
  profile,
}: {
  timeline: Timeline;
  segments: TranscriptSegment[];
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  profile: ContentProfile;
}): StoryCandidate {
  const startMs = segments[0]?.startMs ?? 0;
  const endMs = segments.at(-1)?.endMs ?? startMs;
  const text = cleanTranscriptText(segments.map((segment) => segment.text).join(" "), profile);
  const windows = sourceWindowIds(timeline, startMs, endMs);
  const frames = sourceFrameIds(timeline, startMs, endMs);
  const observations = sourceObservationIds(timeline, windows);
  const scored = scoreCandidate({
    text,
    durationMs: endMs - startMs,
    targetDurationMs,
    minDurationMs,
    maxDurationMs,
    hasFrames: frames.length > 0,
    hasWindows: windows.length > 0,
    profile,
  });
  const hook = firstUsefulSentence(text);
  const point = signalPoint(text, scored.theme, profile);
  const artifacts = suggestedArtifacts(text, scored.score, scored.theme.id, profile);
  const warnings = [...scored.warnings];
  if (!hasWordTimings(segments)) warnings.push("No word timings in this span; active-word captions cannot be produced.");
  const evidence = observations.length
    ? [...scored.evidence, `agent observations: ${observations.join(", ")}`]
    : scored.evidence;
  const candidate = {
    id: storyCandidateId(startMs, endMs),
    rank: 1,
    title: candidateTitle(scored.theme, text, profile),
    theme: scored.theme.id,
    themeLabel: scored.theme.label,
    audience: scored.theme.audience,
    sourceStartMs: startMs,
    sourceEndMs: endMs,
    durationMs: endMs - startMs,
    timestamp: `${formatTimestamp(startMs)}-${formatTimestamp(endMs)}`,
    timingStatus: "timestamped" as const,
    score: Number(scored.score.toFixed(3)),
    confidence: Number(Math.min(0.95, 0.45 + scored.score * 0.5).toFixed(3)),
    hook: shortText(hook, 26),
    claim: shortText(point, 34),
    turn: shortText(hook, 26),
    proof: shortText(text, 42),
    payoff: shortText(point, 34),
    platformFit: platformFit(artifacts),
    point: shortText(point, 34),
    whyUseful: scored.theme.whyUseful,
    suggestedArtifacts: artifacts,
    transcriptText: text,
    source: {
      segmentIds: segments.map((segment) => segment.id),
      windowIds: windows,
      frameIds: frames,
      observationIds: observations,
    },
    sourceSegmentIds: segments.map((segment) => segment.id),
    sourceWindowIds: windows,
    sourceFrameIds: frames,
    sourceObservationIds: observations,
    evidence,
    scoreReasons: evidence,
    warnings,
    socialPostDraft: socialPostDraft(scored.theme.id, point, profile),
  };
  return StoryCandidateSchema.parse(candidate);
}

function overlapRatio(a: StoryCandidate, b: StoryCandidate): number {
  const overlap = Math.max(0, Math.min(a.sourceEndMs, b.sourceEndMs) - Math.max(a.sourceStartMs, b.sourceStartMs));
  return overlap / Math.max(1, Math.min(a.durationMs, b.durationMs));
}

function rankedCandidate(candidate: StoryCandidate, index: number): StoryCandidate {
  return StoryCandidateSchema.parse({
    ...candidate,
    rank: index + 1,
  });
}

function selectCandidates(candidates: StoryCandidate[], maxCandidates: number): StoryCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.sourceStartMs - b.sourceStartMs);
  const selected: StoryCandidate[] = [];
  for (const candidate of sorted) {
    if (candidate.suggestedArtifacts.includes("ignore")) continue;
    if (selected.every((item) => overlapRatio(item, candidate) < 0.42)) {
      selected.push(candidate);
    }
    if (selected.length >= maxCandidates) break;
  }
  if (selected.length < Math.min(3, maxCandidates)) {
    for (const candidate of sorted) {
      if (!selected.some((item) => item.id === candidate.id)) selected.push(candidate);
      if (selected.length >= maxCandidates) break;
    }
  }
  return selected.slice(0, maxCandidates).map(rankedCandidate);
}

function generateCandidates(options: ResolvedContentPackageOptions): StoryCandidate[] {
  const segments = options.timeline.transcriptSegments
    .filter((segment) => compact(segment.text))
    .sort((a, b) => a.startMs - b.startMs);
  const raw: StoryCandidate[] = [];
  for (let start = 0; start < segments.length; start += 1) {
    const span: TranscriptSegment[] = [];
    for (let end = start; end < segments.length; end += 1) {
      span.push(segments[end]);
      const durationMs = (span.at(-1)?.endMs ?? 0) - (span[0]?.startMs ?? 0);
      if (durationMs > options.maxDurationMs) break;
      if (durationMs >= options.minDurationMs) {
        raw.push(
          buildCandidate({
            timeline: options.timeline,
            segments: [...span],
            targetDurationMs: options.targetDurationMs,
            minDurationMs: options.minDurationMs,
            maxDurationMs: options.maxDurationMs,
            profile: options.profile,
          }),
        );
      }
    }
  }
  return selectCandidates(raw, options.maxCandidates);
}

function selectedCandidate(candidates: StoryCandidate[], selectedId?: string | null): StoryCandidate | null {
  if (selectedId) {
    const selected = candidates.find((candidate) => candidate.id === selectedId);
    if (!selected) throw new Error(`Unknown story candidate id: ${selectedId}`);
    return selected;
  }
  return null;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function approvedCandidateIds(options: ResolvedContentPackageOptions): string[] {
  return uniqueIds([...(options.approvedCandidateIds ?? []), ...(options.selectedId ? [options.selectedId] : [])]);
}

function approvedCandidates(candidates: StoryCandidate[], ids: string[]): StoryCandidate[] {
  return ids.map((id) => {
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate) throw new Error(`Unknown story candidate id: ${id}`);
    return candidate;
  });
}

function clipPlanRelativePath(candidateId: string): string {
  if (!/^[\w.-]+$/.test(candidateId)) {
    throw new Error(`Unsafe story candidate id for clip plan path: ${candidateId}`);
  }
  return `plans/clips/${candidateId}/edit-plan.json`;
}

function createSelectedEditPlan(options: ResolvedContentPackageOptions, candidate: StoryCandidate, segmentId = "clip-001"): EditPlan {
  const sourceEnd = options.timeline.media?.durationMs ?? candidate.sourceEndMs;
  const requestedStartMs = Math.max(0, candidate.sourceStartMs - options.leadPaddingMs);
  const startMs = cleanLeadStartMs(options.timeline, candidate.sourceStartMs, requestedStartMs);
  const tailTrim = personalTailTrim(options.timeline, candidate, options.profile, options.minDurationMs);
  const selectedEndMs = tailTrim?.endMs ?? candidate.sourceEndMs;
  const tailPaddingMs = tailTrim ? 80 : options.tailPaddingMs;
  const endMs = Math.min(sourceEnd, selectedEndMs + tailPaddingMs);
  const segment: EditSegment = {
    id: segmentId,
    sourceStartMs: startMs,
    sourceEndMs: endMs,
    reason: `Selected by content-package ${options.recipe.id}/${options.profile.id}: ${candidate.title}`,
    sourceWindowIds: candidate.sourceWindowIds,
    evidence: [
      `story candidate ${candidate.id}`,
      `rank: ${candidate.rank}`,
      `theme: ${candidate.themeLabel}`,
      `score: ${candidate.score}`,
      ...candidate.evidence,
      ...(tailTrim
        ? [
            `trimmed personal-process tail before "${tailTrim.pattern}"`,
            `listener-facing lesson ends at ${formatTimestamp(tailTrim.endMs)} after "${tailTrim.sentenceEndText}"`,
          ]
        : []),
    ],
    confidence: candidate.confidence,
    warnings: candidate.warnings,
  };
  return {
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    sourcePath: options.sourcePath,
    segments: [segment],
    notes: [
      `Generated by content-package recipe ${options.recipe.id} with profile ${options.profile.id}.`,
      `Approved story candidate: ${candidate.id}.`,
      "Run shortform-pacing and cut-review before publishing.",
    ],
  };
}

function createApprovedEditPlans(
  options: ResolvedContentPackageOptions,
  candidates: StoryCandidate[],
): ApprovedClipPlan[] {
  return candidates.map((candidate, index) => ({
    candidateId: candidate.id,
    editPlanPath: clipPlanRelativePath(candidate.id),
    editPlan: createSelectedEditPlan(options, candidate, `clip-${String(index + 1).padStart(3, "0")}`),
  }));
}

function markdownTableCell(text: string): string {
  return compact(text).replaceAll("|", "\\|");
}

function buildClipSlate(
  options: ResolvedContentPackageOptions,
  storyCandidates: StoryCandidates,
  approvedPlans: ApprovedClipPlan[],
): ClipSlate {
  const approvedPlanById = new Map(approvedPlans.map((plan) => [plan.candidateId, plan]));
  const clipCandidates = storyCandidates.candidates.filter((candidate) => candidate.suggestedArtifacts.includes("clip"));
  const warnings = [...storyCandidates.warnings];
  if (clipCandidates.length === 0) warnings.push("No retained story candidates are currently strong enough to propose as clips.");
  return ClipSlateSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    recipe: options.recipe,
    profile: {
      id: options.profile.id,
      version: options.profile.version,
      label: options.profile.label,
    },
    source: storyCandidates.source,
    objective: storyCandidates.objective,
    approvalStatus: approvedPlans.length > 0 ? "approved" : "needs_approval",
    proposedClipCount: clipCandidates.length,
    approvedCandidateIds: approvedPlans.map((plan) => plan.candidateId),
    clips: clipCandidates.map((candidate) => {
      const approvedPlan = approvedPlanById.get(candidate.id);
      return {
        candidateId: candidate.id,
        rank: candidate.rank,
        title: candidate.title,
        timestamp: candidate.timestamp,
        sourceStartMs: candidate.sourceStartMs,
        sourceEndMs: candidate.sourceEndMs,
        durationMs: candidate.durationMs,
        score: candidate.score,
        confidence: candidate.confidence,
        theme: candidate.theme,
        themeLabel: candidate.themeLabel,
        audience: candidate.audience,
        point: candidate.point,
        hook: candidate.hook,
        suggestedArtifacts: candidate.suggestedArtifacts,
        approvalStatus: approvedPlan ? "approved" : "proposed",
        editPlanPath: approvedPlan?.editPlanPath ?? null,
        evidence: candidate.evidence,
        warnings: candidate.warnings,
      };
    }),
    warnings,
  });
}

function renderClipSlate(clipSlate: ClipSlate): string {
  const lines: string[] = [
    "# Clip Approval Slate",
    "",
    `Generated: ${clipSlate.createdAt}`,
    `Status: ${clipSlate.approvalStatus === "approved" ? "approved" : "needs approval"}`,
    `Recipe: ${clipSlate.recipe.id} v${clipSlate.recipe.version}`,
    `Profile: ${clipSlate.profile.id} v${clipSlate.profile.version}`,
    `Objective: ${clipSlate.objective}`,
    `Proposed clips: ${clipSlate.proposedClipCount}`,
    "",
  ];

  if (clipSlate.approvalStatus === "needs_approval") {
    lines.push(
      "## Approval Needed",
      "",
      "Review the proposed clips below before rendering. Approve only the IDs that should become finished clips.",
      "",
      "```sh",
      `agent-cutroom content-package <project> --recipe ${clipSlate.recipe.id} --profile ${clipSlate.profile.id} --approve <comma-separated-approved-candidate-ids>`,
      "```",
      "",
    );
  } else {
    lines.push(
      "## Approved Clips",
      "",
      `Approved IDs: ${clipSlate.approvedCandidateIds.join(", ")}`,
      "",
    );
  }

  lines.push(
    "## Proposed Clips",
    "",
    "| Rank | ID | Time | Score | Status | Theme | Point |",
    "| ---: | --- | --- | ---: | --- | --- | --- |",
  );
  for (const clip of clipSlate.clips) {
    lines.push(
      `| ${clip.rank} | ${clip.candidateId} | ${clip.timestamp} | ${clip.score.toFixed(3)} | ${clip.approvalStatus} | ${markdownTableCell(clip.themeLabel)} | ${markdownTableCell(clip.point)} |`,
    );
  }
  lines.push("");

  for (const clip of clipSlate.clips) {
    lines.push(
      `## ${clip.rank}. ${clip.title}`,
      "",
      `- ID: ${clip.candidateId}`,
      `- Time: ${clip.timestamp}`,
      `- Duration: ${formatTimestamp(clip.durationMs)}`,
      `- Score: ${clip.score}`,
      `- Confidence: ${clip.confidence}`,
      `- Audience: ${clip.audience}`,
      `- Point: ${clip.point}`,
      `- Hook: ${clip.hook}`,
      `- Edit plan: ${clip.editPlanPath ?? "not approved yet"}`,
      "",
      "### Evidence",
      "",
    );
    for (const item of clip.evidence.slice(0, 8)) lines.push(`- ${item}`);
    if (clip.warnings.length > 0) {
      lines.push("", "### Warnings", "");
      for (const warning of clip.warnings) lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  if (clipSlate.warnings.length > 0) {
    lines.push("## Slate Warnings", "");
    for (const warning of clipSlate.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderInventory(options: ResolvedContentPackageOptions, storyCandidates: StoryCandidates, clipSlate: ClipSlate): string {
  const approvedIds = new Set(clipSlate.approvedCandidateIds);
  const approved = storyCandidates.candidates.filter((candidate) => approvedIds.has(candidate.id));
  const writing = storyCandidates.candidates.filter((candidate) =>
    candidate.suggestedArtifacts.some((artifact) => artifact === "writing" || artifact === "atomic-note" || artifact === "task"),
  );
  const weak = storyCandidates.candidates.filter(
    (candidate) =>
      candidate.score < 0.58 ||
      candidate.warnings.some((warning) => warning.includes("filler") || warning.includes("Weak")),
  );
  const lines: string[] = [
    `# ${options.profile.inventoryTitle}`,
    "",
    `Generated: ${storyCandidates.createdAt}`,
    `Recipe: ${options.recipe.id} v${options.recipe.version}`,
    `Profile: ${options.profile.id} v${options.profile.version}`,
    `Objective: ${storyCandidates.objective}`,
    "",
    "## Source",
    "",
    `- Title: ${options.title}`,
    `- Source media: ${options.sourcePath}`,
    `- Duration: ${options.timeline.media ? formatTimestamp(options.timeline.media.durationMs) : "unknown"}`,
    `- Transcript segments: ${options.timeline.transcriptSegments.length}`,
    `- Review windows: ${options.timeline.windows.length}`,
    `- Observations: ${options.timeline.observations.length}`,
    "",
  ];

  lines.push(
    "## Clip Approval",
    "",
    `- Status: ${clipSlate.approvalStatus === "approved" ? "approved" : "needs approval"}`,
    `- Proposed clips: ${clipSlate.proposedClipCount}`,
    `- Approved clips: ${clipSlate.approvedCandidateIds.length}`,
    "- Approval slate: `review/clip-slate.md`",
    "",
  );

  if (approved.length > 0) {
    lines.push(
      "## Approved Stories",
      "",
    );
    for (const candidate of approved) {
      lines.push(
        `- ${candidate.id} (${candidate.timestamp}): ${candidate.title} - ${candidate.point}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Clip Candidates",
    "",
    "| Rank | ID | Time | Score | Theme | Artifacts | Point |",
    "| ---: | --- | --- | ---: | --- | --- | --- |",
  );
  storyCandidates.candidates.forEach((candidate) => {
    lines.push(
      `| ${candidate.rank} | ${candidate.id} | ${candidate.timestamp} | ${candidate.score.toFixed(3)} | ${markdownTableCell(candidate.themeLabel)} | ${candidate.suggestedArtifacts.join(", ")} | ${markdownTableCell(candidate.point)} |`,
    );
  });
  lines.push("");

  lines.push("## Writing And Vault Opportunities", "");
  for (const candidate of writing.slice(0, 8)) {
    lines.push(
      `- ${candidate.id} (${candidate.timestamp}): ${candidate.suggestedArtifacts.join(", ")} - ${candidate.point}`,
    );
  }
  if (writing.length === 0) lines.push("- None selected by this pass.");
  lines.push("");

  lines.push("## Weak Or Review-Needed Sections", "");
  for (const candidate of weak.slice(0, 6)) {
    const warning = candidate.warnings[0] ?? "Lower score than the selected candidates.";
    lines.push(`- ${candidate.id} (${candidate.timestamp}): ${warning}`);
  }
  if (weak.length === 0) lines.push("- No major weak sections among the retained candidates.");
  lines.push("");

  lines.push(
    "## Repeatable Process",
    "",
    "1. Run `agent-cutroom prepare <project>` to refresh transcript windows, frames, silences, and the review pack.",
    `2. Run \`agent-cutroom content-package <project> --recipe ${options.recipe.id} --profile ${options.profile.id}\` to write this inventory, story candidates, and clip approval slate.`,
    "3. Inspect `review/clip-slate.md`, then rerun content-package with `--approve <candidate-ids>` after human approval.",
    "4. For each approved clip plan under `plans/clips/<candidate-id>/edit-plan.json`, run `shortform-pacing`, then use `cutroom-cut-review` to approve or patch risky boundaries.",
    "5. Run `agent-cutroom render <project> --source-plan <clip-edit-plan> --out <clip-render>` only after the approved story and reviewed cuts are acceptable.",
    "6. Run `agent-cutroom caption <project>`, `agent-cutroom verify <project>`, and `agent-cutroom social-package <project> --platform linkedin` for each platform-matched publishable package.",
    "",
  );

  if (storyCandidates.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of storyCandidates.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderSelection(approved: StoryCandidate[], approvedPlans: ApprovedClipPlan[]): string {
  const planById = new Map(approvedPlans.map((plan) => [plan.candidateId, plan]));
  const lines: string[] = ["# Story Selection", ""];
  if (approved.length === 0) {
    lines.push(
      "No story candidate has been approved yet.",
      "",
      "Review `review/clip-slate.md`, then rerun `agent-cutroom content-package` with `--approve <candidate-ids>` before rendering clips.",
      "",
    );
    return `${lines.join("\n")}\n`;
  }

  lines.push("Approved story candidates:", "");
  for (const candidate of approved) {
    const plan = planById.get(candidate.id);
    lines.push(`- ${candidate.id}: ${candidate.title} (${candidate.timestamp}) -> \`${plan?.editPlanPath ?? "missing edit plan"}\``);
  }
  lines.push("");

  for (const candidate of approved) {
    const plan = planById.get(candidate.id);
    lines.push(
      `## ${candidate.title}`,
      "",
      `- ID: ${candidate.id}`,
      `- Rank: ${candidate.rank}`,
      `- Time: ${candidate.timestamp}`,
      `- Duration: ${formatTimestamp(candidate.durationMs)}`,
      `- Score: ${candidate.score}`,
      `- Confidence: ${candidate.confidence}`,
      `- Theme: ${candidate.themeLabel}`,
      `- Audience: ${candidate.audience}`,
      `- Suggested artifacts: ${candidate.suggestedArtifacts.join(", ")}`,
      "",
      "### Why This One",
      "",
      candidate.whyUseful,
      "",
      "### Hook",
      "",
      candidate.hook,
      "",
      "### Point",
      "",
      candidate.point,
      "",
      "### Evidence",
      "",
    );
    for (const item of candidate.evidence) lines.push(`- ${item}`);
    lines.push("");

    if (candidate.warnings.length > 0) {
      lines.push("### Warnings", "");
      for (const warning of candidate.warnings) lines.push(`- ${warning}`);
      lines.push("");
    }

    const segment = plan?.editPlan.segments[0];
    lines.push(
      "### Edit Plan",
      "",
      `- Segment: ${segment ? `${formatTimestamp(segment.sourceStartMs)}-${formatTimestamp(segment.sourceEndMs)}` : "none"}`,
      `- Output: \`${plan?.editPlanPath ?? "missing edit plan"}\``,
      "",
    );

    lines.push("### Source Excerpt", "", `> ${shortText(candidate.transcriptText, 95)}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export function buildTalkingHeadStoryPackage(options: ResolvedContentPackageOptions) {
  const warnings: string[] = [];
  if (options.timeline.transcriptSegments.length === 0) {
    warnings.push("No timestamped transcript segments are available. Import or generate a transcript first.");
  }
  if (options.timeline.windows.length === 0) {
    warnings.push("No review windows are available. Run prepare before selecting a publishable clip.");
  }
  if (options.timeline.frames.length === 0) {
    warnings.push("No review frames are available. Run prepare before publishing.");
  }
  const candidates = generateCandidates(options);
  const approvedIds = approvedCandidateIds(options);
  const selected = selectedCandidate(candidates, approvedIds[0] ?? null);
  const approved = approvedCandidates(candidates, approvedIds);
  const storyCandidates = StoryCandidatesSchema.parse({
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    recipe: options.recipe,
    profile: {
      id: options.profile.id,
      version: options.profile.version,
      label: options.profile.label,
    },
    source: {
      title: options.title,
      mediaPath: options.sourcePath,
      durationMs: options.timeline.media?.durationMs ?? null,
      transcriptSegments: options.timeline.transcriptSegments.length,
      reviewWindows: options.timeline.windows.length,
      observations: options.timeline.observations.length,
    },
    objective: options.objective ?? options.profile.defaults.objective,
    targetDurationMs: options.targetDurationMs,
    selectedCandidateId: selected?.id ?? null,
    candidates,
    warnings,
  });
  const approvedEditPlans = createApprovedEditPlans(options, approved);
  const editPlan = approvedEditPlans.length === 1 ? approvedEditPlans[0].editPlan : null;
  const clipSlate = buildClipSlate(options, storyCandidates, approvedEditPlans);
  return {
    storyCandidates,
    clipSlate,
    clipSlateMarkdown: renderClipSlate(clipSlate),
    inventoryMarkdown: renderInventory(options, storyCandidates, clipSlate),
    selectionMarkdown: renderSelection(approved, approvedEditPlans),
    editPlan,
    selectedCandidate: selected,
    approvedCandidates: approved,
    approvedEditPlans,
  };
}
