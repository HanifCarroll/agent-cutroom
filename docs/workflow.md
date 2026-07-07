# Workflow

## Local Secrets

The CLI and MCP server automatically load optional provider secrets from:

```sh
~/.config/agent-cutroom/secrets.env
```

Use this for local-only credentials such as:

```sh
PEXELS_API_KEY=...
SUNO_API_KEY=...
# or EVOLINK_API_KEY=...
```

Already-exported environment variables take precedence. Set `AGENT_CUTROOM_SECRETS_FILE` to use another file.

## 1. Create A Project

```sh
agent-cutroom init raw.mp4 --transcript transcript.json --out cutroom-project
```

For large local originals, such as Apple Photos videos that are already stored on disk, use `--link-source` to avoid copying the full media file into the project:

```sh
agent-cutroom init raw.mov --transcript transcript.json --out cutroom-project --link-source
```

## 2. Prepare Review Materials

```sh
agent-cutroom prepare cutroom-project
```

This runs:

- `ffprobe` media metadata
- transcript import
- FFmpeg silence detection
- frame extraction
- contact-sheet creation
- review-pack generation

## 3. Agent Review

The agent opens `review/review-pack.md`, inspects frame images/contact sheets, and writes observations:

```sh
agent-cutroom observe cutroom-project \
  --window window-001 \
  --summary "Talking head with no useful on-screen change." \
  --editing-use broll \
  --broll high
```

## 4. Plan And Render

```sh
agent-cutroom plan cutroom-project
agent-cutroom render cutroom-project
```

`plan` removes long silence ranges and windows marked as `cut`. `render` creates `renders/rough-cut.mp4`.

## Hanif Talking-Head Content Package

For Hanif's own tripod, walk, and raw-thinking videos, run the narrow content package pass before rendering:

```sh
agent-cutroom hanif-content-package cutroom-project \
  --target-seconds 75 \
  --max 8
```

This writes:

- `review/content-inventory.md`
- `analysis/story-candidates.json`
- `analysis/story-selection.md`
- `edit-plan.json` for the selected story

The pass is tuned for Hanif's current themes: consulting for paid-media agencies, Codex as an operating system, raw thinking into content, public software proof, speaking confidence, and task-graph effectiveness. Inspect the inventory and selection before running `agent-cutroom render`.

For the full repeatable process and quality gates, see `docs/hanif-content-package.md`.

## 5. Find Candidate Moments

```sh
agent-cutroom find-moments cutroom-project \
  --objective "Find one complete Instagram-ready moment" \
  --target-seconds 30
```

This writes `analysis/highlight-candidates.json` with candidate windows, reasons, evidence, warnings, and source timestamps.

## 6. Caption And Verify

```sh
agent-cutroom caption cutroom-project
agent-cutroom verify cutroom-project
```

`caption` uses real transcript word timings from `segments[].words[]` and maps them through `edit-plan.json` so active-word subtitles line up with the rough cut. It writes `plans/caption-plan.json`, `captions/captions.ass`, and `renders/captioned.mp4`.

`verify` probes, decodes, and extracts preview frames for the render, then writes `renders/verify-report.json`.

## 7. Package For Social

```sh
agent-cutroom social-package cutroom-project --platform instagram
```

This writes `plans/social-package.json`, `release/cover-frame.jpg`, and `release/post-copy.md`.

## 8. Add Music When Needed

Write a provider prompt in `plans/music-prompt.txt`, then submit and poll a Suno-compatible async generation task:

```sh
agent-cutroom music submit cutroom-project \
  --prompt-file plans/music-prompt.txt \
  --style "warm minimal electronic, soft pulse, 92 bpm" \
  --title "Cutroom Cue"
agent-cutroom music poll cutroom-project --download
```

This writes `plans/music-generation.json` and downloads completed tracks into `assets/music/`.

To mix a cue under a render:

```sh
agent-cutroom music mix cutroom-project \
  --track assets/music/track-001.mp3 \
  --target renders/captioned.mp4 \
  --out renders/with-music.mp4
```

This writes `plans/music-mix.json`. Run `agent-cutroom verify cutroom-project --target renders/with-music.mp4` before publishing.

## 9. Export OTIO

```sh
agent-cutroom export-otio cutroom-project
```

This writes `exports/edit.otio` from the current `edit-plan.json`.

## 10. Polish With HyperFrames

```sh
agent-cutroom hyperframes-brief cutroom-project
```

Use `hyperframes/brief.md` as the source context for title cards, captions, lower thirds, pull quotes, overlays, and social-ready exports.
