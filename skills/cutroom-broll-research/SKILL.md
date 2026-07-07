---
name: cutroom-broll-research
description: B-roll research and asset planning for Agent Cutroom videos. Use when Codex needs to identify support-footage slots, search or download legal B-roll, use local assets, query Pexels/Pixabay-style APIs, record licenses and provenance, or produce a broll-plan.json that can be rendered through Agent Cutroom or HyperFrames.
---

# Cutroom B-Roll Research

Use this skill when a clip needs visual `support`: footage or assets that clarify the spoken idea without replacing the idea.

## Workflow

1. Locate support slots.

   Inspect `timeline.json`, `edit-plan.json`, observations with `brollNeed`, and any story/style plan. Finish when every B-roll slot has a source time range, spoken beat, purpose, and confidence.

2. Search in order.

   Read `references/search-policy.md`. Prefer existing project or local assets, then approved stock APIs such as Pexels, then generated assets when footage is the wrong medium. Finish when every selected asset has source, license/provenance, creator/credit when available, and local path.

3. Write the plan.

   Use `references/asset-contract.md`. Write `plans/broll-plan.json` and save assets under `assets/broll/`. Finish when the plan can be rendered without hidden search context.

4. Fit the edit.

   Recommend insert timing, crop/aspect, duration, motion, and whether audio from the B-roll is muted. Finish when every insert says how it supports the spoken beat and how it exits back to the speaker.

## Guardrails

- Do not use generic mood footage when the spoken point needs proof, product, or process.
- Do not use assets without provenance.
- Do not cover the speaker during an emotionally important face beat unless the support evidence is stronger.
- Keep B-roll audio muted by default for talking-head edits.
