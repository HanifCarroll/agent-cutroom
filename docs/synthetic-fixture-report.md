# Synthetic Fixture Report

Date: 2026-07-04

This report records the synthetic smoke-fixture pass for Agent Cutroom. These generated clips are useful for deterministic CLI testing, but they are not real dogfooding.

## Setup

```sh
pnpm install
pnpm build
examples/synthetic-fixtures/scripts/make-sample-media.sh
```

The sample generator uses core FFmpeg color/audio filters so the examples work with a portable FFmpeg install.

## Fixtures

- `talking-head-demo`: synthetic horizontal clip with timestamped JSON transcript.
- `screen-demo`: synthetic horizontal clip with visual phase changes and timestamped JSON transcript.
- `vertical-short`: synthetic vertical clip with timestamped JSON transcript.

## Verified Loop

```txt
init -> prepare -> contact sheet review -> observe -> plan -> render -> hyperframes-brief
```
