---
name: cutroom-publish-review
description: "Publish gate for finished Agent Cutroom social videos. Use when Codex needs final pre-publish QA for Instagram, TikTok, YouTube Shorts, or LinkedIn: verify render files, inspect preview frames, check captions, safe zones, face framing, audio/music mix, cover frame, post copy, asset provenance, and release readiness."
---

# Cutroom Publish Review

Use this skill as the final `gate` before a video is called publish-ready.

## Workflow

1. Verify media artifacts.

   Run Agent Cutroom verification for the final render:

   ```sh
   agent-cutroom verify "$PROJECT" --target "$FINAL_RENDER"
   ```

   Finish when `renders/verify-report.json` exists, the report is read, and preview frames are inspected.

2. Check platform fit.

   Read `plans/social-package.json`, `release/post-copy.md`, and platform style-pack details. Use `references/platform-gates.md`. Finish when dimensions, duration, caption safe zones, cover frame, title, and post copy match the target platform.

3. Inspect editorial quality.

   Watch or sample the actual rendered video. Check first seconds, pacing, face framing, captions, B-roll, image inserts, and music. Finish when each issue is recorded as pass, warn, or fail with a concrete timestamp or artifact path.

4. Check provenance.

   Confirm transcripts, generated images, B-roll, music, and stock assets have source/provenance records. Finish when no asset in the final render is unaccounted for.

5. Write the gate report.

   Use `references/review-report.md`. Write `release/publish-review.md` with final status: `pass`, `warn`, or `fail`. Finish only when the status is defensible from artifacts, not from intent.

## Guardrails

- Do not mark a video publish-ready without inspecting rendered frames or playback.
- Do not ignore warnings that affect readability, face framing, audio intelligibility, or rights/provenance.
- Do not treat successful encoding as successful publishing QA.
