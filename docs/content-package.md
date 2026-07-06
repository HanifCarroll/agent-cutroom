# Content Package Workflow

`agent-cutroom content-package` turns prepared project evidence into a content inventory, ranked story candidates, one selected story, and an edit plan.

The public command is generic:

```sh
agent-cutroom content-package "$PROJECT" \
  --recipe talking-head-story \
  --profile hanif \
  --target-seconds 75 \
  --min-seconds 35 \
  --max-seconds 125 \
  --max 8
```

The recipe owns the deterministic algorithm and output contract. The profile owns the themes, audience, transcript corrections, scoring defaults, and post-copy templates. The built-in `hanif` profile is tuned for Hanif's talking-head videos, but the command can also load a JSON content profile path.

`agent-cutroom hanif-content-package` remains as a deprecated compatibility alias for:

```sh
agent-cutroom content-package <project> --recipe talking-head-story --profile hanif
```

## Outputs

The command writes stable project artifacts:

- `review/content-inventory.md`
- `analysis/story-candidates.json`
- `analysis/story-selection.md`
- `edit-plan.json`

`analysis/story-candidates.json` includes recipe/profile metadata, source metadata, the selected candidate id, stable source-range candidate ids, rank aliases such as `story-001`, source timestamps, transcript excerpts, evidence IDs, warnings, and profile-generated post-copy scaffolds.

## Built-In Hanif Profile

Use `--profile hanif` for Hanif tripod videos, walk-style videos, raw thinking recordings, consulting/content/software videos, and videos meant to become writing, clips, vault notes, or tasks.

The profile currently covers:

- consulting for paid-media agencies
- Codex as an operating system
- raw thinking into writing or clips
- software/workflow proof
- public building
- speaking confidence
- task-graph effectiveness

## Quality Gates

Before rendering:

- The selected story starts cleanly, not mid-sentence.
- The selected story has a clear point, useful audience, and source timestamps.
- The selected story references reviewed windows and, when available, recorded observations.
- `review/content-inventory.md` gives usable alternatives, not just one opaque answer.

Before publishing:

- `renders/rough-cut.mp4` verifies with duration, audio, decode, and preview frames.
- Captions are generated from real word timings, not approximated text.
- Caption preview frames show readable text that does not cover the face.
- `release/post-copy.md` is a usable scaffold, not a raw transcript dump.
- Any platform-size warning is handled deliberately before upload.

## Large Source Videos

For large Apple Photos originals or other big local files, use `--link-source` during project creation:

```sh
agent-cutroom init "$VIDEO" \
  --transcript "$TRANSCRIPT_JSON" \
  --out "$PROJECT" \
  --title "$TITLE" \
  --link-source
```

This keeps `cutroom.json` and render paths the same while avoiding a full media copy.
