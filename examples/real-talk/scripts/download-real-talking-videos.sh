#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MEDIA_DIR="$ROOT/examples/real-talk/media"
mkdir -p "$MEDIA_DIR"

download() {
  local url="$1"
  local output="$2"
  if [[ -s "$output" ]]; then
    echo "exists $output"
    return
  fi
  curl --fail --location --retry 3 --retry-delay 2 \
    --user-agent "agent-cutroom-dogfood/0.1 (https://github.com/HanifCarroll/agent-cutroom)" \
    "$url" \
    --output "$output"
}

download \
  "https://upload.wikimedia.org/wikipedia/commons/f/fd/Sister_Circle_Live_Jussie_Smollett_interview_2018_June_1.webm" \
  "$MEDIA_DIR/sister-smollett.webm"

download \
  "https://upload.wikimedia.org/wikipedia/commons/e/ed/Interview_with_Dr._Eugene_Parker.webm" \
  "$MEDIA_DIR/eugene-parker.webm"

download \
  "https://upload.wikimedia.org/wikipedia/commons/c/cc/Jad_2ii.webm" \
  "$MEDIA_DIR/jad-azraq.webm"

cat > "$MEDIA_DIR/SOURCES.md" <<'EOF'
# Real Talking-Head Sources

These media files are downloaded for local dogfooding and are ignored by git.

| File | Source | License |
| --- | --- | --- |
| `sister-smollett.webm` | https://commons.wikimedia.org/wiki/File:Sister_Circle_Live_Jussie_Smollett_interview_2018_June_1.webm | CC BY 3.0 |
| `eugene-parker.webm` | https://commons.wikimedia.org/wiki/File:Interview_with_Dr._Eugene_Parker.webm | Public domain, NASA |
| `jad-azraq.webm` | https://commons.wikimedia.org/wiki/File:Jad_2ii.webm | CC0 1.0 |
EOF

echo "Downloaded real talking-head media in $MEDIA_DIR"
