import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MCP server", () => {
  it("lists tools, prompts, and handles a simple tool call", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["src/mcp/server.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
    });
    const client = new Client({ name: "agent-cutroom-test", version: "0.1.0" });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["doctor", "prepare_project", "caption", "social_package", "export_otio"]),
      );
      expect(tools.tools.length).toBe(11);

      const prompts = await client.listPrompts();
      expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
        expect.arrayContaining(["review-footage", "package-for-social"]),
      );

      const result = await client.callTool({ name: "doctor", arguments: {} });
      expect(result.content[0]).toMatchObject({ type: "text" });
      expect(JSON.stringify(result.structuredContent)).toContain("ffmpeg");

      const invalid = await client.callTool({ name: "prepare_project", arguments: {} });
      expect(invalid.isError).toBe(true);
      expect(JSON.stringify(invalid.content)).toContain("project");
    } finally {
      await client.close();
    }
  }, 20_000);
});
