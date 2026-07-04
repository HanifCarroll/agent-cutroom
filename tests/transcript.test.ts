import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadTranscript } from "../src/core/transcript.js";

describe("loadTranscript", () => {
  it("loads timestamped JSON segments", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-cutroom-test-"));
    try {
      const path = join(dir, "transcript.json");
      await writeFile(
        path,
        JSON.stringify({
          segments: [
            { start: 0, end: 1.2, text: "first" },
            { startMs: 1500, endMs: 2500, text: "second" },
          ],
          text: "first second",
        }),
      );
      const loaded = await loadTranscript(path);
      expect(loaded.segments).toEqual([
        { id: "seg-0001", startMs: 0, endMs: 1200, text: "first" },
        { id: "seg-0002", startMs: 1500, endMs: 2500, text: "second" },
      ]);
      expect(loaded.warnings).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps plain text as untimed text instead of inventing timestamps", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-cutroom-test-"));
    try {
      const path = join(dir, "transcript.txt");
      await writeFile(path, "plain words");
      const loaded = await loadTranscript(path);
      expect(loaded.segments).toEqual([]);
      expect(loaded.untimedText).toBe("plain words");
      expect(loaded.warnings[0]).toContain("plain text");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads whisper.cpp JSON transcription offsets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-cutroom-test-"));
    try {
      const path = join(dir, "transcript.json");
      await writeFile(
        path,
        JSON.stringify({
          transcription: [
            {
              offsets: { from: 1500, to: 2750 },
              text: " short clip ",
            },
          ],
        }),
      );
      const loaded = await loadTranscript(path);
      expect(loaded.segments).toEqual([
        { id: "seg-0001", startMs: 1500, endMs: 2750, text: "short clip" },
      ]);
      expect(loaded.warnings).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
