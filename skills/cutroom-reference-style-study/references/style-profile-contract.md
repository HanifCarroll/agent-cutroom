# Style Profile Contract

Write `analysis/reference-style-profile.json` with this shape:

```json
{
  "version": 1,
  "createdAt": "2026-07-04T00:00:00.000Z",
  "references": [
    {
      "id": "ref-001",
      "source": "/path/or/url",
      "permission": "user-provided",
      "studiedFor": ["captions", "pacing", "broll"]
    }
  ],
  "profile": {
    "pacing": {
      "averageCutGapSeconds": "2-5",
      "silencePolicy": "remove dead air, keep short thinking beats before turns"
    },
    "camera": {
      "reframes": ["punch-in on claims", "pull-back after proof"],
      "faceFraming": "eyes in upper third, no mouth crop"
    },
    "captions": {
      "placement": "lower third above platform UI",
      "emphasis": "one active word or phrase per beat"
    },
    "graphics": {
      "insertTypes": ["pull quote", "screenshot", "proof callout"],
      "density": "1 insert every 10-20 seconds when useful"
    },
    "audio": {
      "musicRole": "low bed, no vocals over speech",
      "transitionSounds": "rare"
    }
  },
  "applyRules": [
    "Use punch-ins only when the claim sharpens.",
    "Do not stack pull quote and active-word emphasis on the same beat."
  ],
  "warnings": []
}
```

Write `analysis/reference-style-study.md` with:

- What was studied.
- Observed patterns with evidence.
- Transferable rules.
- Non-transferable traits to avoid copying.
