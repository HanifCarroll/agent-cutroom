# Agent Cutroom

Agent Cutroom gives ChatGPT Codex and other coding agents a local toolbelt for video review and editing.

The agent makes the editorial decisions. The CLI handles deterministic media work: probing videos, generating/importing timestamped transcripts through `transcribe-audio`, detecting silence, extracting frames/contact sheets, writing review packs, recording agent observations, finding candidate moments, creating edit plans, rendering rough cuts, burning word-timed captions, verifying renders, packaging social outputs, generating and mixing AI music cues, exporting OTIO, and preparing HyperFrames briefs.

## Why This Exists

Most video tools hide the timeline inside a UI. Agent Cutroom exposes the timeline as files an agent can inspect and edit:

```txt
raw video + transcript
  -> timeline.json
  -> transcript/raw txt+json
  -> frames/contact-sheets
  -> review/review-pack.md
  -> review/content-inventory.md
  -> agent observations
  -> analysis/highlight-candidates.json
  -> analysis/story-candidates.json
  -> analysis/story-selection.md
  -> edit-plan.json
  -> renders/rough-cut.mp4
  -> captions/captions.ass
  -> renders/captioned.mp4
  -> renders/verify-report.json
  -> plans/social-package.json
  -> plans/music-generation.json
  -> assets/music/
  -> plans/music-mix.json
  -> exports/edit.otio
  -> HyperFrames polish pass
```

This is designed for workflows where Codex is the editor/producer and needs tools to see, reason about, and render video.

## Requirements

