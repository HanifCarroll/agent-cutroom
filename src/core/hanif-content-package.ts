import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  CUTROOM_VERSION,
  type EditPlan,
  type EditSegment,
  type Timeline,
  type TranscriptSegment,
} from "./schema.js";
import { ensureDir, writeJson } from "./files.js";
import { formatTimestamp } from "./time.js";
import {
  contentInventoryPath,
  editPlanPath,
  storyCandidatesPath,
  storySelectionPath,
} from "./project.js";

type SuggestedArtifact = "clip" | "writing" | "atomic-note" | "task" | "ignore";

interface ThemeDefinition {
  id: string;
  label: string;
  audience: string;
  keywords: string[];
  whyUseful: string;
  priority: number;
}

export interface HanifStoryCandidate {
  id: string;
  title: string;
  theme: string;
  themeLabel: string;
  audience: string;
  sourceStartMs: number;
  sourceEndMs: number;
  durationMs: number;
  timestamp: string;
  score: number;
  confidence: number;
  hook: string;
  point: string;
  whyUseful: string;
  suggestedArtifacts: SuggestedArtifact[];
  transcriptText: string;
  sourceSegmentIds: string[];
  sourceWindowIds: string[];
  sourceFrameIds: string[];
  sourceObservationIds: string[];
  evidence: string[];
  warnings: string[];
}

export interface HanifStoryCandidates {
  version: number;
  createdAt: string;
  objective: string;
  targetDurationMs: number;
  candidates: HanifStoryCandidate[];
  warnings: string[];
}

export interface HanifContentPackage {
  storyCandidates: HanifStoryCandidates;
  inventoryMarkdown: string;
  selectionMarkdown: string;
  editPlan: EditPlan | null;
  selectedCandidate: HanifStoryCandidate | null;
}

export interface BuildHanifContentPackageOptions {
  timeline: Timeline;
  sourcePath: string;
  title: string;
  objective?: string;
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  maxCandidates: number;
  selectedId?: string | null;
  leadPaddingMs: number;
  tailPaddingMs: number;
}

export interface WriteHanifContentPackageOptions extends BuildHanifContentPackageOptions {
  projectDir: string;
}

const THEMES: ThemeDefinition[] = [
  {
    id: "consulting-focus",
    label: "Consulting Focus",
    audience: "paid media operators and agency owners",
    keywords: [
      "consulting",
      "technical consultant",
      "paid media",
      "agency",
      "agencies",
      "icp",
      "client",
      "clients",
      "offer",
      "diagnose",
      "operations",
      "workflow automation",
      "custom software",
      "reporting",
    ],
    whyUseful: "Sharpens the consulting positioning around paid-media agency operations.",
    priority: 1.08,
  },
  {
    id: "codex-operating-system",
    label: "Codex Operating System",
    audience: "builders who use agents to run real work",
    keywords: [
      "codex",
      "operating system",
      "chief of staff",
      "obsidian",
      "decision note",
      "decision notes",
      "things",
      "tasks",
      "task",
      "perplexity",
      "review artifacts",
      "html file",
      "markdown file",
    ],
    whyUseful: "Shows the workflow system behind the work, not only the final output.",
    priority: 1.04,
  },
  {
    id: "raw-thinking-to-content",
    label: "Raw Thinking To Content",
    audience: "technical creators building a public body of work",
    keywords: [
      "content",
      "video",
      "writing",
      "twitter",
      "linkedin",
      "instagram",
      "tiktok",
      "personal brand",
      "post",
      "posting",
      "publish",
      "published",
      "upload",
      "algorithm",
    ],
    whyUseful: "Connects the raw talking process to publishable writing and clips.",
    priority: 1.11,
  },
  {
    id: "public-building-proof",
    label: "Public Building Proof",
    audience: "software builders and potential clients",
    keywords: [
      "building",
      "software",
      "project",
      "projects",
      "people to try",
      "feedback",
      "share",
      "world",
      "audience",
      "missed opportunity",
      "actually do things",
    ],
    whyUseful: "Turns private software work into public proof and relationship surface area.",
    priority: 1.14,
  },
  {
    id: "speaking-confidence",
    label: "Speaking Confidence",
    audience: "quiet technical people trying to publish more",
    keywords: [
      "talk",
      "talking",
      "speak",
      "speaking",
      "camera",
      "confidence",
      "confident",
      "shy",
      "reserved",
      "imposter",
      "voice",
      "ideas",
      "microphone",
      "tripod",
    ],
    whyUseful: "Makes the personal shift concrete: talking is becoming a reliable creation input.",
    priority: 0.96,
  },
  {
    id: "effectiveness-and-task-graph",
    label: "Effectiveness And Task Graph",
    audience: "builders who get stuck between planning and execution",
    keywords: [
      "effective",
      "effectiveness",
      "efficient",
      "efficiency",
      "prioritize",
      "priority",
      "dag",
      "directed acyclic graph",
      "depends",
      "motivation",
      "decision paralysis",
      "to-do list",
      "today list",
    ],
    whyUseful: "Explains how to make the next action obvious instead of merely doing more tasks.",
    priority: 0.94,
  },
];

