import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { secondsToMs } from "./time.js";
import type { TranscriptSegment, TranscriptWord } from "./schema.js";

export interface LoadedTranscript {
  segments: TranscriptSegment[];
  untimedText: string | null;
  warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function msValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

function secondsValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? secondsToMs(value)
    : null;
}

function offsetMsValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

function probabilityValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}

function parseWord(raw: unknown, segmentIndex: number, wordIndex: number): TranscriptWord | null {
  if (!isObject(raw)) return null;
  const text = textValue(raw.text) ?? textValue(raw.word);
  if (!text) return null;
  const startMs = msValue(raw.startMs) ?? secondsValue(raw.start);
  const endMs = msValue(raw.endMs) ?? secondsValue(raw.end);
  if (startMs === null || endMs === null || endMs < startMs) return null;
  return {
    id:
      textValue(raw.id) ??
      `seg-${String(segmentIndex + 1).padStart(4, "0")}-word-${String(wordIndex + 1).padStart(3, "0")}`,
    startMs,
    endMs,
    text,
    probability: probabilityValue(raw.probability),
  };
}

function parseSegment(raw: unknown, index: number): TranscriptSegment | null {
  if (!isObject(raw)) return null;
  const text = textValue(raw.text);
  if (!text) return null;
  const startMs = msValue(raw.startMs) ?? secondsValue(raw.start);
  const endMs = msValue(raw.endMs) ?? secondsValue(raw.end);
  if (startMs === null || endMs === null || endMs < startMs) return null;
  const words = Array.isArray(raw.words)
    ? raw.words
        .map((word, wordIndex) => parseWord(word, index, wordIndex))
        .filter((word): word is TranscriptWord => Boolean(word))
    : [];
  return {
    id: textValue(raw.id) ?? `seg-${String(index + 1).padStart(4, "0")}`,
    startMs,
    endMs,
    text,
    words,
  };
}

function parseWhisperCppSegment(raw: unknown, index: number): TranscriptSegment | null {
  if (!isObject(raw)) return null;
  const text = textValue(raw.text);
  const offsets = isObject(raw.offsets) ? raw.offsets : null;
  if (!text || !offsets) return null;
  const startMs = offsetMsValue(offsets.from);
  const endMs = offsetMsValue(offsets.to);
  if (startMs === null || endMs === null || endMs < startMs) return null;
  return {
    id: textValue(raw.id) ?? `seg-${String(index + 1).padStart(4, "0")}`,
    startMs,
    endMs,
    text,
    words: [],
  };
}

export async function loadTranscript(path: string): Promise<LoadedTranscript> {
  const raw = await readFile(path, "utf8");
  if (extname(path).toLowerCase() === ".txt") {
    return {
      segments: [],
      untimedText: raw.trim() || null,
      warnings: [
        "Transcript is plain text, so no timestamped transcript segments were imported.",
      ],
    };
  }

  const parsed = JSON.parse(raw) as unknown;
  const sourceSegments = Array.isArray(parsed)
    ? { kind: "seconds", values: parsed }
    : isObject(parsed) && Array.isArray(parsed.segments)
      ? { kind: "seconds", values: parsed.segments }
      : isObject(parsed) && Array.isArray(parsed.transcription)
        ? { kind: "offsets", values: parsed.transcription }
        : { kind: "seconds", values: [] };
  const segments = sourceSegments.values
    .map((segment, index) =>
      sourceSegments.kind === "offsets"
        ? parseWhisperCppSegment(segment, index)
        : parseSegment(segment, index),
    )
    .filter((segment): segment is TranscriptSegment => Boolean(segment));

  const untimedText =
    isObject(parsed) && typeof parsed.text === "string" ? parsed.text.trim() : null;
  const warnings: string[] = [];
  if (sourceSegments.values.length > 0 && segments.length !== sourceSegments.values.length) {
    warnings.push(
      `Imported ${segments.length} of ${sourceSegments.values.length} transcript segments; skipped segments were missing text/start/end.`,
    );
  }
  if (sourceSegments.values.length === 0 && untimedText) {
    warnings.push(
      "Transcript JSON has text but no timestamped segments; imported untimed text only.",
    );
  }
  return {
    segments,
    untimedText,
    warnings,
  };
}
