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

`shortform-pacing` rewrites an edit plan using real transcript word timings. It cuts long word-boundary pauses, preserves a small breath around each jump cut, and records the exact removed ranges.

Default behavior:

- reads `edit-plan.json`
- writes the tightened edit plan back to `edit-plan.json`
- writes `plans/short-form-pacing.json`
- cuts pauses at or above `350ms`
- preserves `160ms` of total pause around each cut
- trims non-speech padding at the beginning and end of each segment

Useful options:

```sh
agent-cutroom shortform-pacing "$PROJECT" \
  --min-pause-ms 300 \
  --keep-pause-ms 120 \
  --source-plan edit-plan.json \
  --out-plan edit-plan.json
```

If transcript word timings are missing, the command leaves the plan unchanged and writes a warning. It does not invent word timings from plain text.

## Subject-Mask Shadow Lift

`grade-preview` and `grade-apply` use FFmpeg to apply a soft elliptical mask over the speaker area. The filter grades a brighter copy of the video, then merges that copy back only through the mask.

Default behavior:

- target: `renders/rough-cut.mp4`
- preview frames: `review/color-grade/`
- applied output: `renders/graded.mp4`
- plan artifact: `plans/color-grade.json`
- mask: centered subject ellipse, feathered by `70px`
- grade: small brightness lift, contrast, gamma/shadow lift, and saturation

Useful options:

```sh
agent-cutroom grade-preview "$PROJECT" \
  --target renders/rough-cut.mp4 \
  --center-y-pct 0.40 \
  --radius-y-pct 0.36 \
  --gamma 1.22

agent-cutroom grade-apply "$PROJECT" \
  --target renders/rough-cut.mp4 \
  --out renders/graded.mp4 \
  --center-y-pct 0.40 \
  --radius-y-pct 0.36 \
  --gamma 1.22
```

The mask is deterministic. The agent should inspect preview frames and tune the mask numbers when the subject is not centered.
