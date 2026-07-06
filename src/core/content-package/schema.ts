import { z } from "zod";
import {
  CUTROOM_VERSION,
  MsSchema,
  type EditPlan,
  type Timeline,
} from "../schema.js";

export const StoryTimingStatusSchema = z.enum(["timestamped", "partial", "untimed"]);
export type StoryTimingStatus = z.infer<typeof StoryTimingStatusSchema>;

export const ContentThemeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  priority: z.number().positive().default(1),
});
export type ContentTheme = z.infer<typeof ContentThemeSchema>;

export const TranscriptReplacementSchema = z.object({
  match: z.string().min(1),
  replacement: z.string(),
  flags: z.string().default("gi"),
});
export type TranscriptReplacement = z.infer<typeof TranscriptReplacementSchema>;

export const BoostRuleSchema = z.object({
  allPhrases: z.array(z.string().min(1)).min(1),
  boost: z.number().min(0).max(1),
});
export type BoostRule = z.infer<typeof BoostRuleSchema>;

export const ContentProfileDefaultsSchema = z.object({
  objective: z.string().min(1),
  targetDurationMs: MsSchema.default(75_000),
  minDurationMs: MsSchema.default(35_000),
  maxDurationMs: MsSchema.default(125_000),
  maxCandidates: z.number().int().positive().default(8),
  leadPaddingMs: MsSchema.default(800),
  tailPaddingMs: MsSchema.default(1200),
});
export type ContentProfileDefaults = z.infer<typeof ContentProfileDefaultsSchema>;

export const ContentProfileSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  label: z.string().min(1),
  inventoryTitle: z.string().min(1),
  weakThemeWarning: z.string().min(1),
  themes: z.array(ContentThemeSchema).min(1),
  openingSignalPatterns: z.array(z.string().min(1)).default([]),
  fillerPatterns: z.array(z.string().min(1)).default([]),
  outcomeSignalPatterns: z.array(z.string().min(1)).default([]),
  listenerValueSignalPatterns: z.array(z.string().min(1)).default([]),
  personalDetailPatterns: z.array(z.string().min(1)).default([]),
  transcriptReplacements: z.array(TranscriptReplacementSchema).default([]),
  exactBoosts: z.array(BoostRuleSchema).default([]),
  defaults: ContentProfileDefaultsSchema,
});
export type ContentProfile = z.infer<typeof ContentProfileSchema>;

export const ContentRecipeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  label: z.string().min(1),
});
export type ContentRecipe = z.infer<typeof ContentRecipeSchema>;

export const StoryCandidateSourceSchema = z.object({
  segmentIds: z.array(z.string()).default([]),
  windowIds: z.array(z.string()).default([]),
  frameIds: z.array(z.string()).default([]),
  observationIds: z.array(z.string()).default([]),
});
export type StoryCandidateSource = z.infer<typeof StoryCandidateSourceSchema>;

export const StoryCandidateSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  heuristicTheme: z.string(),
  heuristicThemeLabel: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  durationMs: MsSchema,
  timestamp: z.string(),
  timingStatus: StoryTimingStatusSchema,
  heuristicScore: z.number().min(0).max(1),
  heuristicConfidence: z.number().min(0).max(1),
  transcriptText: z.string(),
  transcriptExcerpt: z.string(),
  source: StoryCandidateSourceSchema,
  sourceSegmentIds: z.array(z.string()).default([]),
  sourceWindowIds: z.array(z.string()).default([]),
  sourceFrameIds: z.array(z.string()).default([]),
  sourceObservationIds: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  scoreReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type StoryCandidate = z.infer<typeof StoryCandidateSchema>;

export const StoryCandidatesSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  recipe: ContentRecipeSchema,
  profile: z.object({
    id: z.string(),
    version: z.number().int().positive(),
    label: z.string(),
  }),
  source: z.object({
    title: z.string(),
    mediaPath: z.string(),
    durationMs: MsSchema.nullable(),
    transcriptSegments: z.number().int().nonnegative(),
    reviewWindows: z.number().int().nonnegative(),
    observations: z.number().int().nonnegative(),
  }),
  objective: z.string(),
  targetDurationMs: MsSchema,
  selectedCandidateId: z.string().nullable(),
  candidates: z.array(StoryCandidateSchema),
  warnings: z.array(z.string()).default([]),
});
export type StoryCandidates = z.infer<typeof StoryCandidatesSchema>;

export const ClipSlateItemSchema = z.object({
  candidateId: z.string(),
  rank: z.number().int().positive(),
  timestamp: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  durationMs: MsSchema,
  heuristicScore: z.number().min(0).max(1),
  heuristicConfidence: z.number().min(0).max(1),
  heuristicTheme: z.string(),
  heuristicThemeLabel: z.string(),
  transcriptExcerpt: z.string(),
  approvalStatus: z.enum(["proposed", "approved"]),
  editPlanPath: z.string().nullable(),
  sourceSegmentIds: z.array(z.string()).default([]),
  sourceWindowIds: z.array(z.string()).default([]),
  sourceFrameIds: z.array(z.string()).default([]),
  sourceObservationIds: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type ClipSlateItem = z.infer<typeof ClipSlateItemSchema>;

export const ClipSlateSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  recipe: ContentRecipeSchema,
  profile: z.object({
    id: z.string(),
    version: z.number().int().positive(),
    label: z.string(),
  }),
  source: StoryCandidatesSchema.shape.source,
  objective: z.string(),
  approvalStatus: z.enum(["needs_approval", "approved"]),
  proposedClipCount: z.number().int().nonnegative(),
  approvedCandidateIds: z.array(z.string()),
  clips: z.array(ClipSlateItemSchema),
  warnings: z.array(z.string()).default([]),
});
export type ClipSlate = z.infer<typeof ClipSlateSchema>;

export interface ApprovedClipPlan {
  candidateId: string;
  editPlanPath: string;
  editPlan: EditPlan;
}

export interface ContentPackage {
  storyCandidates: StoryCandidates;
  clipSlate: ClipSlate;
  candidateEvidenceMarkdown: string;
  inventoryMarkdown: string;
  selectionMarkdown: string;
  editPlan: EditPlan | null;
  selectedCandidate: StoryCandidate | null;
  approvedCandidates: StoryCandidate[];
  approvedEditPlans: ApprovedClipPlan[];
}

export interface BuildContentPackageOptions {
  timeline: Timeline;
  sourcePath: string;
  title: string;
  recipe: ContentRecipe;
  profile: ContentProfile;
  objective?: string;
  targetDurationMs?: number;
  minDurationMs?: number;
  maxDurationMs?: number;
  maxCandidates?: number;
  selectedId?: string | null;
  approvedCandidateIds?: string[];
  leadPaddingMs?: number;
  tailPaddingMs?: number;
}

export interface ResolvedContentPackageOptions extends BuildContentPackageOptions {
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  maxCandidates: number;
  leadPaddingMs: number;
  tailPaddingMs: number;
}

export interface WriteContentPackageOptions extends BuildContentPackageOptions {
  projectDir: string;
}
