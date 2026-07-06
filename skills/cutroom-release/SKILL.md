---
name: cutroom-release
description: Use for final QA of Agent Cutroom renders before publishing or handing off a video package.
---

# Cutroom Release

Use this before treating a render as publish-ready.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Verify the final render.

```sh
cutroom verify "$PROJECT" --target "$FINAL_RENDER"
```

2. Inspect `renders/verify-report.json`.

3. Inspect preview frames in `renders/verify-frames/`.

4. Export timeline handoff if needed.

```sh
cutroom export-otio "$PROJECT"
```

5. Confirm social package files when publishing to a platform.

```sh
test -f "$PROJECT/plans/social-package.json"
test -f "$PROJECT/release/post-copy.md"
! grep -q "Agent-authored post copy required" "$PROJECT/release/post-copy.md"
```

## Done When

- Verification has no failed checks.
- The final render, caption file, social package, cover frame, post copy, and OTIO export are present when required.
- Post copy is agent-authored when the generated package marked the file as a placeholder.
- Any remaining warnings are explicitly reported.
