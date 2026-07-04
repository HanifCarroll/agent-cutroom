---
name: cutroom-review
description: Use for preparing Agent Cutroom footage, inspecting review packs/contact sheets, and recording visual observations into timeline.json.
---

# Cutroom Review

Use Agent Cutroom as the deterministic bench. The agent performs visual judgment by inspecting frames/contact sheets directly, then records observations with the CLI.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Confirm the project is initialized.

```sh
cutroom doctor
```

2. Prepare review artifacts.

```sh
cutroom prepare "$PROJECT"
```

3. Open `review/review-pack.md` and inspect the contact sheet/frame files it references.

4. Record one observation per useful review window.

```sh
cutroom observe "$PROJECT" \
  --window "$WINDOW_ID" \
  --summary "$VISIBLE_STATE" \
  --visible-text "$ON_SCREEN_TEXT" \
  --editing-use keep \
  --broll none \
  --note "$EDITORIAL_NOTE"
```

## Done When

- `timeline.json` contains reviewed `observations[]`.
- Each future edit decision has a recorded observation or a clear warning that the span was not visually reviewed.
