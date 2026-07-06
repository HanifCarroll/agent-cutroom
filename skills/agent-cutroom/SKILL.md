---
name: agent-cutroom
description: Cutroom workflow for agent-driven video review and editing with Agent Cutroom. Use when the user wants an agent to inspect footage, import or generate transcripts, review frames/contact sheets, record observations, plan or render rough cuts, build source-backed content packages, generate HyperFrames briefs, or create captioned social-ready video.
---

# Agent Cutroom

Use Agent Cutroom as a deterministic media bench. The agent makes editorial and visual judgments; the CLI creates inspectable evidence, metadata, edit plans, polish plans, and renders.

Set the checkout path once:

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/path/to/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Contract

- Keep judgment in the running agent. Do not hide editorial logic in unreviewed model calls.
- For vision, extract frames/contact sheets, inspect them directly, then record observations with `observe`.
- Keep source media, transcript segments, silences, frames, observations, edit plans, and renders as explicit artifacts.
- Never infer timestamped transcript segments from plain text. Use timestamped JSON, generate a transcript, or keep untimed text marked as untimed.

## Workflow

1. Check the bench.

```sh
cd "$CUTROOM_DIR"
bun install
bun run build
cutroom doctor
```

Finish this step when `ffmpeg`, `ffprobe`, and any needed transcription dependency are accounted for.

2. Create the project.

With a timestamped transcript:

```sh
cutroom init "$VIDEO" --transcript "$TRANSCRIPT_JSON" --out "$PROJECT" --title "$TITLE"
```

For very large source media, add `--link-source` to symlink the source instead of copying it:

```sh
cutroom init "$VIDEO" --transcript "$TRANSCRIPT_JSON" --out "$PROJECT" --title "$TITLE" --link-source
```

Without a transcript:

```sh
cutroom init "$VIDEO" --out "$PROJECT" --title "$TITLE"
cutroom transcribe "$PROJECT" --prompt "$VOCABULARY_PROMPT"
```

Finish this step when `cutroom.json`, `timeline.json`, and transcript provenance are present. If transcription quality warnings appear, review them before moving on.

3. Build the evidence pack.

```sh
cutroom prepare "$PROJECT"
```

Open `review/review-pack.md` and the referenced contact sheet. Inspect the frame images yourself. Finish this step when the transcript, silence ranges, visual state, and useful or unusable sections are understood.

4. Record observations.

For each review window that matters:

```sh
cutroom observe "$PROJECT" \
  --window "$WINDOW_ID" \
  --summary "$WHAT_IS_VISIBLE" \
  --visible-text "$TEXT_ON_SCREEN" \
  --editing-use keep \
  --broll none \
  --note "$EDITORIAL_NOTE"
```

Use `--editing-use keep|tighten|cut|broll` and `--broll none|low|medium|high`. Finish this step when every editorial decision the plan will rely on is recorded in `timeline.json`.

5. Build a source-backed content package when the recording should become clips, writing, notes, or tasks.

```sh
cutroom content-package "$PROJECT" \
  --recipe talking-head-story \
  --profile hanif \
  --target-seconds 75
```

Use the `hanif` profile for Hanif's tripod videos, walk-style videos, raw thinking recordings, consulting/content/software videos, and videos meant to become writing, clips, vault notes, or tasks. The command writes `review/content-inventory.md`, `analysis/story-candidates.json`, `analysis/clip-slate.json`, `review/clip-candidate-evidence.md`, and `analysis/story-selection.md`.

Read `review/clip-candidate-evidence.md`, then author `review/clip-slate.md` yourself with titles, points, value judgments, recommendations, caveats, and candidate IDs. Show the agent-authored slate to the user before rendering. After approval, rerun with the approved candidate IDs:

```sh
cutroom content-package "$PROJECT" \
  --recipe talking-head-story \
  --profile hanif \
  --approve "$APPROVED_CANDIDATE_IDS"
```

Approved clip plans are written under `plans/clips/<candidate-id>/edit-plan.json`.

6. Find candidate moments.

```sh
cutroom find-moments "$PROJECT" --objective "$OBJECTIVE" --target-seconds "$TARGET_SECONDS"
```

Inspect `analysis/highlight-candidates.json` before selecting a clip or trusting a recommendation.

7. Tighten pacing, review cut boundaries, then render.

```sh
cutroom shortform-pacing "$PROJECT" --source-plan "$APPROVED_CLIP_PLAN" --out-plan "$PACED_CLIP_PLAN"
cutroom render "$PROJECT" --source-plan "$PACED_CLIP_PLAN" --out "$ROUGH_CUT_PATH"
```

Inspect `plans/short-form-pacing.json` and the approved clip edit plan before trusting the render. The pacing plan should show applied cuts and any protected rhetorical pauses. Use `cutroom-cut-review` before final grade, captions, release, or any user-facing export; the agent must explicitly approve or patch risky cut boundaries instead of treating deterministic pause removal as final editorial judgment. If no approved clip plan exists yet, stop after authoring `review/clip-slate.md` and ask for approval. Finish this step when `review/cut-review.md` exists, the rough cut exists, and the rendered cut matches the recorded observations.

8. Grade, caption, verify, package, and export as needed.

```sh
cutroom grade-preview "$PROJECT" --target renders/rough-cut.mp4
cutroom grade-apply "$PROJECT" --target renders/rough-cut.mp4 --out renders/graded.mp4
cutroom caption "$PROJECT" --target renders/graded.mp4 --out renders/captioned.mp4
cutroom verify "$PROJECT" --target renders/captioned.mp4
cutroom platform-export "$PROJECT" --platform instagram --target renders/captioned.mp4
cutroom social-package "$PROJECT" --platform instagram
cutroom export-otio "$PROJECT"
```

Run `grade-preview` when the subject is too dark. Inspect the preview frames under `review/color-grade/`, then adjust subject-region or shadow/highlight threshold options before `grade-apply` when needed. The grade mask should not create a visible wall spotlight.

Use `caption` only when real word timings exist. It writes `plans/caption-plan.json`, `captions/captions.ass`, and, by default, `renders/captioned.mp4`.

Use `platform-export` or the default `social-package` behavior to create a platform-matched H.264/AAC MP4 from the finished render. This writes `plans/platform-export.json` and `renders/platform-<platform>.mp4`.

9. Polish after the rough cut is real.

```sh
cutroom hyperframes-brief "$PROJECT"
```

Use `hyperframes/brief.md` as context for a later polish pass with captions, title cards, lower thirds, pull quotes, overlays, or social packaging. For word-synced captions, use transcript word timings to generate ASS subtitle events and burn them with FFmpeg/libass.

## Focused Skills

Use the focused skills when available:

- `cutroom-review`
- `cutroom-story-selector`
- `cutroom-rough-cut`
- `cutroom-cut-review`
- `cutroom-captions`
- `cutroom-social-package`
- `cutroom-hyperframes-polish`
- `cutroom-release`

## Completion

Finish only when the requested video artifact exists, the source project folder contains the metadata that produced it, visual decisions are recorded as observations, transcript provenance is preserved, and verification results are reported with paths.
