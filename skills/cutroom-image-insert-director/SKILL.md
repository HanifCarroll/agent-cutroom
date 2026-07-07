---
name: cutroom-image-insert-director
description: Image and infographic insert direction for Agent Cutroom and HyperFrames videos. Use when Codex needs to decide whether a clip needs generated images, screenshots, diagrams, quote cards, proof callouts, title cards, or animated visual inserts, then write prompts and an image-inserts plan for rendering.
---

# Cutroom Image Insert Director

Use this skill to create visual `inserts`: still images, screenshots, diagrams, or cards that make the spoken idea easier to see.

## Workflow

1. Identify insert jobs.

   Inspect the selected story, edit plan, transcript, B-roll plan, and style profile. Finish when every insert has a source time range, spoken beat, job, and reason the base talking-head shot is insufficient.

2. Choose insert type.

   Read `references/insert-primitives.md`. Pick the smallest visual form that works: screenshot, proof callout, diagram, infographic, quote card, generated scene, title card, or lower third. Finish when each insert has exactly one primary job.

3. Write image prompts and constraints.

   Use `references/prompt-contract.md`. For generated images, write prompts that specify subject, composition, format, text policy, aspect ratio, and negative constraints. Finish when a generation tool or designer could produce the asset without rereading chat.

4. Produce or locate assets.

   Use available image-generation tooling when generation is requested or when stock footage would be generic. Save files under `assets/images/` or reference existing local files. Finish when every selected asset has local path, source/generation note, and usage warning if any.

5. Write the render plan.

   Write `plans/image-inserts.json`. Include timing, animation, safe-zone, caption interaction, and exit back to speaker or B-roll. Finish when HyperFrames or FFmpeg work can consume the plan directly.

## Guardrails

- Do not add decorative images that do not carry meaning.
- Do not put dense explanatory text in images for mobile video.
- Do not let insert text compete with active-word captions.
- Keep generated-image provenance visible in the plan.
