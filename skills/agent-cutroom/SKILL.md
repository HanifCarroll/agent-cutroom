---
name: agent-cutroom
description: Cutroom workflow for agent-driven video review and editing with Agent Cutroom. Use when the user wants an agent to inspect footage, import or generate transcripts, review frames/contact sheets, record observations, plan or render rough cuts, generate HyperFrames briefs, or create captioned social-ready video.
---

# Agent Cutroom

Use Agent Cutroom as a deterministic media bench. The agent makes editorial and visual judgments; the CLI creates inspectable evidence, metadata, edit plans, and renders.

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

5. Plan and render.

```sh
cutroom plan "$PROJECT"
cutroom render "$PROJECT"
```

Inspect `edit-plan.json` before trusting the render. Verify the output with `ffprobe` and a visual preview. Finish this step when `renders/rough-cut.mp4` exists and the rendered cut matches the recorded observations.

6. Polish after the rough cut is real.

```sh
cutroom hyperframes-brief "$PROJECT"
```

Use `hyperframes/brief.md` as context for a later polish pass with captions, title cards, lower thirds, pull quotes, overlays, or social packaging. For word-synced captions, use transcript word timings to generate ASS subtitle events and burn them with FFmpeg/libass.

## Completion

Finish only when the requested video artifact exists, the source project folder contains the metadata that produced it, visual decisions are recorded as observations, transcript provenance is preserved, and verification results are reported with paths.
