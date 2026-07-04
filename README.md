# Agent Cutroom

Agent Cutroom gives ChatGPT Codex and other coding agents a local toolbelt for video review and editing.

The agent makes the editorial decisions. The CLI handles deterministic media work: probing videos, importing timestamped transcripts, detecting silence, extracting frames/contact sheets, writing review packs, recording agent observations, creating edit plans, and rendering rough cuts with FFmpeg.

## Why This Exists

Most video tools hide the timeline inside a UI. Agent Cutroom exposes the timeline as files an agent can inspect and edit:

```txt
raw video + transcript
  -> timeline.json
  -> frames/contact-sheets
  -> review/review-pack.md
  -> agent observations
  -> edit-plan.json
  -> renders/rough-cut.mp4
```

This is designed for workflows where Codex is the editor/producer and needs tools to see, reason about, and render video.

## Requirements

- Node.js 22+
- pnpm
- FFmpeg and ffprobe on `PATH`

Check your machine:

```sh
pnpm install
pnpm build
node dist/cli/index.js doctor
```

## Quick Start

```sh
pnpm install
pnpm build

node dist/cli/index.js init ./input.mp4 --transcript ./transcript.json --out ./my-cut --title "My Cut"
node dist/cli/index.js prepare ./my-cut
open ./my-cut/review/review-pack.md
```

After inspecting the frames/contact sheet, record observations:

```sh
node dist/cli/index.js observe ./my-cut \
  --window window-001 \
  --summary "Talking head over a dashboard; the screen supports the spoken point." \
  --visible-text "Dashboard, Export, Revenue" \
  --editing-use keep \
  --broll none \
  --note "Good opening section."
```

Create and render a rough cut:

```sh
node dist/cli/index.js plan ./my-cut
node dist/cli/index.js render ./my-cut
```

Generate a HyperFrames brief for the polish pass:

```sh
node dist/cli/index.js hyperframes-brief ./my-cut
```

## Commands

```txt
agent-cutroom doctor
agent-cutroom init <video> --out <dir> [--transcript <path>] [--title <title>]
agent-cutroom probe <project>
agent-cutroom transcript <project>
agent-cutroom silence <project>
agent-cutroom frames <project>
agent-cutroom review-pack <project>
agent-cutroom prepare <project>
agent-cutroom observe <project> --window <id> --summary <text>
agent-cutroom plan <project>
agent-cutroom render <project>
agent-cutroom hyperframes-brief <project>
```

## Transcript Format

Agent Cutroom imports timestamped JSON transcripts. It supports Whisper-like segments:

```json
{
  "segments": [
    { "start": 0.0, "end": 2.4, "text": "Here is the opening idea." }
  ],
  "text": "Here is the opening idea."
}
```

It also supports millisecond fields:

```json
{
  "segments": [
    { "startMs": 0, "endMs": 2400, "text": "Here is the opening idea." }
  ]
}
```

Plain text transcripts are stored as untimed text with a warning. The CLI does not invent timestamps.

## How Vision Works

There is no separate OCR service or hidden vision model.

The `frames` command extracts JPEG frames and a contact sheet. The running agent inspects those images directly, then writes observations through `agent-cutroom observe`. Those observations become timeline metadata used by `plan`, `render`, and `hyperframes-brief`.

## HyperFrames Fit

Agent Cutroom owns the raw footage workflow: timeline metadata, transcript, frames, silence, agent observations, rough cuts.

HyperFrames fits after the rough cut, when the agent wants a polished composition with captions, title cards, lower thirds, callouts, pull quotes, B-roll layouts, or social-ready packaging. `agent-cutroom hyperframes-brief` exports the timeline context needed for that pass.

## Dogfood Fixtures

The repo includes a reproducible sample-media script:

```sh
examples/dogfood/scripts/make-sample-media.sh
```

Generated media and project outputs are ignored by git.

See [docs/dogfood-report.md](docs/dogfood-report.md) for the first local dogfood run and verification results.

## Development

```sh
pnpm install
pnpm check
pnpm build
```

## Status

This is an early public prototype. The stable contract is the file-based workflow: `cutroom.json`, `timeline.json`, `review/review-pack.md`, `edit-plan.json`, and rendered outputs.
