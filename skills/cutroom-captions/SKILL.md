---
name: cutroom-captions
description: Use for generating ASS/SRT/VTT subtitles, burning active-word captions, and verifying captioned video outputs.
---

# Cutroom Captions

Active-word captions require real word timings in `timeline.json` at `transcriptSegments[].words[]`. Do not approximate word timings from plain transcript text.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Confirm the rough cut exists.

```sh
test -f "$PROJECT/renders/rough-cut.mp4"
```

2. Generate and burn ASS captions.

```sh
cutroom caption "$PROJECT"
```

3. Verify the captioned render.

```sh
cutroom verify "$PROJECT" --target renders/captioned.mp4
```

4. Inspect `renders/verify-frames/` for readability and face/UI-safe placement.

## Done When

- `plans/caption-plan.json` exists.
- `captions/captions.ass` exists.
- `renders/captioned.mp4` exists when burn-in was requested.
- Preview frames show readable captions with the active word highlighted.
- Caption phrases are short enough for mobile: by default, one large word at a time in the lower third, not a full sentence block.
- Captions should stay on screen continuously across normal word gaps and change text only at the next word or an intentional pause.
