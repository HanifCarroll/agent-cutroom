# Event Log

Log only events that can be observed from the reference.

## Event Types

- `cut`: jump cut, scene cut, or phrase boundary.
- `reframe`: punch-in, push-in, pull-back, pan, crop shift, or face recenter.
- `caption`: caption style change, active-word emphasis, keyword highlight, or caption drop.
- `graphic`: title card, lower third, pull quote, callout, screenshot, chart, or photo.
- `broll`: support footage replacing or sharing the frame with the speaker.
- `audio`: music bed, sting, silence hold, crossfade, or level change.
- `pace`: section reset, beat pause, or acceleration.

## Fields

For each event, record:

- `atMs` or a timestamp string.
- `type`.
- `description`.
- `visibleEvidence`.
- `inferredPurpose`.
- `confidence`: `low`, `medium`, or `high`.

Use `low` confidence when the event is visible but the purpose is uncertain.