const HOOK_PATTERNS = [
  "the difference",
  "the interesting part",
  "important thing",
  "huge mistake",
  "missed opportunity",
  "i realized",
  "i decided",
  "i don't want",
  "i knew",
  "the first",
  "specific",
  "specificity",
  "the name of the game",
  "it just doesn't work",
  "you don't have to",
  "you need",
  "you can't",
  "now i feel",
  "this realization",
];

const TASK_PATTERNS = [
  "i need to",
  "i should",
  "i want to",
  "i'm going to",
  "i am going to",
  "i decided to",
  "i'm trying to",
  "i am trying to",
  "i can worry about",
];

const FILLER_PATTERNS = ["kind of", "sort of", "i guess", "like", "um", "uh"];

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanKnownTranscriptTerms(text: string): string {
  return compact(text)
    .replace(/\binteracting with codecs\b/gi, "interacting with Codex")
    .replace(/\bcloud code\b/gi, "Claude Code")
    .replace(/\bchat\s*gpt\b/gi, "ChatGPT")
    .replace(/\bI the time\b/g, "I dedicate the time")
    .replace(/\b(\w{3,})\s+\1\b/gi, "$1");
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

function bestTheme(text: string): { theme: ThemeDefinition; score: number; matches: string[] } {
  const lower = text.toLowerCase();
  const ranked = THEMES.map((theme) => {
    const matches = theme.keywords.filter((keyword) => includesPhrase(lower, keyword));
    return {
      theme,
      matches,
      score: Math.min(1, matches.length / 5),
    };
  }).sort((a, b) => b.score - a.score || b.matches.length - a.matches.length);
  return ranked[0] ?? { theme: THEMES[0], score: 0, matches: [] };
}

function hookScore(text: string): number {
  const lower = text.toLowerCase();
  const opening = lower.slice(0, 420);
  const firstHalf = lower.slice(0, Math.max(420, Math.floor(lower.length / 2)));
  const openingHits = HOOK_PATTERNS.filter((pattern) => includesPhrase(opening, pattern)).length;
  const totalHits = HOOK_PATTERNS.filter((pattern) => includesPhrase(firstHalf, pattern)).length;
  return Math.min(1, openingHits * 0.4 + totalHits * 0.18);
}

function payoffScore(text: string): number {
  const lower = text.toLowerCase();
  const signals = [
    "because",
    "so that",
    "as a result",
    "that's why",
    "that is why",
    "the result",
    "it helps",
    "you can",
    "you need",
    "the transformation",
    "what this means",
  ];
  return Math.min(1, signals.filter((signal) => includesPhrase(lower, signal)).length / 3);
}

function durationFit(durationMs: number, targetMs: number, minMs: number, maxMs: number): number {
  if (durationMs < minMs || durationMs > maxMs) return 0;
  return 1 - Math.min(1, Math.abs(durationMs - targetMs) / Math.max(1, targetMs));
}

function fillerPenalty(text: string): number {
  const words = Math.max(1, wordCount(text));
  const count = phraseCount(text.toLowerCase(), FILLER_PATTERNS);
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

function suggestedArtifacts(text: string, score: number, themeId: string): SuggestedArtifact[] {
  const lower = text.toLowerCase();
  const artifacts = new Set<SuggestedArtifact>();
  if (score >= 0.62) artifacts.add("clip");
  if (themeId === "raw-thinking-to-content" || themeId === "public-building-proof") artifacts.add("writing");
  if (themeId === "codex-operating-system" || themeId === "effectiveness-and-task-graph") {
    artifacts.add("atomic-note");
  }
  if (TASK_PATTERNS.some((pattern) => includesPhrase(lower, pattern))) artifacts.add("task");
  if (artifacts.size === 0) artifacts.add(score >= 0.48 ? "writing" : "ignore");
  return [...artifacts];
}

function candidateTitle(theme: ThemeDefinition, text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("actually do things") && lower.includes("never published")) {
    return "Actually Do Things And Publish The Work";
  }
  if (lower.includes("effective") && lower.includes("efficient")) {
    return "Effectiveness Beats Efficiency";
  }
  if (lower.includes("specificity is the name of the game")) {
    return "Specificity Is The Name Of The Game";
  }
  if (lower.includes("interacting with ai") && lower.includes("writing that i can publish")) {
    return "Turn Raw Talking Into Publishable Content";
  }
  if (lower.includes("chief of staff") && lower.includes("codex")) {
    return "Codex As A Chief Of Staff";
  }
  if (lower.includes("directed acyclic graph")) {
    return "A Task Graph Removes Decision Paralysis";
  }
  const hook = firstUsefulSentence(text);
  if (hook) return titleCase(hook);
  return theme.label;
}

function signalPoint(text: string, theme: ThemeDefinition): string {
  const sentences = sentenceSplit(text);
  const lowerPatterns = [
    "actually do things",
    "never published",
    "missed opportunity",
    "specificity is the name of the game",
    "that's the difference",
    "effectiveness is",
    "you need people",
    "interacting with ai",
    "writing that i can publish",
    "directed acyclic graph",
    "decision paralysis",
    "chief of staff",
  ];
  return (
    sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return lowerPatterns.some((pattern) => includesPhrase(lower, pattern));
    }) ??
    sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return theme.keywords.some((keyword) => includesPhrase(lower, keyword));
    }) ??
    firstUsefulSentence(text)
  );
}

