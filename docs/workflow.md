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

## 4. Build A Content Package

For talking-head source material that should become clips, writing, vault notes, or tasks, run a recipe/profile content package pass:

```sh
agent-cutroom content-package cutroom-project \
  --recipe talking-head-story \
  --profile hanif \
  --target-seconds 75
```

This writes:

- `review/content-inventory.md`
- `analysis/story-candidates.json`
- `analysis/story-selection.md`
- `edit-plan.json`

The recipe is generic. The profile supplies the content themes, audience, transcript cleanup, defaults, and post-copy templates. Inspect the inventory and selected story before rendering.

## 5. Tighten Pacing, Review Cuts, And Render

```sh
agent-cutroom shortform-pacing cutroom-project
agent-cutroom render cutroom-project
```

`shortform-pacing` uses transcript word timings to remove long pauses from the selected edit plan and writes `plans/short-form-pacing.json`. `render` creates `renders/rough-cut.mp4`.

Use the `cutroom-cut-review` skill before final grade, captions, release, or user-facing export. The skill makes the agent inspect risky boundaries, approve or patch them, and write `review/cut-review.md`.

If no content package exists yet, run `plan` first to create `edit-plan.json`, then run `shortform-pacing`.

## 6. Find Candidate Moments

```sh
agent-cutroom find-moments cutroom-project \
  --objective "Find one complete Instagram-ready moment" \
  --target-seconds 30
```

This writes `analysis/highlight-candidates.json` with candidate windows, reasons, evidence, warnings, and source timestamps.

## 7. Grade, Caption, And Verify

```sh
agent-cutroom grade-preview cutroom-project --target renders/rough-cut.mp4
agent-cutroom grade-apply cutroom-project --target renders/rough-cut.mp4 --out renders/graded.mp4
agent-cutroom caption cutroom-project --target renders/graded.mp4 --out renders/captioned.mp4
agent-cutroom verify cutroom-project --target renders/captioned.mp4
```

`grade-preview` writes preview frames for the subject-mask shadow lift. The agent should inspect those frames before running `grade-apply`.

`caption` uses real transcript word timings from `segments[].words[]` and maps them through `edit-plan.json` so active-word subtitles line up with the rough cut. It writes `plans/caption-plan.json`, `captions/captions.ass`, and `renders/captioned.mp4`.

`verify` probes, decodes, and extracts preview frames for the render, then writes `renders/verify-report.json`.

## 8. Package For Social

```sh
agent-cutroom social-package cutroom-project --platform instagram
```

This creates a platform-matched render, then writes `plans/platform-export.json`, `plans/social-package.json`, `release/cover-frame.jpg`, and `release/post-copy.md`.

To create the platform render explicitly:

```sh
agent-cutroom platform-export cutroom-project \
  --platform instagram \
  --target renders/captioned.mp4
```

Platform exports must match the selected style pack dimensions, fps, video codec, video bitrate, and audio bitrate before upload.

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
