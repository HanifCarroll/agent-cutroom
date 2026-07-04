# Real Talking-Head Dogfood

This folder contains scripts for dogfooding Agent Cutroom on real videos of people talking.

Source media and generated project folders are ignored by git.

```sh
examples/real-talk/scripts/download-real-talking-videos.sh
pnpm build
node dist/cli/index.js init examples/real-talk/media/sister-smollett.webm \
  --out examples/real-talk/projects/sister-smollett \
  --title "Sister Smollett Interview Clip"
node dist/cli/index.js prepare examples/real-talk/projects/sister-smollett
```

See `docs/dogfood-report.md` for the verified real-video run.
