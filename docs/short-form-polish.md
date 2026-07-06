# Short-Form Polish

Agent Cutroom has two deterministic polish passes for talking-head clips after the story selection is real:

```sh
agent-cutroom shortform-pacing "$PROJECT"
agent-cutroom render "$PROJECT"
agent-cutroom grade-preview "$PROJECT" --target renders/rough-cut.mp4
agent-cutroom grade-apply "$PROJECT" --target renders/rough-cut.mp4 --out renders/graded.mp4
agent-cutroom caption "$PROJECT" --target renders/graded.mp4 --out renders/captioned.mp4
agent-cutroom verify "$PROJECT" --target renders/captioned.mp4
```

## Short-Form Pacing

`shortform-pacing` rewrites an edit plan using real transcript word timings. It cuts meaningful dead-air pauses, preserves a small breath around each jump cut, and records the exact removed ranges. It also protects short rhetorical question-chain pauses, such as `Who is this for? What does it do?`, because those pauses are part of the delivery.

Default behavior:

- reads `edit-plan.json`
- writes the tightened edit plan back to `edit-plan.json`
- writes `plans/short-form-pacing.json`
- cuts pauses at or above `500ms`
- skips cuts that would remove less than `350ms`
- preserves `160ms` of total pause around each cut
- preserves question-chain pauses up to `700ms`
- trims non-speech padding at the beginning and end of each segment

Useful options:

```sh
agent-cutroom shortform-pacing "$PROJECT" \
  --min-pause-ms 500 \
  --keep-pause-ms 160 \
  --protected-question-pause-ms 700 \
  --source-plan edit-plan.json \
  --out-plan edit-plan.json
```

If transcript word timings are missing, the command leaves the plan unchanged and writes a warning. It does not invent word timings from plain text. `plans/short-form-pacing.json` includes both applied `cuts[]` and preserved `protectedPauses[]`.

## Agent Cut Review

Run the `cutroom-cut-review` skill before final grade, captions, release, or any user-facing export. `shortform-pacing` proposes timing changes; the agent must still inspect whether the edit preserves complete words, natural word release, meaning, rhetorical pauses, and visual continuity.

The review writes `review/cut-review.md`. If a boundary is risky, patch `edit-plan.json`, rerender the affected rough cut, and inspect that window again before continuing.

## Highlight-Protected Subject Shadow Lift

`grade-preview` and `grade-apply` use FFmpeg to apply a subject-region mask combined with a luma shadow mask. The filter grades a brighter copy of the video, then merges that copy back only where both masks are active. Bright wall pixels are protected, which avoids the visible spotlight problem from a plain oval mask.

Default behavior:

- target: `renders/rough-cut.mp4`
- preview frames: `review/color-grade/`
- applied output: `renders/graded.mp4`
- plan artifact: `plans/color-grade.json`
- subject mask: centered subject ellipse, feathered by `120px`
- shadow mask: full strength at luma `95` and below, inactive at luma `185` and above
- grade: conservative brightness lift, contrast, gamma/shadow lift, and saturation

Useful options:

```sh
agent-cutroom grade-preview "$PROJECT" \
  --target renders/rough-cut.mp4 \
  --shadow-threshold 90 \
  --highlight-threshold 175 \
  --gamma 1.35

agent-cutroom grade-apply "$PROJECT" \
  --target renders/rough-cut.mp4 \
  --out renders/graded.mp4 \
  --shadow-threshold 90 \
  --highlight-threshold 175 \
  --gamma 1.35
```

The mask is deterministic. The agent should inspect preview frames and tune the subject-region and luma thresholds when the subject is not centered or the wall starts to lift.
