import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { ffprobeMedia } from "./ffmpeg.js";
import { readJson, writeJson } from "./files.js";
import { musicGenerationPath, musicMixPath } from "./project.js";
import { runCommand } from "./process.js";
import {
  CUTROOM_VERSION,
  MusicGenerationSchema,
  type MusicGeneration,
  type MusicProvider,
  type MusicRequest,
  type MusicTrack,
  type MusicMix,
} from "./schema.js";

const DEFAULT_BASE_URL = "https://api.evolink.ai";
const DEFAULT_MODEL = "suno-v5-beta";

type Env = Record<string, string | undefined>;

export type MusicConfig = {
  provider: MusicProvider;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
};

export type MusicSubmitOptions = {
  provider?: MusicProvider;
  baseUrl?: string;
  model?: string;
  prompt: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  callbackUrl?: string;
  customMode: boolean;
  instrumental: boolean;
};

export type MusicPollOptions = {
  taskId?: string;
  download: boolean;
};

export type MusicMixOptions = {
  targetPath: string;
  trackPath: string;
  outputPath: string;
  musicVolume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
};

export function buildMusicMixFilter(musicFilter: string, hasTargetAudio: boolean): string {
  return hasTargetAudio
    ? `${musicFilter};[0:a][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`
    : musicFilter;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveMusicConfig(options: {
  provider?: MusicProvider;
  baseUrl?: string;
  model?: string;
}, env: Env = process.env): MusicConfig {
  return {
    provider: options.provider ?? "evolink",
    baseUrl: stripTrailingSlash(options.baseUrl ?? env.SUNO_API_BASE_URL ?? env.EVOLINK_API_BASE_URL ?? DEFAULT_BASE_URL),
    model: options.model ?? env.SUNO_MODEL ?? DEFAULT_MODEL,
    apiKey: env.SUNO_API_KEY ?? env.EVOLINK_API_KEY,
  };
}

export function buildMusicRequest(options: MusicSubmitOptions, env: Env = process.env): MusicRequest {
  const config = resolveMusicConfig(options, env);
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    customMode: options.customMode,
    instrumental: options.instrumental,
    prompt: options.prompt,
    style: options.style ?? null,
    title: options.title ?? null,
    negativeTags: options.negativeTags ?? null,
    callbackUrl: options.callbackUrl ?? null,
  };
}

export function buildMusicPayload(request: MusicRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: request.model,
    custom_mode: request.customMode,
    instrumental: request.instrumental,
    prompt: request.prompt,
  };
  if (request.style) payload.style = request.style;
  if (request.title) payload.title = request.title;
  if (request.negativeTags) payload.negative_tags = request.negativeTags;
  if (request.callbackUrl) payload.callback_url = request.callbackUrl;
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function taskIdFromResponse(response: unknown): string {
  if (!isRecord(response)) throw new Error("Music API response was not an object.");
  const id = stringValue(response.id) ?? stringValue(response.task_id) ?? stringValue(response.taskId);
  if (!id) throw new Error("Music API response did not include a task id.");
  return id;
}

function statusFromResponse(response: unknown): string {
  if (!isRecord(response)) return "unknown";
  return stringValue(response.status) ?? stringValue(response.state) ?? "unknown";
}

function progressFromResponse(response: unknown): number | null {
  if (!isRecord(response)) return null;
  const progress = numberValue(response.progress);
  if (progress === null) return null;
  return Math.max(0, Math.min(100, progress));
}

function tracksFromResultData(resultData: unknown): MusicTrack[] {
  if (!Array.isArray(resultData)) return [];
  return resultData.filter(isRecord).map((item, index) => ({
    id:
      stringValue(item.result_id) ??
      stringValue(item.id) ??
      `track-${String(index + 1).padStart(3, "0")}`,
    title: stringValue(item.title),
    tags: stringValue(item.tags),
    durationSeconds: numberValue(item.duration),
    audioUrl: stringValue(item.audio_url),
    imageUrl: stringValue(item.image_url),
    localPath: null,
  }));
}

function tracksFromResults(results: unknown): MusicTrack[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => typeof value === "string")
    .map(({ value, index }) => ({
      id: `track-${String(index + 1).padStart(3, "0")}`,
      title: null,
      tags: null,
      durationSeconds: null,
      audioUrl: value as string,
      imageUrl: null,
      localPath: null,
    }));
}

export function tracksFromResponse(response: unknown): MusicTrack[] {
  if (!isRecord(response)) return [];
  const resultDataTracks = tracksFromResultData(response.result_data);
  if (resultDataTracks.length > 0) return resultDataTracks;
  return tracksFromResults(response.results);
}

