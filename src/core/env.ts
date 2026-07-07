import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RuntimeEnvLoadResult = {
  loadedFiles: string[];
  missingFiles: string[];
  keys: string[];
};

type Env = Record<string, string | undefined>;

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function defaultSecretsPath(env: Env = process.env): string | undefined {
  const configHome = env.XDG_CONFIG_HOME ?? (env.HOME ? join(env.HOME, ".config") : undefined);
  if (!configHome) return undefined;
  return join(configHome, "agent-cutroom", "secrets.env");
}

export function runtimeEnvPaths(env: Env = process.env): string[] {
  const paths = [];
  if (env.AGENT_CUTROOM_SECRETS_FILE) paths.push(env.AGENT_CUTROOM_SECRETS_FILE);
  const defaultPath = defaultSecretsPath(env);
  if (defaultPath) paths.push(defaultPath);
  return [...new Set(paths)];
}

export function parseEnvFile(raw: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignment = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = assignment.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = assignment.slice(0, equalsIndex).trim();
    if (!KEY_PATTERN.test(key)) continue;

    let value = assignment.slice(equalsIndex + 1).trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value
        .slice(1, -1)
        .replaceAll("\\n", "\n")
        .replaceAll('\\"', '"')
        .replaceAll("\\\\", "\\");
    } else {
      value = value.replace(/\s+#.*$/, "");
    }

    values[key] = value;
  }

  return values;
}

export async function loadRuntimeEnv(env: Env = process.env): Promise<RuntimeEnvLoadResult> {
  const result: RuntimeEnvLoadResult = { loadedFiles: [], missingFiles: [], keys: [] };

  for (const path of runtimeEnvPaths(env)) {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        result.missingFiles.push(path);
        continue;
      }
      throw error;
    }

    result.loadedFiles.push(path);
    for (const [key, value] of Object.entries(parseEnvFile(raw))) {
      if (env[key] === undefined) {
        env[key] = value;
        result.keys.push(key);
      }
    }
  }

  return result;
}
