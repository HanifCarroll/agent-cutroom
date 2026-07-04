# Workflow

## 1. Create A Project

```sh
agent-cutroom init raw.mp4 --transcript transcript.json --out cutroom-project
```

## 2. Prepare Review Materials

```sh
agent-cutroom prepare cutroom-project
```

This runs:

- `ffprobe` media metadata
- transcript import
- FFmpeg silence detection
- frame extraction
- contact-sheet creation
- review-pack generation

## 3. Agent Review

The agent opens `review/review-pack.md`, inspects frame images/contact sheets, and writes observations:

```sh
agent-cutroom observe cutroom-project \
  --window window-001 \
  --summary "Talking head with no useful on-screen change." \
  --editing-use broll \
  --broll high
```

## 4. Plan And Render

```sh
agent-cutroom plan cutroom-project
agent-cutroom render cutroom-project
```

`plan` removes long silence ranges and windows marked as `cut`. `render` creates `renders/rough-cut.mp4`.

## 5. Polish With HyperFrames

```sh
agent-cutroom hyperframes-brief cutroom-project
```

Use `hyperframes/brief.md` as the source context for title cards, captions, lower thirds, pull quotes, overlays, and social-ready exports.
