---
name: cutroom-story-selector
description: Story selection for Agent Cutroom and transcript-driven short-form video. Use when Codex needs to scan a transcript, vault note, review pack, or prepared Cutroom project to find video-worthy ideas, rank candidate clips, choose hooks, identify proof/examples/turns, or decide which moment should become a talking-head edit before rough cutting.
---

# Cutroom Story Selector

Use this skill before rough cutting. The leading word is `story`: a clip earns selection when it has a clear hook, point, turn, and payoff inside a bounded time range.

## Workflow

1. Ground the source.

   For an Agent Cutroom project, use existing `timeline.json`, `review/review-pack.md`, frame/contact-sheet artifacts, and `analysis/highlight-candidates.json` when present. If the project is not prepared, run:

   ```sh
   agent-cutroom prepare "$PROJECT"
   ```

   For a vault note or raw transcript, keep the output untimed unless timestamped media/transcript artifacts are available. Finish when every timed claim can point to source timestamps, transcript text, or review-window IDs.

2. Find story arcs.

   Read `references/story-signals.md` when the source is long, rambling, or idea-dense. Identify candidate arcs with `hook`, `claim`, `turn`, `proof`, and `payoff`. Finish when every candidate has a source range or an explicit `timingStatus: "untimed"` warning.

3. Rank candidates.

   Use the contract in `references/selection-contract.md`. Score for completeness, specificity, speaker energy, visual clarity, platform fit, and edit cost. Finish when the ranking explains why the top candidate beats the next two.

4. Write the selection artifacts.

   In an Agent Cutroom project, write:

   - `analysis/story-candidates.json`
   - `analysis/story-selection.md`

   Outside Agent Cutroom, write the same files beside the source note or transcript. Finish when the selected story can be passed directly to `cutroom-rough-cut` or `talking-head-style-editor` without chat-only context.

## Guardrails

- Do not pick a clip because a sentence sounds quotable if the surrounding thought is incomplete.
- Do not invent timestamps from untimed notes.
- Prefer one strong complete story over several fragments.
- Keep rejected candidates in the artifact with concise reasons; they are useful for later videos.