function exactUseCaseBoost(text: string): number {
  const lower = text.toLowerCase();
  let boost = 0;
  if (lower.includes("actually do things") && lower.includes("never published")) boost += 0.16;
  if (lower.includes("specificity is the name of the game")) boost += 0.1;
  if (lower.includes("interacting with ai") && lower.includes("writing that i can publish")) boost += 0.08;
  if (lower.includes("codex") && lower.includes("chief of staff")) boost += 0.06;
  return boost;
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
}: {
  text: string;
  durationMs: number;
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  hasFrames: boolean;
  hasWindows: boolean;
}): { score: number; theme: ThemeDefinition; themeScore: number; evidence: string[]; warnings: string[] } {
  const themeResult = bestTheme(text);
  const duration = durationFit(durationMs, targetDurationMs, minDurationMs, maxDurationMs);
  const hook = hookScore(text);
  const payoff = payoffScore(text);
  const filler = fillerPenalty(text);
  const opening = openingPenalty(text);
  const frameScore = hasFrames ? 0.04 : 0;
  const windowScore = hasWindows ? 0.03 : 0;
  const baseScore = Math.max(
    0,
    0.33 * themeResult.score + 0.2 * hook + 0.2 * payoff + 0.2 * duration + frameScore + windowScore - filler - opening,
  );
  const score = Math.min(1, baseScore * themeResult.theme.priority + exactUseCaseBoost(text));
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
  if (themeResult.score < 0.35) warnings.push("Weak match to Hanif's current content themes.");
  if (!hasWindows) warnings.push("No review windows overlap this span; run prepare for stronger evidence.");
  if (!hasFrames) warnings.push("No sampled frames overlap this span; inspect visuals before publishing.");
  if (opening >= 0.18) warnings.push("Opening looks mid-sentence; prefer a cleaner start before rendering.");
  return { score, theme: themeResult.theme, themeScore: themeResult.score, evidence, warnings };
}

