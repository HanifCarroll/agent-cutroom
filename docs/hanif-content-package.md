# Hanif Content Package Workflow

This is the default Agent Cutroom path for Hanif's own tripod, walk-style, and raw-thinking videos.

The goal is not generic editing. The goal is to turn one long talking-head recording into a source-backed content package:

- a content inventory
- ranked story candidates
- one selected story
- an edit plan
- a verified rough cut
- word-timed captions when transcript word timings exist
- a social package with cover frame and post copy

## Use Case

Use this workflow for single-speaker Hanif videos about:

- consulting for paid-media agencies
- Codex as an operating system
- raw thinking into writing or clips
- software/workflow proof
- public building
- speaking confidence
- task-graph effectiveness

Do not use it as a generic video editor. B-roll, music, title cards, and HyperFrames polish are later passes after the selected story is real.

## Commands

For large Apple Photos originals, link the source instead of copying it:

```sh
agent-cutroom init "$VIDEO" \
  --transcript "$TRANSCRIPT_JSON" \
  --out "$PROJECT" \
  --title "$TITLE" \
  --link-source
```

Prepare review evidence:

```sh
agent-cutroom prepare "$PROJECT" \
  --window-ms 45000 \
  --interval-ms 60000 \
  --max-frames 30
```

Run the Hanif-specific selector:

```sh
agent-cutroom hanif-content-package "$PROJECT" \
  --target-seconds 75 \
  --min-seconds 35 \
  --max-seconds 125 \
  --max 10
```

Inspect before rendering:

```sh
open "$PROJECT/review/content-inventory.md"
open "$PROJECT/analysis/story-selection.md"
```

Record visual observations for any selected windows that matter:

```sh
agent-cutroom observe "$PROJECT" \
  --window "$WINDOW_ID" \
  --summary "$WHAT_IS_VISIBLE" \
  --editing-use keep \
  --broll none \
  --note "$EDITORIAL_NOTE"
```

Regenerate the package after observations so observation IDs are preserved in `analysis/story-candidates.json`, `analysis/story-selection.md`, and `edit-plan.json`.

Render and verify the selected clip:

```sh
agent-cutroom render "$PROJECT"
agent-cutroom verify "$PROJECT" \
  --target renders/rough-cut.mp4 \
  --out renders/rough-cut-verify-report.json
```

Caption, verify, and package:

```sh
agent-cutroom caption "$PROJECT"
agent-cutroom verify "$PROJECT" \
  --target renders/captioned.mp4 \
  --out renders/captioned-verify-report.json
agent-cutroom social-package "$PROJECT" \
  --platform linkedin \
  --render renders/captioned.mp4 \
  --candidate story-001
```

## Quality Gates

Before rendering:

- The selected story starts cleanly, not mid-sentence.
- The selected story has a clear point, useful audience, and source timestamps.
- The selected story references reviewed windows and, when available, recorded observations.
- `review/content-inventory.md` gives usable alternatives, not just one opaque answer.

Before publishing:

- `renders/rough-cut.mp4` verifies with duration, audio, decode, and preview frames.
- Captions are generated from real word timings, not approximated text.
- Caption preview frames show readable text that does not cover the face.
- `release/post-copy.md` is a usable scaffold, not a raw transcript dump.
- Any platform-size warning is handled deliberately before upload.

## Dogfood Result

The first dogfood run used Hanif's first tripod video and selected:

- Candidate: `story-001`
- Title: `Specificity Is The Name Of The Game`
- Source time: `7:30.420-8:49.920`
- Rendered duration: about 81.5 seconds
- Output: `renders/captioned.mp4`

Dogfood fixes made during the run:

- Added `init --link-source` so 17 GB Apple Photos originals do not get duplicated.
- Made silence detection audio-only so full-video `prepare` does not decode 4K video unnecessarily.
- Added `hanif-content-package` as the narrow selector and artifact generator.
- Added high-confidence display cleanup for known transcript terms such as `Codex` and `Claude Code`.
- Penalized mid-sentence candidate starts so selected clips open cleanly.
- Carried recorded visual observation IDs into story candidates, story selection, and edit plans.
- Taught `social-package` to use Hanif story candidates for title, timestamp, transcript excerpt, and post copy.

Remaining known limitation:

- Full-resolution caption burn-in is slow. Treat it as a final export step, not part of the fast review loop.
- The current LinkedIn style pack expects 1080x1350, while the first dogfood output is 2160x3840 portrait. Use a deliberate platform export or accept the warning before publishing.
