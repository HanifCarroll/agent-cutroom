# Synthetic Smoke Fixtures

Run the script below to generate small local sample videos and timestamped transcripts:

```sh
examples/synthetic-fixtures/scripts/make-sample-media.sh
```

Then run Agent Cutroom against the generated media:

```sh
pnpm build
node dist/cli/index.js init examples/synthetic-fixtures/media/talking-head-demo.mp4 \
  --transcript examples/synthetic-fixtures/media/talking-head-demo.transcript.json \
  --out examples/synthetic-fixtures/projects/talking-head-demo \
  --title "Talking Head Demo"

node dist/cli/index.js prepare examples/synthetic-fixtures/projects/talking-head-demo
node dist/cli/index.js plan examples/synthetic-fixtures/projects/talking-head-demo
node dist/cli/index.js render examples/synthetic-fixtures/projects/talking-head-demo
```

Generated media and outputs are gitignored.
