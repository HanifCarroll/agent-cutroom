import type { CutroomManifest, EditPlan } from "./schema.js";

function rationalTime(value: number, rate = 1000): Record<string, unknown> {
  return {
    OTIO_SCHEMA: "RationalTime.1",
    value,
    rate,
  };
}

function timeRange(startMs: number, durationMs: number): Record<string, unknown> {
  return {
    OTIO_SCHEMA: "TimeRange.1",
    start_time: rationalTime(startMs),
    duration: rationalTime(durationMs),
  };
}

export function createOtioTimeline({
  manifest,
  editPlan,
}: {
  manifest: CutroomManifest;
  editPlan: EditPlan;
}): Record<string, unknown> {
  return {
    OTIO_SCHEMA: "Timeline.1",
    name: manifest.title,
    metadata: {
      agent_cutroom: {
        version: manifest.version,
        created_at: new Date().toISOString(),
        edit_plan_created_at: editPlan.createdAt,
      },
    },
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      name: "tracks",
      children: [
        {
          OTIO_SCHEMA: "Track.1",
          name: "Video",
          kind: "Video",
          children: editPlan.segments.map((segment) => ({
            OTIO_SCHEMA: "Clip.2",
            name: segment.id,
            source_range: timeRange(
              segment.sourceStartMs,
              segment.sourceEndMs - segment.sourceStartMs,
            ),
            media_reference: {
              OTIO_SCHEMA: "ExternalReference.1",
              target_url: manifest.sourcePath,
              available_range: timeRange(0, segment.sourceEndMs),
              metadata: {
                reason: segment.reason,
                source_window_ids: segment.sourceWindowIds,
                evidence: segment.evidence,
                warnings: segment.warnings,
              },
            },
            metadata: {
              agent_cutroom: {
                reason: segment.reason,
                source_window_ids: segment.sourceWindowIds,
                confidence: segment.confidence,
                evidence: segment.evidence,
                warnings: segment.warnings,
              },
            },
          })),
        },
      ],
    },
  };
}
