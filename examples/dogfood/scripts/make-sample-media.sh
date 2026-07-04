#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MEDIA_DIR="$ROOT/examples/dogfood/media"
TMP_DIR="$MEDIA_DIR/tmp"
mkdir -p "$MEDIA_DIR" "$TMP_DIR"

make_segment() {
  local color="$1"
  local text="$2"
  local duration="$3"
  local audio="$4"
  local output="$5"
  local audio_filter
  if [[ "$audio" == "silence" ]]; then
    audio_filter="anullsrc=channel_layout=stereo:sample_rate=48000:d=${duration}"
  else
    audio_filter="sine=frequency=${audio}:sample_rate=48000:duration=${duration}"
  fi
  ffmpeg -hide_banner -loglevel error -nostdin -y \
    -f lavfi -i "color=c=${color}:s=1280x720:d=${duration}" \
    -f lavfi -i "$audio_filter" \
    -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac "$output"
  printf "%s\n" "$text" > "${output%.mp4}.label.txt"
}

make_vertical_segment() {
  local color="$1"
  local text="$2"
  local duration="$3"
  local audio="$4"
  local output="$5"
  local audio_filter
  if [[ "$audio" == "silence" ]]; then
    audio_filter="anullsrc=channel_layout=stereo:sample_rate=48000:d=${duration}"
  else
    audio_filter="sine=frequency=${audio}:sample_rate=48000:duration=${duration}"
  fi
  ffmpeg -hide_banner -loglevel error -nostdin -y \
    -f lavfi -i "color=c=${color}:s=720x1280:d=${duration}" \
    -f lavfi -i "$audio_filter" \
    -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac "$output"
  printf "%s\n" "$text" > "${output%.mp4}.label.txt"
}

concat_segments() {
  local output="$1"
  shift
  local list="$TMP_DIR/list-$(basename "$output").txt"
  : > "$list"
  for segment in "$@"; do
    printf "file '%s'\n" "$segment" >> "$list"
  done
  ffmpeg -hide_banner -loglevel error -nostdin -y \
    -f concat -safe 0 -i "$list" -c copy "$output"
}

make_segment "0x1f2937" "Opening thought" 4 440 "$TMP_DIR/talk-1.mp4"
make_segment "0x111827" "Long pause" 1.2 silence "$TMP_DIR/talk-2.mp4"
make_segment "0x0f766e" "Key point" 5 554 "$TMP_DIR/talk-3.mp4"
make_segment "0x7c2d12" "Needs B-roll" 4 659 "$TMP_DIR/talk-4.mp4"
concat_segments "$MEDIA_DIR/talking-head-demo.mp4" "$TMP_DIR/talk-1.mp4" "$TMP_DIR/talk-2.mp4" "$TMP_DIR/talk-3.mp4" "$TMP_DIR/talk-4.mp4"

make_segment "0x0f172a" "Dashboard: Revenue" 5 440 "$TMP_DIR/screen-1.mp4"
make_segment "0x334155" "Export CSV" 4 554 "$TMP_DIR/screen-2.mp4"
make_segment "0x111827" "Thinking pause" 1 silence "$TMP_DIR/screen-3.mp4"
make_segment "0x4c1d95" "Share report" 4 659 "$TMP_DIR/screen-4.mp4"
concat_segments "$MEDIA_DIR/screen-demo.mp4" "$TMP_DIR/screen-1.mp4" "$TMP_DIR/screen-2.mp4" "$TMP_DIR/screen-3.mp4" "$TMP_DIR/screen-4.mp4"

make_vertical_segment "0x172554" "Hook" 3 440 "$TMP_DIR/vertical-1.mp4"
make_vertical_segment "0x7f1d1d" "Pause" 0.9 silence "$TMP_DIR/vertical-2.mp4"
make_vertical_segment "0x14532d" "Payoff" 4 554 "$TMP_DIR/vertical-3.mp4"
concat_segments "$MEDIA_DIR/vertical-short.mp4" "$TMP_DIR/vertical-1.mp4" "$TMP_DIR/vertical-2.mp4" "$TMP_DIR/vertical-3.mp4"

cat > "$MEDIA_DIR/talking-head-demo.transcript.json" <<'JSON'
{
  "segments": [
    { "start": 0.0, "end": 3.8, "text": "I want to start with the opening thought and make sure the setup is clear." },
    { "start": 5.2, "end": 9.8, "text": "The key point is that the agent should inspect the video before making the edit plan." },
    { "start": 10.2, "end": 13.7, "text": "This part probably needs B-roll because the screen is not changing." }
  ],
  "text": "I want to start with the opening thought and make sure the setup is clear. The key point is that the agent should inspect the video before making the edit plan. This part probably needs B-roll because the screen is not changing."
}
JSON

cat > "$MEDIA_DIR/screen-demo.transcript.json" <<'JSON'
{
  "segments": [
    { "start": 0.0, "end": 4.5, "text": "Here the dashboard shows revenue and the section can stand on its own visually." },
    { "start": 5.0, "end": 8.5, "text": "Now I am exporting the CSV so the viewer sees the workflow step." },
    { "start": 10.0, "end": 13.5, "text": "Finally I share the report and this should become the closing beat." }
  ],
  "text": "Here the dashboard shows revenue and the section can stand on its own visually. Now I am exporting the CSV so the viewer sees the workflow step. Finally I share the report and this should become the closing beat."
}
JSON

cat > "$MEDIA_DIR/vertical-short.transcript.json" <<'JSON'
{
  "segments": [
    { "start": 0.0, "end": 2.8, "text": "The hook should stay tight and get straight to the point." },
    { "start": 3.9, "end": 7.5, "text": "The payoff is the final practical takeaway." }
  ],
  "text": "The hook should stay tight and get straight to the point. The payoff is the final practical takeaway."
}
JSON

rm -rf "$TMP_DIR"
echo "Generated sample media in $MEDIA_DIR"
