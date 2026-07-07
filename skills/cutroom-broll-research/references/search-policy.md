# Search Policy

Use this order for B-roll and support assets:

1. Project-owned assets already in the repo or project folder.
2. User-provided footage or screenshots.
3. Free stock APIs with saved license/provenance, such as Pexels when `PEXELS_API_KEY` is configured.
4. Generated images/infographics when stock footage would be generic or misleading.
5. Public web assets only when rights and usage terms are explicit enough for the use case.

## Query Construction

Build 2-5 concrete search queries per slot:

- Start with the object/process named in the transcript.
- Add visual constraints: close-up, desk, screen, phone, walking, workshop, city, hands.
- Add mood only after the concrete subject.
- Avoid abstract one-word queries such as `success`, `growth`, or `technology`.

## Rejection Rules

Reject assets that are:

- Off-topic but visually attractive.
- Too dark, blurred, cropped, or stock-like for an explanatory insert.
- Inconsistent with the speaker's claim.
- Missing license/source metadata.
- Dependent on visible brands, people, or locations that create avoidable rights issues.
