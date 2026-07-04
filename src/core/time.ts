export function msToSeconds(ms: number): number {
  return Math.max(0, Math.round(ms) / 1000);
}

export function secondsToMs(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

export function formatTimestamp(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const h = hours > 0 ? `${hours}:` : "";
  const m = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const s = String(seconds).padStart(2, "0");
  return `${h}${m}:${s}.${String(millis).padStart(3, "0")}`;
}

export function parseTimestampToMs(raw: string): number {
  const value = raw.trim();
  if (!value) throw new Error("Timestamp is empty.");
  if (/^\d+(\.\d+)?$/.test(value)) {
    return secondsToMs(Number(value));
  }
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Unsupported timestamp: ${raw}`);
  }
  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![seconds, minutes, hours].every(Number.isFinite)) {
    throw new Error(`Unsupported timestamp: ${raw}`);
  }
  return secondsToMs(hours * 3600 + minutes * 60 + seconds);
}
