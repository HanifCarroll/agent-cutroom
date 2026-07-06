import type { CaptionStyle, Platform, PlatformStylePack } from "./schema.js";

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  id: "single-word-pop",
  name: "Single word pop",
  fontName: "Arial Black",
  fontSize: 112,
  primaryColor: "&H00FFFFFF",
  activeColor: "&H00FFFFFF",
  outlineColor: "&H00141414",
  backColor: "&H80000000",
  outline: 7,
  shadow: 0,
  alignment: 2,
  marginL: 80,
  marginR: 80,
  marginV: 180,
  maxWordsPerLine: 1,
  maxLines: 1,
};

export const PLATFORM_STYLE_PACKS: Record<Platform, PlatformStylePack> = {
  instagram: {
    id: "instagram-reels-vertical",
    platform: "instagram",
    width: 1080,
    height: 1920,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "8M",
    audioBitrate: "192k",
    safeZone: { topPct: 0.12, bottomPct: 0.18, leftPct: 0.07, rightPct: 0.07 },
    caption: DEFAULT_CAPTION_STYLE,
    notes: [
      "Use 9:16 vertical video.",
      "Keep active-word captions away from the face and bottom UI controls.",
      "Use a clear first frame and a complete single moment.",
    ],
  },
  tiktok: {
    id: "tiktok-vertical",
    platform: "tiktok",
    width: 1080,
    height: 1920,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "8M",
    audioBitrate: "192k",
    safeZone: { topPct: 0.14, bottomPct: 0.2, leftPct: 0.08, rightPct: 0.1 },
    caption: DEFAULT_CAPTION_STYLE,
    notes: [
      "Use 9:16 vertical video.",
      "Make the first three seconds understandable without extra context.",
      "Keep overlay text short and readable on a phone.",
    ],
  },
  "youtube-shorts": {
    id: "youtube-shorts-vertical",
    platform: "youtube-shorts",
    width: 1080,
    height: 1920,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "8M",
    audioBitrate: "192k",
    safeZone: { topPct: 0.12, bottomPct: 0.18, leftPct: 0.07, rightPct: 0.07 },
    caption: DEFAULT_CAPTION_STYLE,
    notes: [
      "Use 9:16 vertical video.",
      "Make the first spoken line carry the hook.",
      "Keep the clip concise and self-contained.",
    ],
  },
  linkedin: {
    id: "linkedin-feed-video",
    platform: "linkedin",
    width: 1080,
    height: 1350,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "6M",
    audioBitrate: "192k",
    safeZone: { topPct: 0.08, bottomPct: 0.12, leftPct: 0.06, rightPct: 0.06 },
    caption: { ...DEFAULT_CAPTION_STYLE, fontSize: 96, marginV: 150 },
    notes: [
      "Use concise business-context captions.",
      "Prefer one complete point over a fast montage.",
      "Include post copy with source context.",
    ],
  },
};

export function getPlatformStylePack(platform: Platform): PlatformStylePack {
  return PLATFORM_STYLE_PACKS[platform];
}