function buildCandidate({
  timeline,
  segments,
  index,
  targetDurationMs,
  minDurationMs,
  maxDurationMs,
}: {
  timeline: Timeline;
  segments: TranscriptSegment[];
  index: number;
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}): HanifStoryCandidate {
  const startMs = segments[0]?.startMs ?? 0;
  const endMs = segments.at(-1)?.endMs ?? startMs;
  const text = cleanKnownTranscriptTerms(segments.map((segment) => segment.text).join(" "));
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
  });
  const hook = firstUsefulSentence(text);
  const point = signalPoint(text, scored.theme);
  const artifacts = suggestedArtifacts(text, scored.score, scored.theme.id);
  const warnings = [...scored.warnings];
  if (!hasWordTimings(segments)) warnings.push("No word timings in this span; active-word captions cannot be produced.");
  const evidence = observations.length
    ? [...scored.evidence, `agent observations: ${observations.join(", ")}`]
    : scored.evidence;
  return {
    id: `story-${String(index + 1).padStart(3, "0")}`,
    title: candidateTitle(scored.theme, text),
    theme: scored.theme.id,
    themeLabel: scored.theme.label,
    audience: scored.theme.audience,
    sourceStartMs: startMs,
    sourceEndMs: endMs,
    durationMs: endMs - startMs,
    timestamp: `${formatTimestamp(startMs)}-${formatTimestamp(endMs)}`,
    score: Number(scored.score.toFixed(3)),
    confidence: Number(Math.min(0.95, 0.45 + scored.score * 0.5).toFixed(3)),
    hook: shortText(hook, 26),
    point: shortText(point, 34),
    whyUseful: scored.theme.whyUseful,
    suggestedArtifacts: artifacts,
    transcriptText: text,
    sourceSegmentIds: segments.map((segment) => segment.id),
    sourceWindowIds: windows,
    sourceFrameIds: frames,
    sourceObservationIds: observations,
    evidence,
    warnings,
  };
}

function overlapRatio(a: HanifStoryCandidate, b: HanifStoryCandidate): number {
  const overlap = Math.max(0, Math.min(a.sourceEndMs, b.sourceEndMs) - Math.max(a.sourceStartMs, b.sourceStartMs));
  return overlap / Math.max(1, Math.min(a.durationMs, b.durationMs));
}

function selectCandidates(candidates: HanifStoryCandidate[], maxCandidates: number): HanifStoryCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.sourceStartMs - b.sourceStartMs);
  const selected: HanifStoryCandidate[] = [];
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
  return selected.slice(0, maxCandidates).map((candidate, index) => ({
    ...candidate,
    id: `story-${String(index + 1).padStart(3, "0")}`,
  }));
}

function generateCandidates(options: BuildHanifContentPackageOptions): HanifStoryCandidate[] {
  const segments = options.timeline.transcriptSegments
    .filter((segment) => compact(segment.text))
    .sort((a, b) => a.startMs - b.startMs);
  const raw: HanifStoryCandidate[] = [];
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
            index: raw.length,
            targetDurationMs: options.targetDurationMs,
            minDurationMs: options.minDurationMs,
            maxDurationMs: options.maxDurationMs,
          }),
        );
      }
    }
  }
  return selectCandidates(raw, options.maxCandidates);
}

function selectedCandidate(
  candidates: HanifStoryCandidate[],
  selectedId?: string | null,
): HanifStoryCandidate | null {
  if (selectedId) {
    const selected = candidates.find((candidate) => candidate.id === selectedId);
    if (selected) return selected;
  }
  return candidates.find((candidate) => candidate.suggestedArtifacts.includes("clip")) ?? candidates[0] ?? null;
}

