---
name: cutroom-hyperframes-polish
description: Use for producing a HyperFrames brief after an Agent Cutroom rough cut exists.
---

# Cutroom HyperFrames Polish

Use HyperFrames after Agent Cutroom has produced a real rough cut and edit plan.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Confirm `edit-plan.json` and `renders/rough-cut.mp4` exist.

2. Generate the HyperFrames brief.

```sh
cutroom hyperframes-brief "$PROJECT"
```

3. Use `hyperframes/brief.md` as source context for title cards, lower thirds, pull quotes, overlays, B-roll layouts, or social compositions.

## Done When

- `hyperframes/brief.md` exists.
- The brief references source segments and observations from `timeline.json`.
- Any HyperFrames composition preserves source timing unless `edit-plan.json` is updated.
