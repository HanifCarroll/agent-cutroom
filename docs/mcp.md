# MCP Server

Agent Cutroom includes a local stdio MCP server. The MCP server is a thin wrapper over the CLI: tools call the same commands, and artifact links resolve project files through MCP resources.

## Run

```sh
bun run build
agent-cutroom-mcp
```

From a checkout:

```sh
bun dist/mcp/server.js
```

## Tools

The server exposes 14 always-visible tools:

- `doctor`
- `init_project`
- `prepare_project`
- `record_observation`
- `plan_render`
- `find_moments`
- `caption`
- `verify`
- `social_package`
- `music_submit`
- `music_poll`
- `music_mix`
- `export_otio`
- `hyperframes_brief`

The tool surface is intentionally small. Preparation subcommands such as probe, silence, frames, transcript import, and review-pack generation are grouped under `prepare_project`.

## Resources

Tools return `cutroom://artifact/{token}` resource links for project artifacts such as:

- `cutroom.json`
- `timeline.json`
- `review/review-pack.md`
- `analysis/highlight-candidates.json`
- `edit-plan.json`
- `plans/caption-plan.json`
- `renders/verify-report.json`
- `plans/social-package.json`
- `plans/music-generation.json`
- `plans/music-mix.json`
- `exports/edit.otio`
- `hyperframes/brief.md`

The resource reader only serves paths inside the encoded project directory.

## Prompts

- `review-footage`: prepare and inspect footage, then record observations.
- `package-for-social`: find candidate moments, caption, verify, and package a social render.

## Verification

Use the SDK client or an MCP-compatible client to verify:

- `initialize`
- `tools/list`
- a happy-path tool call such as `doctor`
- a validation-error tool call with missing required input
- `prompts/list`
- `prompts/get`
- reading a returned artifact resource after a project tool call
