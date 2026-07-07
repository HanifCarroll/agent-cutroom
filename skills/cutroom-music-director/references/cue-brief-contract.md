# Cue Brief Contract

Write `plans/music-brief.json` with this shape:

```json
{
  "version": 1,
  "createdAt": "2026-07-04T00:00:00.000Z",
  "role": "bed",
  "targetDurationSeconds": 45,
  "speechPolicy": "instrumental only, low under speech",
  "energyCurve": "quiet open, slight lift at the turn, resolve under payoff",
  "style": "warm minimal electronic, soft pulse, 92 bpm",
  "negativeTags": "vocals, heavy drums, cinematic trailer, sad piano, distortion",
  "prompt": "Instrumental warm minimal electronic bed for a practical talking-head video...",
  "placement": [
    {
      "renderStartMs": 0,
      "renderEndMs": 45000,
      "mixDb": -22,
      "fadeInMs": 600,
      "fadeOutMs": 1200
    }
  ],
  "warnings": []
}
```

Write `plans/music-prompt.txt` as the provider-facing prompt only. Keep usage notes, platform notes, and source evidence in JSON or Markdown, not in the provider prompt.
