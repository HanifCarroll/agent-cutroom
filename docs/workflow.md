# Workflow

## 1. Create A Project

```sh
agent-cutroom init raw.mp4 --transcript transcript.json --out cutroom-project
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

## 8. Export OTIO

```sh
agent-cutroom export-otio cutroom-project
```

This writes `exports/edit.otio` from the current `edit-plan.json`.

## 9. Polish With HyperFrames

```sh
agent-cutroom hyperframes-brief cutroom-project
```

Use `hyperframes/brief.md` as the source context for title cards, captions, lower thirds, pull quotes, overlays, and social-ready exports.
