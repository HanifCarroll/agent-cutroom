# Artifact Contract

Agent Cutroom stores every editing decision as a project artifact. The agent can inspect and revise these files; the CLI writes deterministic media outputs from them.

## Project Layout

```txt
project/
  cutroom.json
  timeline.json
  edit-plan.json
  source/
    source.mp4
  transcript/
    transcript.json
    transcript.txt
  analysis/
    highlight-candidates.json
    story-candidates.json
    story-selection.md
  frames/
  contact-sheets/
  review/
    review-pack.md
    content-inventory.md
  captions/
    captions.ass
  plans/
    caption-plan.json
    short-form-pacing.json
    color-grade.json
    social-package.json
  renders/
    rough-cut.mp4
    graded.mp4
    captioned.mp4
    verify-report.json
    verify-frames/
  exports/
    edit.otio
  hyperframes/
    brief.md
  release/
    cover-frame.jpg
    post-copy.md
```

## Source Artifacts

- `cutroom.json`: project manifest, source path, transcript path, edit-plan path, render directory, title, and creation time.
- `source/source.*`: copied or symlinked source media. This is the source of truth for render operations.
- `transcript/*`: copied or generated transcript artifacts.
- `timeline.json`: canonical timeline state.

`timeline.json` contains:

- `media`: ffprobe metadata.
- `transcriptSegments[]`: timestamped transcript spans.
- `transcriptSegments[].words[]`: real word timings when available. Active-word captions require these; the CLI does not invent word timings.
- `transcriptProvenance`: transcription tool, model/backend, raw artifact paths, vault note path, and quality warnings.
- `silences[]`: FFmpeg silence ranges.
- `frames[]`: sampled review frame paths.
- `windows[]`: review windows that connect transcript text, frames, and silence IDs.
- `observations[]`: agent-written visual/editorial judgments.
- `warnings[]`: import, review, and preparation warnings.

## Decision Artifacts

- `review/review-pack.md`: agent-facing Markdown review surface with transcript windows and frame references.
- `analysis/highlight-candidates.json`: candidate clip windows with source timestamps, transcript text, reasons, evidence IDs, warnings, and scores.
- `review/content-inventory.md`: recipe/profile content inventory with selected story, clip candidates, writing/vault opportunities, weak sections, and repeatable process.
- `analysis/story-candidates.json`: source-backed story candidates produced by `agent-cutroom content-package`, including recipe/profile metadata, stable source-range IDs, source evidence, score reasons, suggested artifacts, and warnings.
- `analysis/story-selection.md`: selected story summary with hook, point, evidence, warnings, and the selected edit-plan segment.
- `edit-plan.json`: keep segments. Each segment has source timing, reason, source windows, evidence, confidence, and warnings.
- `plans/short-form-pacing.json`: source edit plan path, output edit plan path, pacing options, before/after duration, exact removed pause ranges, and protected rhetorical pauses.
- `review/cut-review.md`: agent-authored boundary QA with reviewed cut timestamps, transcript phrases, pass/fix decisions, edit-plan patches, and remaining risks.
- `plans/color-grade.json`: highlight-protected subject-mask shadow-lift method, FFmpeg filter graph, subject and luma mask geometry, grade settings, preview frame paths, and output path.
- `plans/caption-plan.json`: subtitle format, target media, style, events, warnings, and optional burned output path.
- `plans/social-package.json`: platform, style pack, render path, cover frame, title options, hashtags, source timestamps, and warnings.
- `hyperframes/brief.md`: handoff brief for a polished HyperFrames composition.

## Render And Release Artifacts

- `renders/rough-cut.mp4`: deterministic render from `edit-plan.json`.
- `renders/graded.mp4`: optional subject-mask shadow-lift render.
- `captions/captions.ass`: ASS subtitle file for active-word caption burn-in.
- `renders/captioned.mp4`: captioned render when `agent-cutroom caption` burns captions.
- `renders/verify-report.json`: existence, probe, duration, decode, and preview-frame verification.
- `renders/verify-frames/*`: preview frames used to inspect a render.
- `exports/edit.otio`: OpenTimelineIO-compatible export from `edit-plan.json`.
- `release/cover-frame.jpg`: cover image extracted for a social package.
- `release/post-copy.md`: editable post copy scaffold.

## Contracts

- Timestamped edits must come from timestamped artifacts.
- Active-word captions must come from `segments[].words[]`.
- Visual judgments must be written as observations, not only kept in chat.
- Generated B-roll, title cards, captions, and social copy should point back to source timestamps or candidate IDs.
- Content package profiles may tune themes and post-copy scaffolds, but selected moments must still come from timestamped transcript/project evidence.
- Rendered files should have a verification report before release.
