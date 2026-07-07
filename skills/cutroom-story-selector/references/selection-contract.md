# Selection Contract

Write `analysis/story-candidates.json` with this shape:

```json
{
  "version": 1,
  "createdAt": "2026-07-04T00:00:00.000Z",
  "source": {
    "kind": "agent-cutroom-project",
    "path": "/absolute/or/project/path",
    "timingStatus": "timed"
  },
  "selectedCandidateId": "story-001",
  "candidates": [
    {
      "id": "story-001",
      "title": "Short working title",
      "sourceStartMs": 12000,
      "sourceEndMs": 52000,
      "timingStatus": "timed",
      "hook": "Opening spoken idea",
      "claim": "Core point",
      "turn": "What makes it interesting",
      "proof": "Concrete evidence or example",
      "payoff": "Viewer takeaway",
      "platformFit": ["instagram", "tiktok", "youtube-shorts"],
      "score": 0.86,
      "scoreReasons": [
        "complete idea in 40 seconds",
        "specific proof artifact",
        "low edit complexity"
      ],
      "sourceWindowIds": ["window-001"],
      "sourceFrameIds": ["frame-001"],
      "warnings": []
    }
  ],
  "warnings": []
}
```

Use `null` for `sourceStartMs` and `sourceEndMs` only when timing is unavailable, and set `timingStatus` to `untimed`.

Write `analysis/story-selection.md` with:

- Selected story and why it wins.
- Top three candidates with source ranges.
- Rejected-but-useful future candidates.
- Timing or source-quality warnings.
