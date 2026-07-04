# Real Talking-Head Dogfood Report

Date: 2026-07-04

This report records dogfooding on real videos of people talking. The source media and generated project folders are intentionally gitignored; the commands below can rebuild the run.

## Sources

| Slug | Source | License |
| --- | --- | --- |
| `sister-smollett` | Wikimedia Commons: `File:Sister Circle Live Jussie Smollett interview 2018 June 1.webm` | CC BY 3.0 |
| `eugene-parker` | Wikimedia Commons: `File:Interview with Dr. Eugene Parker.webm` | Public domain, NASA |
| `jad-azraq` | Wikimedia Commons: `File:Jad 2ii.webm` | CC0 1.0 |

## Setup

```sh
pnpm install
pnpm build
examples/real-talk/scripts/download-real-talking-videos.sh
```

These sources do not ship with timestamped transcripts in this repo. The real dogfood run intentionally did not invent transcripts; it exercised the frame, silence, review, observation, plan, render, and HyperFrames-brief workflow from real talking-person footage.

## Runs

### Sister Smollett

```sh
node dist/cli/index.js init examples/real-talk/media/sister-smollett.webm \
  --out examples/real-talk/projects/sister-smollett \
  --title "Sister Smollett Interview Clip"
node dist/cli/index.js prepare examples/real-talk/projects/sister-smollett \
  --interval-ms 2500 --max-frames 12 --window-ms 8000
node dist/cli/index.js plan examples/real-talk/projects/sister-smollett
node dist/cli/index.js render examples/real-talk/projects/sister-smollett
node dist/cli/index.js hyperframes-brief examples/real-talk/projects/sister-smollett
```

Result:

- Frames: 7
- Silence ranges: 1
- Review windows: 3
- Agent observations: 3
- Edit-plan segments: 1
- Render: `renders/rough-cut.mp4`, 240x360, 15.982633s

### Eugene Parker

```sh
node dist/cli/index.js init examples/real-talk/media/eugene-parker.webm \
  --out examples/real-talk/projects/eugene-parker \
  --title "Interview with Dr. Eugene Parker"
node dist/cli/index.js prepare examples/real-talk/projects/eugene-parker \
  --interval-ms 10000 --max-frames 24 --window-ms 30000
node dist/cli/index.js plan examples/real-talk/projects/eugene-parker
node dist/cli/index.js render examples/real-talk/projects/eugene-parker
node dist/cli/index.js hyperframes-brief examples/real-talk/projects/eugene-parker
```

Result:

- Frames: 22
- Silence ranges: 8
- Review windows: 6
- Agent observations: 6
- Edit-plan segments: 6
- Render: `renders/rough-cut.mp4`, 1280x720, 145.261092s

### Jad Azraq

```sh
node dist/cli/index.js init examples/real-talk/media/jad-azraq.webm \
  --out examples/real-talk/projects/jad-azraq \
  --title "Jad Azraq Interview"
node dist/cli/index.js prepare examples/real-talk/projects/jad-azraq \
  --interval-ms 10000 --max-frames 24 --window-ms 30000
node dist/cli/index.js plan examples/real-talk/projects/jad-azraq
node dist/cli/index.js render examples/real-talk/projects/jad-azraq
node dist/cli/index.js hyperframes-brief examples/real-talk/projects/jad-azraq
```

Result:

- Frames: 12
- Silence ranges: 14
- Review windows: 4
- Agent observations: 4
- Edit-plan segments: 5
- Render: `renders/rough-cut.mp4`, 640x360, 104.623375s

## Verification

```sh
pnpm check
pnpm build
node dist/cli/index.js doctor
ffprobe -v error -show_entries stream=width,height -show_entries format=duration,size -of json <render>
```

The real talking-head pass verified:

```txt
download real video -> init -> prepare -> contact sheet review -> observe -> plan -> render -> hyperframes-brief
```
