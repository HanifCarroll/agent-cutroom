# B-Roll Asset Contract

Write `plans/broll-plan.json` with this shape:

```json
{
  "version": 1,
  "createdAt": "2026-07-04T00:00:00.000Z",
  "slots": [
    {
      "id": "broll-001",
      "sourceStartMs": 12000,
      "sourceEndMs": 17000,
      "spokenBeat": "The tool keeps metadata visible.",
      "purpose": "Show the artifact contract while the speaker explains it.",
      "asset": {
        "kind": "video",
        "localPath": "assets/broll/metadata-screen.mp4",
        "sourceUrl": "https://asset-source.invalid/asset",
        "provider": "pexels",
        "creator": "Creator Name",
        "license": "Pexels license",
        "downloadedAt": "2026-07-04T00:00:00.000Z"
      },
      "render": {
        "durationMs": 5000,
        "crop": "9:16 center",
        "motion": "slow push-in",
        "audio": "muted",
        "exit": "cut back to speaker on next claim"
      },
      "warnings": []
    }
  ],
  "rejectedAssets": [
    {
      "query": "metadata screen recording",
      "sourceUrl": "https://asset-source.invalid/rejected",
      "reason": "too generic"
    }
  ],
  "warnings": []
}
```

Use `null` for unavailable optional fields, but never omit provenance fields for selected assets.
