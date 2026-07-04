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
bun install
bun run build
examples/real-talk/scripts/download-real-talking-videos.sh
```

The original real-video run did not invent transcripts. The follow-up dogfood pass used the local `transcribe-audio` workbench on `sister-smollett`, imported timestamped transcript segments into Agent Cutroom, and used those artifacts to build a HyperFrames Instagram package.

The latest pass also exercised the new artifact workflow: candidate moments, active-word captions, render verification, social packaging, OTIO export, and the MCP server smoke test.

## Runs

### Sister Smollett

```sh
bun dist/cli/index.js init examples/real-talk/media/sister-smollett.webm \
  --out examples/real-talk/projects/sister-smollett \
  --title "Sister Smollett Interview Clip"
bun dist/cli/index.js prepare examples/real-talk/projects/sister-smollett \
  --interval-ms 2500 --max-frames 12 --window-ms 8000
bun dist/cli/index.js transcribe examples/real-talk/projects/sister-smollett \
  --prompt "Names: Sister Circle, Jussie Smollett"
bun dist/cli/index.js review-pack examples/real-talk/projects/sister-smollett \
  --window-ms 8000
bun dist/cli/index.js plan examples/real-talk/projects/sister-smollett
bun dist/cli/index.js render examples/real-talk/projects/sister-smollett
bun dist/cli/index.js find-moments examples/real-talk/projects/sister-smollett \
  --objective "Find one complete Instagram-ready talking-head moment" \
  --target-seconds 16 --max 5
bun dist/cli/index.js caption examples/real-talk/projects/sister-smollett
bun dist/cli/index.js verify examples/real-talk/projects/sister-smollett \
  --target renders/captioned.mp4
bun dist/cli/index.js social-package examples/real-talk/projects/sister-smollett \
  --platform instagram
bun dist/cli/index.js export-otio examples/real-talk/projects/sister-smollett
bun dist/cli/index.js hyperframes-brief examples/real-talk/projects/sister-smollett
```

Result:

- Frames: 7
- Silence ranges: 1
- Review windows: 3
- Agent observations: 3
- Transcript segments: 4
- Transcript provenance: `transcribe-audio`, `mlx-whisper`, `large-v3`
- Edit-plan segments: 1
- Render: `renders/rough-cut.mp4`, 240x360, 15.982633s
- Candidate moments: 3 in `analysis/highlight-candidates.json`
- Caption events: 52 in `plans/caption-plan.json`
- Captioned render: `renders/captioned.mp4`, 240x360, 12.012s
- Verification report: `renders/verify-report.json`, `ok: true`
- Verification preview frames: 3 in `renders/verify-frames/`
- Social package: `plans/social-package.json`, `release/cover-frame.jpg`, `release/post-copy.md`
- Social package warning: render is 240x360 and does not match the Instagram 1080x1920 style pack; use HyperFrames or an export pass for final platform sizing.
- OTIO export: `exports/edit.otio`, `OTIO_SCHEMA: Timeline.1`
- HyperFrames brief: `hyperframes/brief.md`

HyperFrames Instagram package:

```sh
cd videos/sister-smollett-instagram
bun run check
bunx hyperframes@0.7.31 snapshot --frames 6
bun run render -- --quality high --output output.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration,size -of json output.mp4
```

Result:

- Output: `videos/sister-smollett-instagram/output.mp4`
- Canvas: 1080x1920, 9:16 portrait
- Duration: 16.021333s
- Size: 14,217,464 bytes
- HyperFrames checks: lint, validate, and inspect all passed with 0 warnings
- Render sample sheet: `videos/sister-smollett-instagram/render-contact-sheet.jpg`

### Eugene Parker

```sh
bun dist/cli/index.js init examples/real-talk/media/eugene-parker.webm \
  --out examples/real-talk/projects/eugene-parker \
  --title "Interview with Dr. Eugene Parker"
bun dist/cli/index.js prepare examples/real-talk/projects/eugene-parker \
  --interval-ms 10000 --max-frames 24 --window-ms 30000
bun dist/cli/index.js plan examples/real-talk/projects/eugene-parker
bun dist/cli/index.js render examples/real-talk/projects/eugene-parker
bun dist/cli/index.js hyperframes-brief examples/real-talk/projects/eugene-parker
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
bun dist/cli/index.js init examples/real-talk/media/jad-azraq.webm \
  --out examples/real-talk/projects/jad-azraq \
  --title "Jad Azraq Interview"
bun dist/cli/index.js prepare examples/real-talk/projects/jad-azraq \
  --interval-ms 10000 --max-frames 24 --window-ms 30000
bun dist/cli/index.js plan examples/real-talk/projects/jad-azraq
bun dist/cli/index.js render examples/real-talk/projects/jad-azraq
bun dist/cli/index.js hyperframes-brief examples/real-talk/projects/jad-azraq
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
bun run check
bun run build
bun dist/cli/index.js doctor
bun dist/cli/index.js transcribe <project>
bun dist/cli/index.js find-moments <project>
bun dist/cli/index.js caption <project>
bun dist/cli/index.js verify <project>
bun dist/cli/index.js social-package <project>
bun dist/cli/index.js export-otio <project>
ffprobe -v error -show_entries stream=width,height -show_entries format=duration,size -of json <render>
```

The real talking-head pass verified:

```txt
download real video -> init -> prepare -> transcribe -> review-pack -> observe -> find-moments -> plan -> render -> caption -> verify -> social-package -> export-otio -> HyperFrames brief/package
```

The MCP smoke test verified the built stdio server:

```sh
bun dist/mcp/server.js
```

Protocol-level test coverage starts the server over stdio, lists 11 tools, lists prompts, calls `doctor`, and checks validation-error behavior for missing required input.
