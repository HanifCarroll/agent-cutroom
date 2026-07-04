# Dogfood Report

Date: 2026-07-04

This report records the first local dogfood pass for Agent Cutroom. Generated media and project folders are intentionally gitignored; the commands below can rebuild the run.

## Setup

```sh
pnpm install
pnpm build
examples/dogfood/scripts/make-sample-media.sh
```

The sample generator originally used FFmpeg `drawtext`, but the local FFmpeg build did not include that filter. The fixtures now use core FFmpeg color/audio filters so the examples work with a more portable FFmpeg install.

## Runs

### Talking Head Demo

```sh
node dist/cli/index.js init examples/dogfood/media/talking-head-demo.mp4 \
  --transcript examples/dogfood/media/talking-head-demo.transcript.json \
  --out examples/dogfood/projects/talking-head-demo \
  --title "Talking Head Demo"
node dist/cli/index.js prepare examples/dogfood/projects/talking-head-demo \
  --interval-ms 2500 --max-frames 16 --window-ms 5000
node dist/cli/index.js observe examples/dogfood/projects/talking-head-demo \
  --window window-003 \
  --summary "Rust visual state with no internal visual change while transcript says this needs B-roll." \
  --editing-use broll --broll high
node dist/cli/index.js plan examples/dogfood/projects/talking-head-demo
node dist/cli/index.js render examples/dogfood/projects/talking-head-demo
node dist/cli/index.js hyperframes-brief examples/dogfood/projects/talking-head-demo
```

Result:

- Frames: 12
- Silence ranges: 1
- Review windows: 3
- Agent observations: 3
- Edit-plan segments: 2
- Render: `renders/rough-cut.mp4`, 1280x720, 13.061333s

### Screen Demo

```sh
node dist/cli/index.js init examples/dogfood/media/screen-demo.mp4 \
  --transcript examples/dogfood/media/screen-demo.transcript.json \
  --out examples/dogfood/projects/screen-demo \
  --title "Screen Demo"
node dist/cli/index.js prepare examples/dogfood/projects/screen-demo \
  --interval-ms 2500 --max-frames 16 --window-ms 5000
node dist/cli/index.js plan examples/dogfood/projects/screen-demo
node dist/cli/index.js render examples/dogfood/projects/screen-demo
node dist/cli/index.js hyperframes-brief examples/dogfood/projects/screen-demo
```

Result:

- Frames: 11
- Silence ranges: 1
- Review windows: 3
- Agent observations: 3
- Edit-plan segments: 2
- Render: `renders/rough-cut.mp4`, 1280x720, 13.079333s

### Vertical Short

```sh
node dist/cli/index.js init examples/dogfood/media/vertical-short.mp4 \
  --transcript examples/dogfood/media/vertical-short.transcript.json \
  --out examples/dogfood/projects/vertical-short \
  --title "Vertical Short"
node dist/cli/index.js prepare examples/dogfood/projects/vertical-short \
  --interval-ms 2000 --max-frames 12 --window-ms 4000
node dist/cli/index.js plan examples/dogfood/projects/vertical-short
node dist/cli/index.js render examples/dogfood/projects/vertical-short
node dist/cli/index.js hyperframes-brief examples/dogfood/projects/vertical-short
```

Result:

- Frames: 9
- Silence ranges: 1
- Review windows: 2
- Agent observations: 2
- Edit-plan segments: 2
- Render: `renders/rough-cut.mp4`, 720x1280, 7.061333s

## Verification

```sh
pnpm check
pnpm build
node dist/cli/index.js doctor
ffprobe -v error -show_entries stream=width,height -show_entries format=duration,size -of json <render>
```

The first pass verified the full loop:

```txt
init -> prepare -> contact sheet review -> observe -> plan -> render -> hyperframes-brief
```
