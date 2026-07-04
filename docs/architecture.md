# Architecture

Agent Cutroom is split into two layers:

1. The agent reviews context and makes editorial decisions.
2. The CLI performs deterministic media and file operations.

## Project Folder

```txt
project/
  cutroom.json
  timeline.json
  edit-plan.json
  source/
    source.mp4
  transcript/
    transcript.json
  frames/
    frame-000000000ms.jpg
  contact-sheets/
    frames.jpg
  review/
    review-pack.md
  analysis/
    highlight-candidates.json
  captions/
    captions.ass
  plans/
    caption-plan.json
    social-package.json
  renders/
    rough-cut.mp4
    captioned.mp4
    verify-report.json
  exports/
    edit.otio
  release/
    cover-frame.jpg
    post-copy.md
  hyperframes/
    brief.md
```

## Artifacts

- `cutroom.json`: project manifest and relative artifact paths.
- `timeline.json`: media metadata, transcript segments, silence ranges, extracted frame paths, review windows, and agent observations.
- `review/review-pack.md`: Markdown surface for Codex to review frames and transcript context.
- `analysis/highlight-candidates.json`: ranked candidate clip windows with reasons, evidence, warnings, and timestamps.
- `edit-plan.json`: source ranges to keep.
- `plans/caption-plan.json`: word-timed caption plan and style settings.
- `plans/social-package.json`: platform style pack, cover frame, title options, hashtags, and post-copy paths.
- `renders/verify-report.json`: probe, decode, duration, and preview-frame verification report.
- `exports/edit.otio`: OpenTimelineIO-compatible export.
- `hyperframes/brief.md`: production brief for a polished HyperFrames pass.

## Design Constraint

Agent Cutroom does not hide editorial logic inside heuristics or model calls. It makes evidence inspectable and records the agent's decisions explicitly.
