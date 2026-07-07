# Suno-Compatible API Notes

Agent Cutroom treats Suno generation as a provider-configurable async task flow.

Default environment variables:

- `SUNO_API_KEY` or `EVOLINK_API_KEY`
- `SUNO_API_BASE_URL` or `EVOLINK_API_BASE_URL`
- `SUNO_MODEL`, defaulting to `suno-v5-beta`

Default provider shape:

1. `POST /v1/audios/generations`
2. Poll `GET /v1/tasks/{task_id}`
3. Download completed `audio_url` or `results[]` URLs promptly into `assets/music/`

Use `--base-url` and `--model` when the provider differs. Keep provider URLs and task responses in `plans/music-generation.json`; never put API keys in project artifacts.

Generated URLs may expire, so download usable tracks into the project rather than treating remote URLs as permanent storage.
