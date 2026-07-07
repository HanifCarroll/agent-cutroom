import { describe, expect, it } from "vitest";
import {
  buildMusicMixFilter,
  buildMusicPayload,
  buildMusicRequest,
  resolveMusicConfig,
  tracksFromResponse,
} from "../src/core/music.js";

describe("music generation helpers", () => {
  it("builds an EvoLink-compatible music payload without leaking keys", () => {
    const request = buildMusicRequest(
      {
        prompt: "Instrumental warm minimal electronic bed for a talking-head edit.",
        style: "minimal electronic, warm, 92 bpm",
        title: "Cutroom Cue",
        negativeTags: "vocals, heavy drums",
        customMode: true,
        instrumental: true,
      },
      {
        EVOLINK_API_KEY: "secret",
        EVOLINK_API_BASE_URL: "https://api.evolink.ai/",
        SUNO_MODEL: "suno-v5-beta",
      },
    );

    expect(request.baseUrl).toBe("https://api.evolink.ai");
    expect(request.model).toBe("suno-v5-beta");
    expect(JSON.stringify(request)).not.toContain("secret");
    expect(buildMusicPayload(request)).toMatchObject({
      model: "suno-v5-beta",
      custom_mode: true,
      instrumental: true,
      prompt: "Instrumental warm minimal electronic bed for a talking-head edit.",
      style: "minimal electronic, warm, 92 bpm",
      title: "Cutroom Cue",
      negative_tags: "vocals, heavy drums",
    });
  });

  it("resolves key, base URL, and model from Suno or EvoLink env vars", () => {
    expect(
      resolveMusicConfig(
        {},
        {
          SUNO_API_KEY: "suno-key",
          SUNO_API_BASE_URL: "https://music.example.com/",
          SUNO_MODEL: "suno-v4.5-beta",
        },
      ),
    ).toEqual({
      provider: "evolink",
      baseUrl: "https://music.example.com",
      model: "suno-v4.5-beta",
      apiKey: "suno-key",
    });
  });

  it("extracts tracks from completed task responses", () => {
    expect(
      tracksFromResponse({
        status: "completed",
        result_data: [
          {
            result_id: "abc",
            title: "Cue",
            tags: "warm, minimal",
            duration: 42,
            audio_url: "https://example.com/cue.mp3",
            image_url: "https://example.com/cue.jpg",
          },
        ],
      }),
    ).toEqual([
      {
        id: "abc",
        title: "Cue",
        tags: "warm, minimal",
        durationSeconds: 42,
        audioUrl: "https://example.com/cue.mp3",
        imageUrl: "https://example.com/cue.jpg",
        localPath: null,
      },
    ]);

    expect(tracksFromResponse({ results: ["https://example.com/fallback.mp3"] })[0]).toMatchObject({
      id: "track-001",
      audioUrl: "https://example.com/fallback.mp3",
    });
  });

  it("mixes generated music without lowering the original speech track", () => {
    const musicFilter = "[1:a]volume=0.12[music]";

    expect(buildMusicMixFilter(musicFilter, true)).toBe(
      "[1:a]volume=0.12[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
    );
    expect(buildMusicMixFilter(musicFilter, false)).toBe(musicFilter);
  });
});
