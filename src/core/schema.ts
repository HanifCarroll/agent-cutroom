import { z } from "zod";

export const CUTROOM_VERSION = 1;

export const MsSchema = z.number().int().nonnegative();

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  startMs: MsSchema,
  endMs: MsSchema,
  text: z.string(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

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

export function emptyTimeline(): Timeline {
  return {
    version: CUTROOM_VERSION,
    media: null,
    transcriptSegments: [],
    transcriptUntimedText: null,
    warnings: [],
    silences: [],
    frames: [],
    windows: [],
    observations: [],
  };
}