function createSelectedEditPlan(options: BuildHanifContentPackageOptions, candidate: HanifStoryCandidate): EditPlan {
  const sourceEnd = options.timeline.media?.durationMs ?? candidate.sourceEndMs;
  const startMs = Math.max(0, candidate.sourceStartMs - options.leadPaddingMs);
  const endMs = Math.min(sourceEnd, candidate.sourceEndMs + options.tailPaddingMs);
  const segment: EditSegment = {
    id: "clip-001",
    sourceStartMs: startMs,
    sourceEndMs: endMs,
    reason: `Selected by hanif-content-package: ${candidate.title}`,
    sourceWindowIds: candidate.sourceWindowIds,
    evidence: [
      `story candidate ${candidate.id}`,
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
      "Generated by hanif-content-package for Hanif's talking-head content workflow.",
      "Inspect review/content-inventory.md and analysis/story-selection.md before publishing.",
    ],
  };
}

function markdownTableCell(text: string): string {
  return compact(text).replaceAll("|", "\\|");
}

function renderInventory(options: BuildHanifContentPackageOptions, storyCandidates: HanifStoryCandidates): string {
  const selected = selectedCandidate(storyCandidates.candidates, options.selectedId);
  const writing = storyCandidates.candidates.filter((candidate) =>
    candidate.suggestedArtifacts.some((artifact) => artifact === "writing" || artifact === "atomic-note" || artifact === "task"),
  );
  const weak = storyCandidates.candidates.filter(
    (candidate) => candidate.score < 0.58 || candidate.warnings.some((warning) => warning.includes("filler") || warning.includes("Weak")),
  );
  const lines: string[] = [
    "# Hanif Content Inventory",
    "",
    `Generated: ${storyCandidates.createdAt}`,
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
    "| Rank | Time | Score | Theme | Artifacts | Point |",
    "| --- | --- | ---: | --- | --- | --- |",
  );
  storyCandidates.candidates.forEach((candidate, index) => {
    lines.push(
      `| ${index + 1} | ${candidate.timestamp} | ${candidate.score.toFixed(3)} | ${markdownTableCell(candidate.themeLabel)} | ${candidate.suggestedArtifacts.join(", ")} | ${markdownTableCell(candidate.point)} |`,
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
    "2. Run `agent-cutroom hanif-content-package <project>` to write this inventory, story candidates, story selection, and the selected edit plan.",
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

function renderSelection(candidate: HanifStoryCandidate | null, editPlan: EditPlan | null): string {
  const lines: string[] = ["# Story Selection", ""];
  if (!candidate) {
    lines.push("No story candidate was selected.", "");
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    "## Selected Candidate",
    "",
    `- ID: ${candidate.id}`,
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

export function buildHanifContentPackage(options: BuildHanifContentPackageOptions): HanifContentPackage {
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
  const storyCandidates: HanifStoryCandidates = {
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    objective:
      options.objective ??
      "Find source-backed talking-head moments for Hanif's consulting, content, software, and workflow goals.",
    targetDurationMs: options.targetDurationMs,
    candidates,
    warnings,
  };
  const selected = selectedCandidate(candidates, options.selectedId);
  const editPlan = selected ? createSelectedEditPlan(options, selected) : null;
  return {
    storyCandidates,
    inventoryMarkdown: renderInventory(options, storyCandidates),
    selectionMarkdown: renderSelection(selected, editPlan),
    editPlan,
    selectedCandidate: selected,
  };
}

export async function writeHanifContentPackage(
  options: WriteHanifContentPackageOptions,
): Promise<HanifContentPackage> {
  const built = buildHanifContentPackage(options);
  await ensureDir(resolve(options.projectDir, "review"));
  await ensureDir(resolve(options.projectDir, "analysis"));
  await writeJson(storyCandidatesPath(options.projectDir), built.storyCandidates);
  await writeFile(contentInventoryPath(options.projectDir), built.inventoryMarkdown);
  await writeFile(storySelectionPath(options.projectDir), built.selectionMarkdown);
  if (built.editPlan) await writeJson(editPlanPath(options.projectDir), built.editPlan);
  return built;
}

export async function readHanifStoryCandidates(projectDir: string): Promise<HanifStoryCandidates | null> {
  try {
    const parsed = JSON.parse(await readFile(storyCandidatesPath(projectDir), "utf8")) as HanifStoryCandidates;
    if (!Array.isArray(parsed.candidates)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function defaultContentPackageTitle(sourcePath: string): string {
  return basename(sourcePath).replace(/\.[^.]+$/, "");
}