async function requestJson(url: string, apiKey: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Music API request failed ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

export async function submitMusicGeneration(
  projectDir: string,
  options: MusicSubmitOptions,
): Promise<MusicGeneration> {
  const config = resolveMusicConfig(options);
  if (!config.apiKey) {
    throw new Error("Missing SUNO_API_KEY or EVOLINK_API_KEY.");
  }
  const request = buildMusicRequest(options);
  const endpoint = `${request.baseUrl}/v1/audios/generations`;
  const rawResponse = await requestJson(endpoint, config.apiKey, {
    method: "POST",
    body: JSON.stringify(buildMusicPayload(request)),
  });
  const now = new Date().toISOString();
  const generation: MusicGeneration = {
    version: CUTROOM_VERSION,
    createdAt: now,
    updatedAt: now,
    taskId: taskIdFromResponse(rawResponse),
    status: statusFromResponse(rawResponse),
    progress: progressFromResponse(rawResponse),
    endpoint,
    request,
    tracks: tracksFromResponse(rawResponse),
    rawResponse,
    warnings: [],
  };
  await writeJson(musicGenerationPath(projectDir), generation);
  return generation;
}

export async function pollMusicGeneration(
  projectDir: string,
  options: MusicPollOptions,
): Promise<MusicGeneration> {
  const existing = await readJson(musicGenerationPath(projectDir), MusicGenerationSchema);
  const config = resolveMusicConfig({
    provider: existing.request.provider,
    baseUrl: existing.request.baseUrl,
    model: existing.request.model,
  });
  if (!config.apiKey) {
    throw new Error("Missing SUNO_API_KEY or EVOLINK_API_KEY.");
  }
  const taskId = options.taskId ?? existing.taskId;
  const rawResponse = await requestJson(`${existing.request.baseUrl}/v1/tasks/${taskId}`, config.apiKey);
  const tracks = mergeTracks(existing.tracks, tracksFromResponse(rawResponse));
  let generation: MusicGeneration = {
    ...existing,
    updatedAt: new Date().toISOString(),
    taskId,
    status: statusFromResponse(rawResponse),
    progress: progressFromResponse(rawResponse),
    tracks,
    rawResponse,
  };
  if (options.download) {
    generation = await downloadMusicTracks(projectDir, generation);
  } else {
    await writeJson(musicGenerationPath(projectDir), generation);
  }
  return generation;
}

function mergeTracks(previous: MusicTrack[], next: MusicTrack[]): MusicTrack[] {
  if (next.length === 0) return previous;
  const previousById = new Map(previous.map((track) => [track.id, track]));
  return next.map((track) => ({ ...track, localPath: previousById.get(track.id)?.localPath ?? track.localPath }));
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = extname(pathname);
    return extension || ".mp3";
  } catch {
    return ".mp3";
  }
}

export async function downloadMusicTracks(
  projectDir: string,
  generation: MusicGeneration,
): Promise<MusicGeneration> {
  await mkdir(resolve(projectDir, "assets/music"), { recursive: true });
  const tracks: MusicTrack[] = [];
  for (const [index, track] of generation.tracks.entries()) {
    if (!track.audioUrl || track.localPath) {
      tracks.push(track);
      continue;
    }
    const response = await fetch(track.audioUrl);
    if (!response.ok) {
      tracks.push(track);
      generation.warnings.push(`Failed to download ${track.id}: ${response.status}`);
      continue;
    }
    const extension = extensionFromUrl(track.audioUrl);
    const safeId = track.id.replace(/[^a-zA-Z0-9_-]/g, "-") || `track-${index + 1}`;
    const localPath = `assets/music/${safeId}${extension}`;
    await writeFile(resolve(projectDir, localPath), Buffer.from(await response.arrayBuffer()));
    tracks.push({ ...track, localPath });
  }
  const updated = {
    ...generation,
    updatedAt: new Date().toISOString(),
    tracks,
  };
  await writeJson(musicGenerationPath(projectDir), updated);
  return updated;
}

export async function createMusicMix(
  projectDir: string,
  options: MusicMixOptions,
): Promise<MusicMix> {
  const media = await ffprobeMedia(projectDir, options.targetPath);
  const durationSeconds = Math.max(0.1, media.durationMs / 1000);
  const fadeOutStart = Math.max(0, durationSeconds - options.fadeOutSeconds);
  const target = resolve(projectDir, options.targetPath);
  const track = resolve(projectDir, options.trackPath);
  const output = resolve(projectDir, options.outputPath);
  await mkdir(resolve(projectDir, "renders"), { recursive: true });

  const musicFilter = `[1:a]volume=${options.musicVolume},afade=t=in:st=0:d=${options.fadeInSeconds},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${options.fadeOutSeconds}[music]`;
  const filter = buildMusicMixFilter(musicFilter, media.hasAudio);
  const args = [
    "-y",
    "-i",
    target,
    "-stream_loop",
    "-1",
    "-i",
    track,
    "-filter_complex",
    filter,
    "-map",
    "0:v:0",
    "-map",
    media.hasAudio ? "[a]" : "[music]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    output,
  ];
  await runCommand("ffmpeg", args);

  const mix: MusicMix = {
    version: CUTROOM_VERSION,
    createdAt: new Date().toISOString(),
    targetPath: options.targetPath,
    trackPath: options.trackPath,
    outputPath: options.outputPath,
    musicVolume: options.musicVolume,
    fadeInSeconds: options.fadeInSeconds,
    fadeOutSeconds: options.fadeOutSeconds,
    sourceDurationMs: media.durationMs,
    warnings: basename(options.trackPath).toLowerCase().includes("vocal")
      ? ["Track filename suggests vocals; verify it does not compete with speech."]
      : [],
  };
  await writeJson(musicMixPath(projectDir), mix);
  return mix;
}
