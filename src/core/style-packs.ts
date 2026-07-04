import type { CaptionStyle, Platform, PlatformStylePack } from "./schema.js";

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  id: "bold-active-word",
  name: "Bold active word",
  fontName: "Arial",
  fontSize: 66,
  primaryColor: "&H00FFFFFF",
  activeColor: "&H0000E5FF",
  outlineColor: "&H00141414",
  backColor: "&H80000000",
  outline: 4,
  shadow: 0,
  alignment: 2,
  marginL: 80,
  marginR: 80,
  marginV: 220,
  maxWordsPerLine: 6,
  maxLines: 2,
};

export const PLATFORM_STYLE_PACKS: Record<Platform, PlatformStylePack> = {
  instagram: {
    id: "instagram-reels-vertical",
    platform: "instagram",
    width: 1080,
    height: 1920,
    fps: 30,
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
    videoBitrate: "6M",
    audioBitrate: "192k",
    safeZone: { topPct: 0.08, bottomPct: 0.12, leftPct: 0.06, rightPct: 0.06 },
    caption: { ...DEFAULT_CAPTION_STYLE, fontSize: 56, marginV: 160 },
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
