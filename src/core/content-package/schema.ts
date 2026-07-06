import { z } from "zod";
import {
  CUTROOM_VERSION,
  MsSchema,
  type EditPlan,
  type Timeline,
} from "../schema.js";

export const SuggestedArtifactSchema = z.enum(["clip", "writing", "atomic-note", "task", "ignore"]);
export type SuggestedArtifact = z.infer<typeof SuggestedArtifactSchema>;

export const StoryTimingStatusSchema = z.enum(["timestamped", "partial", "untimed"]);
export type StoryTimingStatus = z.infer<typeof StoryTimingStatusSchema>;

export const ContentThemeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  audience: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  whyUseful: z.string().min(1),
  priority: z.number().positive().default(1),
});
export type ContentTheme = z.infer<typeof ContentThemeSchema>;

export const TranscriptReplacementSchema = z.object({
  match: z.string().min(1),
  replacement: z.string(),
  flags: z.string().default("gi"),
});
export type TranscriptReplacement = z.infer<typeof TranscriptReplacementSchema>;

export const TitleRuleSchema = z.object({
  allPhrases: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
});
export type TitleRule = z.infer<typeof TitleRuleSchema>;

export const BoostRuleSchema = z.object({
  allPhrases: z.array(z.string().min(1)).min(1),
  boost: z.number().min(0).max(1),
});
export type BoostRule = z.infer<typeof BoostRuleSchema>;

export const SocialDraftTemplateSchema = z.object({
  theme: z.string().min(1),
  body: z.string().min(1),
});
export type SocialDraftTemplate = z.infer<typeof SocialDraftTemplateSchema>;

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
  hookPatterns: z.array(z.string().min(1)).default([]),
  taskPatterns: z.array(z.string().min(1)).default([]),
  fillerPatterns: z.array(z.string().min(1)).default([]),
  payoffSignals: z.array(z.string().min(1)).default([]),
  pointSignals: z.array(z.string().min(1)).default([]),
  audienceValueSignals: z.array(z.string().min(1)).default([]),
  personalDetailPatterns: z.array(z.string().min(1)).default([]),
  transcriptReplacements: z.array(TranscriptReplacementSchema).default([]),
  titleRules: z.array(TitleRuleSchema).default([]),
  exactBoosts: z.array(BoostRuleSchema).default([]),
  socialDraftTemplates: z.array(SocialDraftTemplateSchema).default([]),
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
  title: z.string(),
  theme: z.string(),
  themeLabel: z.string(),
  audience: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  durationMs: MsSchema,
  timestamp: z.string(),
  timingStatus: StoryTimingStatusSchema,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  hook: z.string(),
  claim: z.string(),
  turn: z.string(),
  proof: z.string(),
  payoff: z.string(),
  platformFit: z.array(z.string()).default([]),
  point: z.string(),
  whyUseful: z.string(),
  suggestedArtifacts: z.array(SuggestedArtifactSchema),
  transcriptText: z.string(),
  source: StoryCandidateSourceSchema,
  sourceSegmentIds: z.array(z.string()).default([]),
  sourceWindowIds: z.array(z.string()).default([]),
  sourceFrameIds: z.array(z.string()).default([]),
  sourceObservationIds: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  scoreReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  socialPostDraft: z.string().nullable().default(null),
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
  title: z.string(),
  timestamp: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  durationMs: MsSchema,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  theme: z.string(),
  themeLabel: z.string(),
  audience: z.string(),
  point: z.string(),
  hook: z.string(),
  suggestedArtifacts: z.array(SuggestedArtifactSchema),
  approvalStatus: z.enum(["proposed", "approved"]),
  editPlanPath: z.string().nullable(),
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
  clipSlateMarkdown: string;
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
