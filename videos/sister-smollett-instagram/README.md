# Sister Smollett Instagram Recut

This is a HyperFrames dogfood project built from Agent Cutroom artifacts:

- `../../examples/real-talk/projects/sister-smollett/timeline.json`
- `../../examples/real-talk/projects/sister-smollett/edit-plan.json`
- `../../examples/real-talk/projects/sister-smollett/transcript/source-large-v3-transcript.json`

The composition is a 1080x1920 Instagram/Reels-style talking-head package with:

- the Agent Cutroom rough cut as the video source
- timed graphic cards from the transcript
- a visible progress rail and source label
- portrait-safe speaker framing

## Source Attribution

Source footage: Wikimedia Commons, `File:Sister Circle Live Jussie Smollett interview 2018 June 1.webm`.

License: CC BY 3.0.

The staged file at `assets/input-video.mp4` is a short Agent Cutroom rough cut made from that source for local testing and public demo purposes.

## Commands

```sh
npm run check
npm run render -- --quality high --output output.mp4
```
