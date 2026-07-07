---
name: cutroom-music-director
description: Music direction for Agent Cutroom videos and Suno-compatible generation. Use when Codex needs to plan a music bed, sting, intro, outro, or transition cue; write prompts for Suno/EvoLink-style music APIs; generate or poll AI music; download track artifacts; or mix background music under a talking-head video.
---

# Cutroom Music Director

Use this skill to create a `cue`: music that supports the edit without fighting the speaker.

## Workflow

1. Decide the cue role.

   Inspect the story selection, edit plan, platform package, and final render intent. Choose one role: `bed`, `sting`, `intro`, `outro`, or `transition`. Finish when the cue has a purpose, duration target, energy curve, and a reason music helps this video.

2. Write the brief.

   Read `references/cue-brief-contract.md`. Write `plans/music-brief.json` and, when generating, `plans/music-prompt.txt`. Finish when the prompt specifies instrumental/vocal policy, style, tempo, mood, negative tags, and where the cue should sit under speech.

3. Generate when requested.

   Use the Agent Cutroom CLI when available:

   ```sh
   agent-cutroom music submit "$PROJECT" \
     --prompt-file plans/music-prompt.txt \
     --style "$STYLE_TAGS" \
     --title "$TITLE"
   agent-cutroom music poll "$PROJECT" --download
   ```

   Read `references/suno-compatible-api.md` before changing provider settings. Finish when `plans/music-generation.json` records the provider, request, task status, result URLs, downloaded local paths, and warnings.

4. Mix under the video when requested.

   ```sh
   agent-cutroom music mix "$PROJECT" \
     --track assets/music/track-001.mp3 \
     --target renders/captioned.mp4 \
     --out renders/with-music.mp4
   ```

   Finish when `plans/music-mix.json` exists and the mixed render is verified or ready for `cutroom-publish-review`.

## Guardrails

- Default to instrumental for talking-head clips.
- Do not put vocals under dense speech unless the user explicitly wants a song.
- Keep generated audio provenance in the project.
- Keep music below speech; intelligibility wins over vibe.
- Review the provider's current usage and licensing terms before publishing generated music commercially.
