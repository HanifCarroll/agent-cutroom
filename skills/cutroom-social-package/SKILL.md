---
name: cutroom-social-package
description: Use for creating platform style packs, cover frames, post copy, hashtags, and social-package.json for a finished Agent Cutroom render.
---

# Cutroom Social Package

Use this after a rough or captioned render exists. Prefer `renders/captioned.mp4` when available.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/Users/hanifcarroll/projects/tools/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Make sure candidate moments exist.

```sh
cutroom find-moments "$PROJECT" --objective "$OBJECTIVE"
```

2. Package for the target platform.

```sh
cutroom social-package "$PROJECT" --platform instagram
```

Supported platforms: `instagram`, `tiktok`, `youtube-shorts`, `linkedin`.

3. Inspect `plans/social-package.json`, `release/cover-frame.jpg`, and `release/post-copy.md`.

## Done When

- The package manifest names the platform, render path, style pack, cover frame, title options, hashtags, and source timestamps.
- Post copy is traceable to the transcript or selected candidate, not invented from unrelated context.
