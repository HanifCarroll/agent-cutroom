---
name: cutroom-cut-review
description: Review Agent Cutroom edit boundaries with agent judgment before final render. Use after `edit-plan.json`, `plans/short-form-pacing.json`, or a rendered rough cut exists and before grade/caption/release when cuts may affect spoken words, rhetorical pauses, continuity, or whether the edit feels sensible.
---

# Cutroom Cut Review

Use this skill as an editorial QA gate. The CLI may propose or render cuts, but the running agent owns final cut sensibility.

```sh
CUTROOM_DIR="${CUTROOM_DIR:-/path/to/agent-cutroom}"
cutroom() { bun "$CUTROOM_DIR/dist/cli/index.js" "$@"; }
```

## Workflow

1. Confirm the review inputs exist.

```sh
test -f "$PROJECT/edit-plan.json"
test -f "$PROJECT/timeline.json"
```

If `plans/short-form-pacing.json` exists, review its `cuts[]` and `protectedPauses[]`. If a rough cut exists, use it as evidence, not as proof that the edit is good.

2. Build a boundary list from the plan.

Prioritize:

- every cut in `plans/short-form-pacing.json`
- every adjacent pair of `edit-plan.json` segments
- boundaries near long words, low-confidence words, sentence endings, question chains, lists, pivots, and emotional emphasis
- boundaries the user flagged as wrong

3. Inspect transcript evidence around each boundary.

For each boundary, read at least the previous 5 words and next 5 words from `timeline.json`. Check the actual word start/end times, word confidence, and spoken phrase. Treat transcript timings as evidence with error bars, especially for long words, low-confidence words, and sentence-final words.

4. Make an agent judgment for each boundary.

Approve only when the edit preserves:

- the complete spoken word and its natural release
- the meaning of the sentence or rhetorical chain
- enough breath for intentional emphasis
- a sensible visual jump
- a caption phrase that does not imply missing speech

Mark a boundary `fix` when it sounds or reads like it may clip a word, rush the thought, split a rhetorical chain, or remove a pause that carries meaning. Do not hide behind the deterministic plan when the edit feels wrong.

5. Patch the edit plan before final output.

Adjust `edit-plan.json` manually and conservatively. Common fixes:

- move the previous segment end later to preserve a final word tail
- move the next segment start earlier to preserve the beginning of the next word
- remove the cut when the pause is part of delivery
- widen the kept pause around question chains, sentence endings, or emphatic phrases

After patching, render a rough cut and inspect the affected window again before grade, caption, or release.

6. Record the review.

Create or update `review/cut-review.md` with:

- artifact reviewed
- boundary IDs or timestamps
- transcript phrase around each reviewed boundary
- decision: `pass` or `fix`
- exact edit-plan changes made
- remaining risks or user-review notes

## Done When

- `review/cut-review.md` exists and covers every risky boundary.
- Any `fix` item has been applied to `edit-plan.json`.
- The affected rough-cut window was regenerated and inspected.
- Final grade/caption/release work starts only after the cut review passes.