- Bun 1.3+
- FFmpeg and ffprobe on `PATH`
- Optional for generated transcripts: [`transcribe-audio`](https://github.com/HanifCarroll/transcribe-audio) on `PATH`
- Optional for stock B-roll: `PEXELS_API_KEY` in the environment or `~/.config/agent-cutroom/secrets.env`
- Optional for AI music: `SUNO_API_KEY` or `EVOLINK_API_KEY` in the environment or `~/.config/agent-cutroom/secrets.env`

Check your machine:

```sh
bun install
bun run build
bun dist/cli/index.js doctor
```

Agent Cutroom automatically loads local secrets from:

```sh
~/.config/agent-cutroom/secrets.env
```

For example:

```sh
PEXELS_API_KEY=...
SUNO_API_KEY=...
# or EVOLINK_API_KEY=...
```

Already-exported environment variables take precedence. Set `AGENT_CUTROOM_SECRETS_FILE` to point at a different secrets file.

## Quick Start

```sh
bun install
bun run build

bun dist/cli/index.js init ./input.mp4 --transcript ./transcript.json --out ./my-cut --title "My Cut"
bun dist/cli/index.js prepare ./my-cut
open ./my-cut/review/review-pack.md
```

For Hanif's own talking-head videos, use the opinionated content package path:

```sh
bun dist/cli/index.js init ./input.mov \
  --transcript ./transcript.json \
  --out ./my-cut \
  --title "First Tripod Video" \
  --link-source
bun dist/cli/index.js prepare ./my-cut
bun dist/cli/index.js hanif-content-package ./my-cut
open ./my-cut/review/content-inventory.md
open ./my-cut/analysis/story-selection.md
bun dist/cli/index.js render ./my-cut
bun dist/cli/index.js caption ./my-cut
bun dist/cli/index.js verify ./my-cut
bun dist/cli/index.js social-package ./my-cut --platform linkedin
```

`hanif-content-package` is intentionally narrow. It ranks source-backed story moments for Hanif's consulting, content, software, workflow, and public-building themes; writes `review/content-inventory.md`, `analysis/story-candidates.json`, and `analysis/story-selection.md`; then writes `edit-plan.json` for the selected clip.

See [docs/hanif-content-package.md](docs/hanif-content-package.md) for the repeatable workflow and dogfood quality gates.

Or generate the transcript locally with the transcription-to-vault workbench:

```sh
bun dist/cli/index.js init ./input.mp4 --out ./my-cut --title "My Cut"
bun dist/cli/index.js transcribe ./my-cut \
  --prompt "Names: product names, people, places"
bun dist/cli/index.js prepare ./my-cut
```

After inspecting the frames/contact sheet, record observations:

```sh
bun dist/cli/index.js observe ./my-cut \
  --window window-001 \
  --summary "Talking head over a dashboard; the screen supports the spoken point." \
  --visible-text "Dashboard, Export, Revenue" \
  --editing-use keep \
  --broll none \
  --note "Good opening section."
```

Create and render a rough cut:

```sh
bun dist/cli/index.js plan ./my-cut
bun dist/cli/index.js render ./my-cut
```

Find moments, caption, verify, and package:

```sh
bun dist/cli/index.js find-moments ./my-cut \
  --objective "Find one complete Instagram-ready moment" \
  --target-seconds 30
bun dist/cli/index.js caption ./my-cut
bun dist/cli/index.js verify ./my-cut
bun dist/cli/index.js social-package ./my-cut --platform instagram
bun dist/cli/index.js export-otio ./my-cut
```

Generate and mix an optional AI music bed:

```sh
bun dist/cli/index.js music submit ./my-cut \
  --prompt-file plans/music-prompt.txt \
  --style "warm minimal electronic, soft pulse, 92 bpm" \
  --title "Cutroom Cue"
bun dist/cli/index.js music poll ./my-cut --download
bun dist/cli/index.js music mix ./my-cut \
  --track assets/music/track-001.mp3 \
  --target renders/captioned.mp4 \
  --out renders/with-music.mp4
```

Generate a HyperFrames brief for the polish pass:

```sh
bun dist/cli/index.js hyperframes-brief ./my-cut
```

## Commands

```txt
agent-cutroom doctor
agent-cutroom init <video> --out <dir> [--transcript <path>] [--title <title>] [--link-source]
agent-cutroom probe <project>
agent-cutroom transcribe <project> [--backend mlx-whisper] [--model large-v3] [--vault-note <path>]
agent-cutroom transcript <project>
agent-cutroom silence <project>
agent-cutroom frames <project>
agent-cutroom review-pack <project>
agent-cutroom prepare <project>
agent-cutroom observe <project> --window <id> --summary <text>
agent-cutroom plan <project>
agent-cutroom render <project>
agent-cutroom find-moments <project>
agent-cutroom hanif-content-package <project>
agent-cutroom caption <project>
agent-cutroom verify <project>
agent-cutroom social-package <project>
agent-cutroom music submit <project> --prompt <text>|--prompt-file <path>
agent-cutroom music poll <project> [--download]
agent-cutroom music mix <project> --track <path> [--target <path>] [--out <path>]
agent-cutroom export-otio <project>
agent-cutroom hyperframes-brief <project>
```

## Agent Skill

This repo includes a starter Codex skill at [skills/agent-cutroom/SKILL.md](skills/agent-cutroom/SKILL.md). Copy it into your skills directory and set `CUTROOM_DIR` to this checkout:

```sh
mkdir -p ~/.codex/skills/agent-cutroom
cp skills/agent-cutroom/SKILL.md ~/.codex/skills/agent-cutroom/SKILL.md
export CUTROOM_DIR="$PWD"
```

The skill keeps the workflow predictable: initialize a project, generate or import transcript metadata, prepare frames/contact sheets, record agent observations, plan and render rough cuts, then hand off to captions, music, HyperFrames, or release review only after the rough cut exists.

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

Active-word captions require real word timings:

```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 1.0,
      "text": "Hello world.",
      "words": [
        { "word": "Hello", "start": 0.0, "end": 0.4 },
        { "word": "world.", "start": 0.4, "end": 1.0 }
      ]
    }
  ]
}
```

`agent-cutroom transcribe` wraps the separate `transcribe-audio` workbench. It extracts project audio to `audio/source.wav`, runs local transcription, keeps raw `txt` and `json` artifacts in `transcript/`, imports timestamped segments into `timeline.json`, records transcript provenance, and can optionally write an Obsidian/vault note through `transcribe-audio note`.

## How Vision Works

There is no separate OCR service or hidden vision model.

The `frames` command extracts JPEG frames and a contact sheet. The running agent inspects those images directly, then writes observations through `agent-cutroom observe`. Those observations become timeline metadata used by `find-moments`, `plan`, `render`, `social-package`, and `hyperframes-brief`.

## HyperFrames Fit

Agent Cutroom owns the raw footage workflow: timeline metadata, transcript, frames, silence, agent observations, rough cuts.

HyperFrames fits after the rough cut, when the agent wants a polished composition with captions, title cards, lower thirds, callouts, pull quotes, B-roll layouts, or social-ready packaging. `agent-cutroom hyperframes-brief` exports the timeline context needed for that pass.

## Artifact Contract

See [docs/artifact-contract.md](docs/artifact-contract.md) for the project file contract, including transcript words, highlight candidates, caption plans, social packages, music generation and mix plans, verification reports, and OTIO exports.

## MCP Server

Agent Cutroom includes a local stdio MCP server that wraps the CLI and exposes project artifacts as resources:

```sh
bun run build
agent-cutroom-mcp
```

See [docs/mcp.md](docs/mcp.md) for tools, resources, prompts, and verification notes.

## AI Video Workflow Research

See [docs/ai-video-workflow-research.md](docs/ai-video-workflow-research.md) for research on current AI video workflows, transcript-first editing, creator style guides, open-source building blocks, agent skills, MCP surfaces, and the concrete workflow additions worth borrowing for Agent Cutroom.

## Synthetic Smoke Fixtures

The repo includes a reproducible sample-media script:

```sh
examples/synthetic-fixtures/scripts/make-sample-media.sh
```

Generated media and project outputs are ignored by git.

See [docs/synthetic-fixture-report.md](docs/synthetic-fixture-report.md) for the synthetic fixture smoke run.

## Real Talking-Head Dogfood

Real dogfood uses public real-person talking videos:

```sh
examples/real-talk/scripts/download-real-talking-videos.sh
```

The downloaded source media and generated project outputs are ignored by git. See [docs/dogfood-report.md](docs/dogfood-report.md) for the real-video dogfood run and verification results.

This repo also includes a checked-in HyperFrames dogfood project at [videos/sister-smollett-instagram](videos/sister-smollett-instagram) that turns the Agent Cutroom rough cut into a 1080x1920 Instagram-ready package.

## Development

```sh
bun install
bun run check
bun run build
```

## Status

This is an early public prototype. The stable contract is the file-based workflow: `cutroom.json`, `timeline.json`, `review/review-pack.md`, `analysis/highlight-candidates.json`, `edit-plan.json`, `plans/caption-plan.json`, `plans/social-package.json`, `plans/music-generation.json`, `plans/music-mix.json`, `renders/verify-report.json`, `exports/edit.otio`, and rendered outputs.
