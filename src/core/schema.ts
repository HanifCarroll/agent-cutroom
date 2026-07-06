import { z } from "zod";

export const CUTROOM_VERSION = 1;

export const MsSchema = z.number().int().nonnegative();

export const TranscriptWordSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  text: z.string(),
  probability: z.number().min(0).max(1).nullable().default(null),
});

export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  text: z.string(),
  words: z.array(TranscriptWordSchema).default([]),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptProvenanceSchema = z.object({
  tool: z.string(),
  createdAt: z.string(),
  sourceAudioPath: z.string(),
  rawTextPath: z.string().nullable(),
  rawJsonPath: z.string().nullable(),
  vaultNotePath: z.string().nullable(),
  backend: z.string().nullable(),
  model: z.string().nullable(),
  qualityWarnings: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type TranscriptProvenance = z.infer<typeof TranscriptProvenanceSchema>;

export const SilenceRangeSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  durationMs: MsSchema,
});

export type SilenceRange = z.infer<typeof SilenceRangeSchema>;

export const FrameSchema = z.object({
  id: z.string(),
  atMs: MsSchema,
  timestamp: z.string(),
  path: z.string(),
  reason: z.string(),
});

export type Frame = z.infer<typeof FrameSchema>;

export const TimelineWindowSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  timestamp: z.string(),
  transcriptText: z.string(),
  frameIds: z.array(z.string()),
  silenceIds: z.array(z.string()),
});

export type TimelineWindow = z.infer<typeof TimelineWindowSchema>;

export const ObservationSchema = z.object({
  id: z.string(),
  windowId: z.string(),
  createdAt: z.string(),
  visualSummary: z.string(),
  visibleText: z.string().default(""),
  editingUse: z.enum(["keep", "tighten", "cut", "broll"]),
  brollNeed: z.enum(["none", "low", "medium", "high"]),
  notes: z.array(z.string()).default([]),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const MediaInfoSchema = z.object({
  path: z.string(),
  originalPath: z.string().optional(),
  durationMs: MsSchema,
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fps: z.number().positive().nullable(),
  hasAudio: z.boolean(),
  hasVideo: z.boolean(),
  sizeBytes: MsSchema,
  formatName: z.string().nullable(),
});

export type MediaInfo = z.infer<typeof MediaInfoSchema>;

export const CutroomManifestSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  title: z.string(),
  createdAt: z.string(),
  sourcePath: z.string(),
  transcriptPath: z.string().nullable(),
  timelinePath: z.string(),
  editPlanPath: z.string(),
  renderDir: z.string(),
});

export type CutroomManifest = z.infer<typeof CutroomManifestSchema>;

export const TimelineSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  media: MediaInfoSchema.nullable(),
  transcriptSegments: z.array(TranscriptSegmentSchema),
  transcriptUntimedText: z.string().nullable(),
  transcriptProvenance: TranscriptProvenanceSchema.nullable().default(null),
  warnings: z.array(z.string()),
  silences: z.array(SilenceRangeSchema),
  frames: z.array(FrameSchema),
  windows: z.array(TimelineWindowSchema),
  observations: z.array(ObservationSchema),
});

export type Timeline = z.infer<typeof TimelineSchema>;

export const EditSegmentSchema = z.object({
  id: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  reason: z.string(),
  sourceWindowIds: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1),
  warnings: z.array(z.string()).default([]),
});

export type EditSegment = z.infer<typeof EditSegmentSchema>;

export const EditPlanSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  sourcePath: z.string(),
  segments: z.array(EditSegmentSchema),
  notes: z.array(z.string()),
});

export type EditPlan = z.infer<typeof EditPlanSchema>;

export const ShortFormPacingCutSchema = z.object({
  id: z.string(),
  sourceSegmentId: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  removedMs: MsSchema,
  keptPauseMs: MsSchema,
  reason: z.string(),
  precedingWord: z.string().nullable(),
  followingWord: z.string().nullable(),
});

export type ShortFormPacingCut = z.infer<typeof ShortFormPacingCutSchema>;

export const ShortFormPacingPlanSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  sourceEditPlanPath: z.string(),
  outputEditPlanPath: z.string(),
  beforeDurationMs: MsSchema,
  afterDurationMs: MsSchema,
  removedMs: MsSchema,
  options: z.object({
    minPauseMs: MsSchema,
    keepPauseMs: MsSchema,
    leadInMs: MsSchema,
    tailOutMs: MsSchema,
    minCutMs: MsSchema,
    minSegmentMs: MsSchema,
  }),
  cuts: z.array(ShortFormPacingCutSchema),
  warnings: z.array(z.string()).default([]),
});

export type ShortFormPacingPlan = z.infer<typeof ShortFormPacingPlanSchema>;

