# Image Prompt Contract

For generated images, write each prompt with:

- Subject: the concrete object, person type, place, interface, or scene.
- Purpose: what the image must explain in the video.
- Composition: crop, camera distance, focal point, and negative space.
- Format: `9:16`, `1:1`, `16:9`, transparent PNG, screenshot-style frame, or card.
- Text policy: exact text if needed, or `no visible text`.
- Style: restrained, realistic, diagrammatic, editorial, or product screenshot style.
- Exclusions: brands, logos, unreadable text, extra people, clutter, distorted hands, fake UI.

Write `plans/image-inserts.json` with this shape:

```json
{
  "version": 1,
  "createdAt": "2026-07-04T00:00:00.000Z",
  "inserts": [
    {
      "id": "image-001",
      "sourceStartMs": 14000,
      "sourceEndMs": 19000,
      "primitive": "proof-callout",
      "spokenBeat": "The workflow writes durable artifacts.",
      "job": "Show the artifact trail.",
      "assetPath": "assets/images/artifact-trail.png",
      "generationPrompt": "A clean mobile-first diagram...",
      "provenance": "generated",
      "render": {
        "durationMs": 5000,
        "placement": "full frame",
        "motion": "subtle push-in",
        "safeZone": "keep text in center 70%",
        "captionInteraction": "hide captions during quote card",
        "exit": "cut back to speaker"
      },
      "warnings": []
    }
  ],
  "warnings": []
}
```
