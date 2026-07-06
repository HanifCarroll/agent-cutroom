---
name: cutroom-social-package
description: Use for creating platform-matched renders, platform style packs, cover frames, post copy, hashtags, platform-export.json, and social-package.json for a finished Agent Cutroom render.
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

By default, this creates a platform-matched H.264/AAC MP4 before writing the social package. To create only that platform render, run:

```sh
cutroom platform-export "$PROJECT" --platform instagram --target renders/captioned.mp4
```

Supported platforms: `instagram`, `tiktok`, `youtube-shorts`, `linkedin`.

3. Inspect `plans/platform-export.json`, `plans/social-package.json`, `release/cover-frame.jpg`, and `release/post-copy.md`.

## Done When

- The platform export manifest names the platform, source render, output render, style pack, FFmpeg filter, media probes, and warnings.
- The package manifest names the platform, platform render path, style pack, cover frame, title options, hashtags, and source timestamps.
- Post copy is traceable to the transcript or selected candidate, not invented from unrelated context.
