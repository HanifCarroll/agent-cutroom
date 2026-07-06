import { describe, expect, it } from "vitest";
import {
  buildPlatformExportFilter,
  defaultPlatformExportPath,
  platformRenderMatches,
} from "../src/core/platform-export.js";
import { PLATFORM_STYLE_PACKS } from "../src/core/style-packs.js";
import type { MediaInfo } from "../src/core/schema.js";

const matchingInstagramMedia: MediaInfo = {
  path: "renders/captioned.mp4",
  durationMs: 78_000,
  width: 1080,
  height: 1920,
  fps: 30,
  videoCodec: "h264",
  audioCodec: "aac",
  videoBitrateBps: 8_000_000,
  audioBitrateBps: 192_000,
  overallBitrateBps: 8_192_000,
  hasAudio: true,
  hasVideo: true,
  sizeBytes: 100,
  formatName: "mov,mp4",
};

describe("platform export", () => {
  it("matches media against the selected platform dimensions and fps", () => {
    expect(platformRenderMatches(matchingInstagramMedia, PLATFORM_STYLE_PACKS.instagram)).toBe(true);
    expect(
      platformRenderMatches(
        { ...matchingInstagramMedia, fps: 59.94 },
        PLATFORM_STYLE_PACKS.instagram,
      ),
    ).toBe(false);
    expect(
      platformRenderMatches(
        { ...matchingInstagramMedia, width: 2160, height: 3840 },
        PLATFORM_STYLE_PACKS.instagram,
      ),
    ).toBe(false);
    expect(
      platformRenderMatches(
        { ...matchingInstagramMedia, videoCodec: "hevc" },
        PLATFORM_STYLE_PACKS.instagram,
      ),
    ).toBe(false);
  });

  it("builds a cover-scale platform filter from the style pack", () => {
    expect(buildPlatformExportFilter(PLATFORM_STYLE_PACKS.linkedin)).toBe(
      "scale=1080:1350:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1350,fps=30,format=yuv420p",
    );
  });

  it("uses a stable default platform export path", () => {
    expect(defaultPlatformExportPath("youtube-shorts")).toBe("renders/platform-youtube-shorts.mp4");
  });
});