export const ColorGradePlanSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  method: z.literal("subject-mask-shadow-lift"),
  targetPath: z.string(),
  outputPath: z.string().nullable(),
  previewFrames: z.array(z.string()).default([]),
  mask: z.object({
    centerXPct: z.number().min(0).max(1),
    centerYPct: z.number().min(0).max(1),
    radiusXPct: z.number().positive(),
    radiusYPct: z.number().positive(),
    featherPx: z.number().nonnegative(),
  }),
  grade: z.object({
    brightness: z.number(),
    contrast: z.number().positive(),
    gamma: z.number().positive(),
    gammaWeight: z.number().min(0).max(1),
    saturation: z.number().positive(),
  }),
  filterGraph: z.string(),
  warnings: z.array(z.string()).default([]),
});

export type ColorGradePlan = z.infer<typeof ColorGradePlanSchema>;

export const HighlightCandidateSchema = z.object({
  id: z.string(),
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  durationMs: MsSchema,
  transcriptText: z.string(),
  reason: z.string(),
  evidence: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  score: z.number().min(0).max(1),
  sourceWindowIds: z.array(z.string()).default([]),
  sourceFrameIds: z.array(z.string()).default([]),
  sourceObservationIds: z.array(z.string()).default([]),
});

export type HighlightCandidate = z.infer<typeof HighlightCandidateSchema>;

export const HighlightCandidatesSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  objective: z.string(),
  targetDurationMs: MsSchema,
  candidates: z.array(HighlightCandidateSchema),
  warnings: z.array(z.string()).default([]),
});

export type HighlightCandidates = z.infer<typeof HighlightCandidatesSchema>;

export const CaptionStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  fontName: z.string(),
  fontSize: z.number().int().positive(),
  primaryColor: z.string(),
  activeColor: z.string(),
  outlineColor: z.string(),
  backColor: z.string(),
  outline: z.number().nonnegative(),
  shadow: z.number().nonnegative(),
  alignment: z.number().int().min(1).max(9),
  marginL: z.number().int().nonnegative(),
  marginR: z.number().int().nonnegative(),
  marginV: z.number().int().nonnegative(),
  maxWordsPerLine: z.number().int().positive(),
  maxLines: z.number().int().positive(),
});

export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const CaptionEventSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  sourceStartMs: MsSchema,
  sourceEndMs: MsSchema,
  text: z.string(),
  activeWord: z.string(),
});

export type CaptionEvent = z.infer<typeof CaptionEventSchema>;

export const CaptionPlanSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  sourceMediaPath: z.string(),
  targetMediaPath: z.string(),
  subtitlePath: z.string(),
  outputPath: z.string().nullable(),
  format: z.enum(["ass", "srt", "vtt"]),
  style: CaptionStyleSchema,
  events: z.array(CaptionEventSchema),
  warnings: z.array(z.string()).default([]),
});

export type CaptionPlan = z.infer<typeof CaptionPlanSchema>;

export const VerificationCheckSchema = z.object({
  id: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  message: z.string(),
  path: z.string().optional(),
});

export type VerificationCheck = z.infer<typeof VerificationCheckSchema>;

export const VerificationReportSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  targetPath: z.string(),
  ok: z.boolean(),
  media: MediaInfoSchema.nullable(),
  checks: z.array(VerificationCheckSchema),
  previewFrames: z.array(FrameSchema).default([]),
});

export type VerificationReport = z.infer<typeof VerificationReportSchema>;

export const PlatformSchema = z.enum(["instagram", "tiktok", "youtube-shorts", "linkedin"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const PlatformStylePackSchema = z.object({
  id: z.string(),
  platform: PlatformSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  videoBitrate: z.string(),
  audioBitrate: z.string(),
  safeZone: z.object({
    topPct: z.number().nonnegative(),
    bottomPct: z.number().nonnegative(),
    leftPct: z.number().nonnegative(),
    rightPct: z.number().nonnegative(),
  }),
  caption: CaptionStyleSchema,
  notes: z.array(z.string()),
});

export type PlatformStylePack = z.infer<typeof PlatformStylePackSchema>;

export const SocialPackageSchema = z.object({
  version: z.literal(CUTROOM_VERSION),
  createdAt: z.string(),
  platform: PlatformSchema,
  renderPath: z.string(),
  coverFramePath: z.string().nullable(),
  titleOptions: z.array(z.string()),
  postCopyPath: z.string(),
  hashtags: z.array(z.string()),
  stylePack: PlatformStylePackSchema,
  sourceCandidateId: z.string().nullable(),
  sourceTimestamps: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type SocialPackage = z.infer<typeof SocialPackageSchema>;

export function emptyTimeline(): Timeline {
  return {
    version: CUTROOM_VERSION,
    media: null,
    transcriptSegments: [],
    transcriptUntimedText: null,
    transcriptProvenance: null,
    warnings: [],
    silences: [],
    frames: [],
    windows: [],
    observations: [],
  };
}
