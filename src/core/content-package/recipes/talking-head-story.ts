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
  const filler = fillerPenalty(text, profile);
  const opening = openingPenalty(text);
  const frameScore = hasFrames ? 0.04 : 0;
  const windowScore = hasWindows ? 0.03 : 0;
  const baseScore = Math.max(
    0,
    0.33 * themeResult.score + 0.2 * hook + 0.2 * payoff + 0.2 * duration + frameScore + windowScore - filler - opening,
  );
  const score = Math.min(1, baseScore * themeResult.theme.priority + exactUseCaseBoost(text, profile));
  const evidence = [
    `theme matches: ${themeResult.matches.length ? themeResult.matches.slice(0, 8).join(", ") : "none"}`,
    `duration fit: ${duration.toFixed(2)}`,
    `hook score: ${hook.toFixed(2)}`,
    `payoff score: ${payoff.toFixed(2)}`,
  ];
  if (opening > 0) evidence.push(`opening penalty: ${opening.toFixed(2)}`);
  const warnings: string[] = [];
  if (filler >= 0.14) warnings.push("High filler density; likely needs tightening before publishing.");
  if (durationMs > targetDurationMs * 1.35) warnings.push("Longer than target; clip should be tightened.");
  if (themeResult.score < 0.35) warnings.push(profile.weakThemeWarning);
  if (!hasWindows) warnings.push("No review windows overlap this span; run prepare for stronger evidence.");
  if (!hasFrames) warnings.push("No sampled frames overlap this span; inspect visuals before publishing.");
  if (opening >= 0.18) warnings.push("Opening looks mid-sentence; prefer a cleaner start before rendering.");
  return { score, theme: themeResult.theme, themeScore: themeResult.score, evidence, warnings };
}

function storyCandidateId(startMs: number, endMs: number): string {
  return `story-${String(startMs).padStart(9, "0")}-${String(endMs).padStart(9, "0")}`;
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
  return candidates.find((candidate) => candidate.suggestedArtifacts.includes("clip")) ?? candidates[0] ?? null;
}

function createSelectedEditPlan(options: ResolvedContentPackageOptions, candidate: StoryCandidate): EditPlan {
  const sourceEnd = options.timeline.media?.durationMs ?? candidate.sourceEndMs;
  const startMs = Math.max(0, candidate.sourceStartMs - options.leadPaddingMs);
  const endMs = Math.min(sourceEnd, candidate.sourceEndMs + options.tailPaddingMs);
  const segment: EditSegment = {
    id: "clip-001",
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
      "Inspect review/content-inventory.md and analysis/story-selection.md before publishing.",
    ],
  };
}

function markdownTableCell(text: string): string {
  return compact(text).replaceAll("|", "\\|");
}

function renderInventory(options: ResolvedContentPackageOptions, storyCandidates: StoryCandidates): string {
  const selected = selectedCandidate(storyCandidates.candidates, options.selectedId);
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

  if (selected) {
    lines.push(
      "## Selected Story",
      "",
      `- Candidate: ${selected.id}`,
      `- Title: ${selected.title}`,
      `- Time: ${selected.timestamp}`,
      `- Score: ${selected.score}`,
      `- Theme: ${selected.themeLabel}`,
      `- Artifact: ${selected.suggestedArtifacts.join(", ")}`,
      `- Point: ${selected.point}`,
      "",
    );
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
    `2. Run \`agent-cutroom content-package <project> --recipe ${options.recipe.id} --profile ${options.profile.id}\` to write this inventory, story candidates, story selection, and the selected edit plan.`,
    "3. Inspect `review/content-inventory.md`, `analysis/story-candidates.json`, and `analysis/story-selection.md`.",
    "4. Run `agent-cutroom render <project>` only after the selected story is acceptable.",
    "5. Run `agent-cutroom caption <project>`, `agent-cutroom verify <project>`, and `agent-cutroom social-package <project> --platform linkedin` for a publishable package.",
    "",
  );

  if (storyCandidates.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of storyCandidates.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderSelection(candidate: StoryCandidate | null, editPlan: EditPlan | null): string {
  const lines: string[] = ["# Story Selection", ""];
  if (!candidate) {
    lines.push("No story candidate was selected.", "");
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    "## Selected Candidate",
    "",
    `- ID: ${candidate.id}`,
    `- Rank: ${candidate.rank}`,
    `- Title: ${candidate.title}`,
    `- Time: ${candidate.timestamp}`,
    `- Duration: ${formatTimestamp(candidate.durationMs)}`,
    `- Score: ${candidate.score}`,
    `- Confidence: ${candidate.confidence}`,
    `- Theme: ${candidate.themeLabel}`,
    `- Audience: ${candidate.audience}`,
    `- Suggested artifacts: ${candidate.suggestedArtifacts.join(", ")}`,
    "",
    "## Why This One",
    "",
    candidate.whyUseful,
    "",
    "## Hook",
    "",
    candidate.hook,
    "",
    "## Point",
    "",
    candidate.point,
    "",
    "## Evidence",
    "",
  );
  for (const item of candidate.evidence) lines.push(`- ${item}`);
  lines.push("");

  if (candidate.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of candidate.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  if (editPlan) {
    const segment = editPlan.segments[0];
    lines.push(
      "## Edit Plan",
      "",
      `- Segment: ${segment ? `${formatTimestamp(segment.sourceStartMs)}-${formatTimestamp(segment.sourceEndMs)}` : "none"}`,
      "- Output: `edit-plan.json`",
      "",
    );
  }

  lines.push("## Source Excerpt", "", `> ${shortText(candidate.transcriptText, 95)}`, "");
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
  const selected = selectedCandidate(candidates, options.selectedId);
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
  const editPlan = selected ? createSelectedEditPlan(options, selected) : null;
  return {
    storyCandidates,
    inventoryMarkdown: renderInventory(options, storyCandidates),
    selectionMarkdown: renderSelection(selected, editPlan),
    editPlan,
    selectedCandidate: selected,
  };
}
