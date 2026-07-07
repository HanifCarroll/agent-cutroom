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
  assets/
    music/
    broll/
    images/
  captions/
    captions.ass
  plans/
    caption-plan.json
    social-package.json
    broll-plan.json
    image-inserts.json
    music-brief.json
    music-generation.json
    music-mix.json
  renders/
    rough-cut.mp4
    captioned.mp4
    with-music.mp4
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
- `review/content-inventory.md`: Hanif-specific talking-head content inventory with selected story, clip candidates, writing/vault opportunities, weak sections, and the repeatable process.
- `analysis/highlight-candidates.json`: candidate clip windows with source timestamps, transcript text, reasons, evidence IDs, warnings, and scores.
- `analysis/story-candidates.json`: story-level candidate arcs for Hanif's consulting, content, software, workflow, public-building, and task-graph themes.
- `analysis/story-selection.md`: human-readable selection rationale for the chosen story and the edit-plan segment it generated.
- `edit-plan.json`: keep segments. Each segment has source timing, reason, source windows, evidence, confidence, and warnings.
- `plans/caption-plan.json`: subtitle format, target media, style, events, warnings, and optional burned output path.
- `plans/social-package.json`: platform, style pack, render path, cover frame, title options, hashtags, source timestamps, and warnings.
- `plans/broll-plan.json`: B-roll slots, selected assets, license/provenance, timing, crop, motion, and rejected assets.
- `plans/image-inserts.json`: generated or sourced image insert plan with prompts, timing, animation, safe-zone, and provenance.
- `plans/music-brief.json`: cue role, style, prompt, placement, and mix intent.
- `plans/music-generation.json`: Suno-compatible provider request, task status, result URLs, downloaded track paths, and warnings.
- `plans/music-mix.json`: target render, selected music track, volume, fade settings, output path, and warnings.
- `hyperframes/brief.md`: handoff brief for a polished HyperFrames composition.

## Render And Release Artifacts

- `renders/rough-cut.mp4`: deterministic render from `edit-plan.json`.
- `captions/captions.ass`: ASS subtitle file for active-word caption burn-in.
- `renders/captioned.mp4`: captioned render when `agent-cutroom caption` burns captions.
- `assets/music/*`: downloaded AI music tracks or user-provided cue files.
- `assets/broll/*`: downloaded or user-provided B-roll assets with provenance in `plans/broll-plan.json`.
- `assets/images/*`: generated or sourced image inserts with provenance in `plans/image-inserts.json`.
- `renders/with-music.mp4`: render with a music cue mixed under the target video.
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
- AI-generated music must keep provider, prompt, task, result, and local download provenance in project artifacts.
- Rendered files should have a verification report before release.
