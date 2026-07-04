# Agent Cutroom Instructions

Agent Cutroom is a local CLI for agent-driven video review and rough-cut rendering.

Core rule: keep judgment in the agent and deterministic media work in tools.

- Do not add hidden model calls for vision, OCR, transcript cleanup, or edit scoring.
- If a video needs visual judgment, extract frames/contact sheets and let the running agent inspect them.
- Keep source media, transcript segments, silence ranges, frame paths, observations, and edit plans in explicit JSON/Markdown artifacts.
- Do not infer timestamped transcript segments from plain text. Store untimed text with a warning.
- Use FFmpeg/ffprobe for media operations.
- Run `bun run check` and `bun run build` before shipping changes.
