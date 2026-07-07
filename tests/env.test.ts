import { describe, expect, it } from "vitest";
import { defaultSecretsPath, parseEnvFile, runtimeEnvPaths } from "../src/core/env.js";

describe("runtime env loading", () => {
  it("uses the standard local secrets path", () => {
    expect(defaultSecretsPath({ HOME: "/home/alex" })).toBe(
      "/home/alex/.config/agent-cutroom/secrets.env",
    );
    expect(defaultSecretsPath({ XDG_CONFIG_HOME: "/tmp/config", HOME: "/home/alex" })).toBe(
      "/tmp/config/agent-cutroom/secrets.env",
    );
  });

  it("loads an override path before the standard path", () => {
    expect(
      runtimeEnvPaths({
        HOME: "/home/alex",
        AGENT_CUTROOM_SECRETS_FILE: "/tmp/custom.env",
      }),
    ).toEqual(["/tmp/custom.env", "/home/alex/.config/agent-cutroom/secrets.env"]);
  });

  it("parses shell-style key value files", () => {
    expect(
      parseEnvFile(`
        # comment
        PEXELS_API_KEY=abc123
        export QUOTED="hello\\nworld"
        SINGLE='literal value'
        SPACED=value # inline comment
        invalid-key=skip
      `),
    ).toEqual({
      PEXELS_API_KEY: "abc123",
      QUOTED: "hello\nworld",
      SINGLE: "literal value",
      SPACED: "value",
    });
  });
});
