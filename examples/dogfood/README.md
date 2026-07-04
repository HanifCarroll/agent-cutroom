# Dogfood Examples

Run the script below to generate small local sample videos and timestamped transcripts:

```sh
examples/dogfood/scripts/make-sample-media.sh
```

Then run Agent Cutroom against the generated media:

```sh
pnpm build
node dist/cli/index.js init examples/dogfood/media/talking-head-demo.mp4 \
  --transcript examples/dogfood/media/talking-head-demo.transcript.json \
  --out examples/dogfood/projects/talking-head-demo \
  --title "Talking Head Demo"

node dist/cli/index.js prepare examples/dogfood/projects/talking-head-demo
node dist/cli/index.js plan examples/dogfood/projects/talking-head-demo
node dist/cli/index.js render examples/dogfood/projects/talking-head-demo
```

Generated media and outputs are gitignored.
