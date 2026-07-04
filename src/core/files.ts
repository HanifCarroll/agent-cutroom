import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { z } from "zod";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readJson<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await readFile(path, "utf8");
  return schema.parse(JSON.parse(raw));
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function absolute(path: string): string {
  return resolve(path);
}
