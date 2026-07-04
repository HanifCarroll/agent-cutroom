---
name: cutroom-rough-cut
description: Use for finding candidate moments, creating edit plans, rendering rough cuts, and checking the edit-plan evidence.
---

# Cutroom Rough Cut

Use this after `cutroom-review` has produced observations.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Find candidate moments.

```sh
cutroom find-moments "$PROJECT" \
  --objective "$OBJECTIVE" \
  --target-seconds "$TARGET_SECONDS"
```

2. Inspect `analysis/highlight-candidates.json`.

3. Create the rough edit plan.

```sh
cutroom plan "$PROJECT"
```

4. Inspect `edit-plan.json`. Check `evidence[]`, `warnings[]`, and source timestamps before rendering.

5. Render.

```sh
cutroom render "$PROJECT"
cutroom verify "$PROJECT" --target renders/rough-cut.mp4
```

## Done When

- `edit-plan.json` exists and each segment has a reason/evidence trail.
- `renders/rough-cut.mp4` exists.
- `renders/verify-report.json` reports no failed checks for the rough cut.
