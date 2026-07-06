# Agent Cutroom

Agent Cutroom gives ChatGPT Codex and other coding agents a local toolbelt for video review and editing.

The agent makes the editorial decisions. The CLI handles deterministic media work: probing videos, generating/importing timestamped transcripts through `transcribe-audio`, detecting silence, extracting frames/contact sheets, writing review packs, recording agent observations, finding candidate moments, creating edit plans, rendering rough cuts, burning word-timed captions, verifying renders, packaging social outputs, exporting OTIO, and preparing HyperFrames briefs.

## Why This Exists

Most video tools hide the timeline inside a UI. Agent Cutroom exposes the timeline as files an agent can inspect and edit:

```txt
raw video + transcript
  -> timeline.json
  -> transcript/raw txt+json
  -> frames/contact-sheets
  -> review/review-pack.md
  -> agent observations
  -> analysis/highlight-candidates.json
  -> analysis/story-candidates.json
  -> review/content-inventory.md
  -> edit-plan.json
  -> renders/rough-cut.mp4
  -> plans/short-form-pacing.json
  -> plans/color-grade.json
  -> captions/captions.ass
  -> renders/captioned.mp4
  -> renders/verify-report.json
  -> plans/social-package.json
  -> exports/edit.otio
  -> HyperFrames polish pass
```

This is designed for workflows where Codex is the editor/producer and needs tools to see, reason about, and render video.

## Requirements

- Bun 1.3+
- FFmpeg and ffprobe on `PATH`
- Optional for generated transcripts: [`transcribe-audio`](https://github.com/HanifCarroll/transcribe-audio) on `PATH`

Check your machine:

```sh
bun install
bun run build
bun dist/cli/index.js doctor
```

## Quick Start

```sh
bun install
bun run build

bun dist/cli/index.js init ./input.mp4 --transcript ./transcript.json --out ./my-cut --title "My Cut"
bun dist/cli/index.js prepare ./my-cut
open ./my-cut/review/review-pack.md
```

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

For source-backed talking-head packaging, build a content package from a recipe and profile:

```sh
bun dist/cli/index.js content-package ./my-cut \
  --recipe talking-head-story \
  --profile hanif \
  --target-seconds 75
```

This writes `review/content-inventory.md`, `analysis/story-candidates.json`, `analysis/story-selection.md`, and a selected `edit-plan.json`. The recipe is generic; the `hanif` profile contains the current themes, transcript cleanup, scoring defaults, and post-copy scaffolds for Hanif's videos.

Create a short-form-paced rough cut:

```sh
bun dist/cli/index.js shortform-pacing ./my-cut
bun dist/cli/index.js render ./my-cut
```

Preview and apply a subject-mask shadow lift when the speaker is underexposed:

```sh
bun dist/cli/index.js grade-preview ./my-cut --target renders/rough-cut.mp4
bun dist/cli/index.js grade-apply ./my-cut --target renders/rough-cut.mp4 --out renders/graded.mp4
```

Find moments, caption, verify, and package:

```sh
bun dist/cli/index.js find-moments ./my-cut \
  --objective "Find one complete Instagram-ready moment" \
  --target-seconds 30
bun dist/cli/index.js caption ./my-cut --target renders/graded.mp4 --out renders/captioned.mp4
bun dist/cli/index.js verify ./my-cut --target renders/captioned.mp4
bun dist/cli/index.js social-package ./my-cut --platform instagram
bun dist/cli/index.js export-otio ./my-cut
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
agent-cutroom content-package <project> [--recipe talking-head-story] [--profile hanif]
agent-cutroom shortform-pacing <project>
agent-cutroom grade-preview <project>
agent-cutroom grade-apply <project>
agent-cutroom caption <project>
agent-cutroom verify <project>
agent-cutroom social-package <project>
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

The skill keeps the workflow predictable: initialize a project, generate or import transcript metadata, prepare frames/contact sheets, record agent observations, plan and render rough cuts, then hand off to HyperFrames or caption rendering only after the rough cut exists.

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

See [docs/artifact-contract.md](docs/artifact-contract.md) for the project file contract, including transcript words, highlight candidates, story candidates, caption plans, social packages, verification reports, and OTIO exports.

## Content Packages

`agent-cutroom content-package` turns prepared transcript/windows/frame evidence into a content inventory, ranked story candidates, one selected story, and the selected edit plan.

```sh
agent-cutroom content-package <project> \
  --recipe talking-head-story \
  --profile hanif
```

The built-in `talking-head-story` recipe owns deterministic candidate generation and edit-plan writing. The `hanif` content profile owns the themes, audience, transcript corrections, score defaults, and social post draft templates. See [docs/content-package.md](docs/content-package.md) for profile shape, workflow, and quality gates.

## Short-Form Polish

`agent-cutroom shortform-pacing` tightens the selected edit plan using transcript word timings, writing `plans/short-form-pacing.json` and updating `edit-plan.json` by default. `agent-cutroom grade-preview` and `agent-cutroom grade-apply` use a feathered FFmpeg subject mask to lift shadows on the speaker without globally blowing out the frame. See [docs/short-form-polish.md](docs/short-form-polish.md).

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

This is an early public prototype. The stable contract is the file-based workflow: `cutroom.json`, `timeline.json`, `review/review-pack.md`, `review/content-inventory.md`, `analysis/highlight-candidates.json`, `analysis/story-candidates.json`, `analysis/story-selection.md`, `edit-plan.json`, `plans/caption-plan.json`, `plans/social-package.json`, `renders/verify-report.json`, `exports/edit.otio`, and rendered outputs.
