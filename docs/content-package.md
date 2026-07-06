# Content Package Workflow

`agent-cutroom content-package` turns prepared project evidence into a content inventory, ranked story candidates, and a human-readable clip approval slate.

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

Review `review/clip-slate.md`, then approve the clips to make:

```sh
agent-cutroom content-package "$PROJECT" \
  --recipe talking-head-story \
  --profile hanif \
  --approve story-000055000-000095000,story-000120000-000170000
```

The recipe owns the deterministic algorithm and output contract. The profile owns the themes, audience, transcript corrections, scoring defaults, and post-copy templates. The built-in `hanif` profile is tuned for Hanif's talking-head videos, but the command can also load a JSON content profile path.

## Outputs

The command writes stable project artifacts:

- `review/content-inventory.md`
- `analysis/story-candidates.json`
- `analysis/clip-slate.json`
- `review/clip-slate.md`
- `analysis/story-selection.md`
- `plans/clips/<candidate-id>/edit-plan.json` for approved clips
- `edit-plan.json` as a single approved plan or an empty project-level guard plan

`analysis/story-candidates.json` includes recipe/profile metadata, source metadata, the first approved candidate id when present, stable source-range candidate ids, source timestamps, transcript excerpts, evidence IDs, warnings, and profile-generated post-copy scaffolds.

`review/clip-slate.md` is the approval surface. It lists every proposed valuable clip, the source time, point, hook, score, evidence, warnings, and the candidate IDs to approve before rendering.

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

- `review/clip-slate.md` has been shown to the operator.
- The operator approved the candidate IDs to make.
- Each approved story starts cleanly, not mid-sentence.
- Each approved story has a clear point, useful audience, and source timestamps.
- Each approved story references reviewed windows and, when available, recorded observations.
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
