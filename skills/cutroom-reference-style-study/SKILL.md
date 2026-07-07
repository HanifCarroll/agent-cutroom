---
name: cutroom-reference-style-study
description: Reference style study for talking-head and social video editing. Use when Codex needs to inspect permitted reference clips, extract pacing/caption/camera/graphic patterns, create a reusable style profile, compare a current edit against references, or hand a style profile to Agent Cutroom, HyperFrames, captions, B-roll, or publish review work.
---

# Cutroom Reference Style Study

Use this skill to turn reference clips into a reusable `profile`. A profile describes editing behavior; it does not copy another creator's exact video.

## Workflow

1. Confirm usable references.

   Use user-owned clips, files the user provides, or sources the user explicitly permits. Do not download copyrighted reference videos just because they are public. Finish when every reference has a path or URL, permission note, and intended study purpose.

2. Build observation samples.

   For local video, prepare frame samples or an Agent Cutroom project. For URLs, inspect only what is accessible and permitted. Finish when each reference has enough transcript, frame, or playback evidence to describe timing, captions, camera, graphics, audio, and structure.

3. Log edit events.

   Read `references/event-log.md`. Record visible edit events with timestamp, event type, what changed, and why it appears to be used. Finish when the profile is based on observed events rather than vibe words.

4. Distill the profile.

   Read `references/style-profile-contract.md`. Write `analysis/reference-style-profile.json` and `analysis/reference-style-study.md`. Finish when the profile gives ranges and rules that another agent can apply without seeing the references.

5. Hand off.

   When applying the profile, pass it to `talking-head-style-editor`, `cutroom-image-insert-director`, `cutroom-broll-research`, or `cutroom-publish-review` as the style source.

## Guardrails

- Do not copy exact phrases, graphics, titles, or timing maps from a reference.
- Separate observed facts from inferred intent.
- Prefer ranges: cut density, caption duration, zoom frequency, and insert rhythm.
- Keep unusable or inaccessible references in the study with a warning instead of silently ignoring them.
