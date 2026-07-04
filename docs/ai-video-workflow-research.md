# AI Video Workflow Research

Date: 2026-07-04

This report summarizes a five-lane subagent research pass plus a direct source pass on AI-assisted video creation workflows relevant to Agent Cutroom: transcript-first review, talking-head clipping, captions, B-roll, HyperFrames polish, and agent-operated tooling.

## Research Method

- Lane 1: current AI video/editor products and transcript-driven workflows.
- Lane 2: open-source and code-first editing/rendering tools.
- Lane 3: academic and technical methods for transcript, frame, silence, shot, and agentic editing.
- Lane 4: creator/community workflows, Shorts/Reels/TikTok packaging, hooks, captions, and B-roll.
- Lane 5: agent skills, MCP surfaces, review artifacts, and reusable workflow packaging.
- Direct pass: current official docs/product pages, open-source repos, platform style guides, and research papers.

## Bottom Line

The field is converging on the same workflow shape:

```txt
long recording
  -> transcript and word timings
  -> silence/shot/frame evidence
  -> candidate moments with reasons
  -> human/agent review
  -> rough cut
  -> caption, B-roll, hook, crop, and style pass
  -> platform package with publish assets
```

The products hide most of that behind one-click editors. Agent Cutroom's opportunity is to make the same workflow inspectable and reproducible: every transcript segment, silence range, frame observation, cut, caption event, B-roll cue, render command, warning, and output should live as a durable artifact.

## What Current Products Are Doing

### Transcript As The Editing Surface

Descript, Riverside, VEED, CapCut, Adobe Premiere, and Wistia all make the transcript central. The user edits text, searches spoken content, removes filler words, moves words, or selects transcript spans, and the video follows.

Useful hints for Agent Cutroom:

- Treat the transcript as the timeline spine, but keep timestamped JSON as the contract.
- Never infer timed edits from plain text.
- Store transcript provenance, speaker labels, word timings when available, corrections, and warnings separately from edited output.
- Build "paper edit" flows where the agent selects timestamped spans before rendering.

Relevant sources:

- [Descript](https://www.descript.com/)
- [Descript Underlord AI co-editor](https://help.descript.com/hc/en-us/articles/36803785502221-Underlord-beta-Your-AI-co-editor-in-Descript)
- [Descript edit like a doc](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc)
- [Adobe Premiere text-based editing](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/transcribe-video.html)
- [VEED transcript-based editing](https://www.veed.io/tools/text-based-video-editing/transcript-based-video-editing)
- [CapCut transcript editing](https://www.capcut.com/tools/video-transcript-editing)
- [Wistia text-based editing](https://wistia.com/learn/product-updates/introducing-text-based-video-editing)

### Long Recording To Social Clips

OpusClip, Riverside Magic Clips, CapCut long-to-short, Captions, Submagic, and Kapwing all follow the same pattern: upload or record long-form content, let AI find candidate clips, reframe for vertical, caption, add visual polish, and export.

Useful hints for Agent Cutroom:

- Add a `clip-brief.json` or section in `cutroom.json` with target platform, duration, topic keywords, aspect ratio, hook style, caption preset, and desired audience.
- Generate 5-15 candidate windows with explicit rationale instead of a single opaque "viral" choice.
- Store missing-context warnings so the agent can pull in neighboring sentences before rendering.
- Separate rough-cut selection from the platform packaging pass.

Relevant sources:

- [OpusClip](https://www.opus.pro/)
- [OpusClip project API](https://help.opus.pro/api-reference/endpoints/create-project)
- [Riverside Magic Clips](https://riverside.com/magic-clips)
- [CapCut long video to short video](https://www.capcut.com/tools/ai-long-video-to-short-video)
- [Kapwing Repurpose Studio](https://www.kapwing.com/tools/repurpose)
- [Submagic](https://www.submagic.co/)
- [PodReels paper](https://arxiv.org/html/2311.05867v2)

### Chat/Agent-Assisted Editing

Descript Underlord, Riverside Co-Creator, VEED AI editing, and Captions' chat/editor flows point toward "tell the editor what you want." The product action is still ordinary editing work: find moments, remove silences, add captions, add B-roll, clean audio, reframe, and create publish assets.

Useful hints for Agent Cutroom:

- Chat should orchestrate deterministic tools: `prepare`, `observe`, `find-moments`, `plan`, `caption`, `render`, `verify`, `package`.
- Keep model judgment in observations, edit plans, and review notes.
- Make diffs/reasons visible before destructive render steps.

Relevant sources:

- [Descript Underlord](https://help.descript.com/hc/en-us/articles/36803785502221-Underlord-beta-Your-AI-co-editor-in-Descript)
- [Riverside Co-Creator](https://riverside.com/co-creator)
- [Riverside chat-based editing release](https://www.prnewswire.com/il/news-releases/riverside-launches-chat-based-editing-a-new-way-to-edit-videos-in-minutes-simply-by-chatting-with-an-ai-agent-302570800.html)
- [VEED AI video editing](https://www.veed.io/tools/video-gpt/ai-video-editing)
- [Captions edit with AI](https://captions.ai/features/edit-with-ai)

### Automated Polish Layer

Common product polish includes filler/silence removal, jump cuts, active-word captions, hook titles, B-roll, zooms, eye contact, clean audio, music, templates, and platform export presets.

Useful hints for Agent Cutroom:

- Model this as a second pass after the rough cut exists.
- Store `caption-plan.json`, `broll-plan.json`, `style-pack.json`, `render-plan.json`, and `release-manifest.json`.
- Keep every generated or sourced asset tied to a transcript span and approval state.

Relevant sources:

- [OpusClip AI B-roll](https://help.opus.pro/docs/article/ai-broll)
- [Captions keyword highlighting](https://captions.ai/help/guides/engagement/highlight-keywords)
- [Captions B-roll guide](https://captions.ai/blog/practical-guide-b-roll-video)
- [Submagic API](https://care.submagic.co/en/article/how-to-use-submagics-api-jbyav2/)
- [Descript publish with AI tools](https://help.descript.com/hc/en-us/articles/21908844644621-Publish-with-AI-Tools)

### Generative Inserts And Synthetic Video

Runway, Luma, Pika, HeyGen, Synthesia, and ComfyUI-style workflows are strongest as asset or insert generators for this project, not as replacements for the real talking-head recording workflow.

Useful hints for Agent Cutroom:

- Treat generated B-roll as an explicit request tied to a source transcript claim.
- Store prompt, model/provider, reference frames, source timestamp, generated path, approval state, and rights/provenance note.
- Use generated video for title cards, explainers, cutaways, product demos, and localization experiments after the source cut is selected.

Relevant sources:

- [Runway Edit Studio](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio)
- [Runway Chat Mode](https://help.runwayml.com/hc/en-us/articles/42290974553875-Creating-with-Chat-Mode)
- [Luma Ray3 Modify](https://lumalabs.ai/news/ray3-modify)
- [Luma Modify Video API](https://docs.lumalabs.ai/docs/modify-video)
- [HeyGen video translation](https://help.heygen.com/en/articles/10029081-how-to-get-started-with-video-translation)
- [Synthesia storyboard docs](https://docs.synthesia.io/docs/storyboard)
- [ComfyUI workflow API format](https://docs.comfy.org/development/api-development/workflow-api-format)

## Open-Source And Code-First Building Blocks

### Core Media Operations

FFmpeg/ffprobe remain the base runtime for probe, trim, concat, subtitle burn-in, crop, scale, overlays, audio filters, and final encode. The important design pattern is to store both a structured render plan and the emitted FFmpeg command.

Useful hints:

- Keep `render-plan.json` separate from `edit-plan.json`.
- Store tool versions, input hashes, exact commands, output paths, warnings, and ffprobe summaries.
- Add decode/probe verification after render.

Sources:

- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)
- [FFmpeg subtitle burn guide](https://trac.ffmpeg.org/wiki/HowToBurnSubtitlesIntoVideo)

### Silence, Shots, And Timeline Interchange

Auto-Editor is a useful reference for silence/motion based first-pass cleanup, margins, and labels. PySceneDetect provides a practical local baseline for shot detection and keyframe/contact-sheet artifacts. OpenTimelineIO is the best reference for editorial timeline interchange.

Useful hints:

- Add `silences[]` with threshold, duration, start/end, padding, and method.
- Add `shots[]` with method, score, start/end, and keyframes.
- Keep Agent Cutroom's own JSON as canonical, but design toward OTIO export.

Sources:

- [Auto-Editor](https://github.com/wyattblue/auto-editor)
- [Auto-Editor docs](https://auto-editor.com/docs)
- [PySceneDetect CLI](https://www.scenedetect.com/docs/latest/cli.html)
- [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO)
- [OpenTimelineIO file format specification](https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html)

### Transcription And Word Timings

Word-synced captions require real word timings. WhisperX, stable-ts, whisper.cpp, faster-whisper, and the existing `transcribe-audio` workflow are relevant providers, but Agent Cutroom should keep the transcript interface provider-agnostic.

Useful hints:

- Require `segments[].words[]` for active-word captions.
- Store transcript provider, model, language, prompt/vocabulary, raw JSON path, text path, and warnings.
- Use `transcribe-audio` as the preferred local transcription-to-vault flow for Hanif's setup.

Sources:

- [WhisperX](https://github.com/m-bain/whisperx)
- [stable-ts](https://github.com/jianfch/stable-ts)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [OpenAI speech-to-text timestamps](https://developers.openai.com/api/docs/guides/speech-to-text)

### Programmatic Rendering And Motion

Remotion and HyperFrames show the strongest pattern for agent-authored polish: code is the source of truth, props/HTML drive the video, and CLI preview/lint/render makes the output reproducible.

Useful hints:

- Use HyperFrames for title cards, captions, lower thirds, kinetic pull quotes, overlays, and social compositions around a rough cut.
- Keep generated compositions in project folders with lint logs and rendered previews.
- Add "preview frame checks" before publishing.

Sources:

- [Remotion](https://www.remotion.dev/)
- [Remotion coding agents](https://www.remotion.dev/docs/ai/coding-agents)
- [Remotion agent skills](https://www.remotion.dev/docs/ai/skills)
- [HyperFrames](https://hyperframes.heygen.com/)
- [HyperFrames introduction](https://hyperframes.heygen.com/introduction)
- [HyperFrames prompting guide](https://hyperframes.heygen.com/guides/prompting)
- [HyperFrames GitHub](https://github.com/heygen-com/hyperframes)

### Agentic Video Repos To Study

The closest open-source/source-available neighbors are `video-use`, Vex, Monet, VibeFrame, and `mcp-video`.

Useful hints:

- CLI-first runtime with JSON output is the most reliable base.
- MCP should wrap the same operations, not become a second implementation.
- Project state, timeline history, safe working copies, dry runs, review packs, and machine-readable reports are worth borrowing.

Sources:

- [video-use](https://github.com/browser-use/video-use)
- [Vex](https://github.com/AKMessi/vex)
- [Monet](https://github.com/Monet-AI-Editor/Monet)
- [VibeFrame](https://github.com/vericontext/vibeframe)
- [VibeFrame MCP server README](https://github.com/vericontext/vibeframe/blob/main/packages/mcp-server/README.md)
- [mcp-video](https://github.com/KyaniteLabs/mcp-video)

## Academic And Technical Patterns

The papers reinforce a practical architecture:

- Transcript-first editing reduces search friction.
- B-roll insertion works best when tied to transcript positions and content recommendations.
- Highlight generation should produce ranked review windows, not automatic publishing.
- Agentic editing needs semantic indices, intermediate traces, and reviewable plans.
- Talking-head editing has special jump-cut and face-continuity risks.

Useful hints:

- Add `cutSuitability` per transcript span: silence before/after, visual stillness, face continuity, nearby shot boundary, transcript quality, and warning flags.
- Add `highlightCandidates[]` and `summaryCandidates[]` rather than one final answer.
- Add an edit-plan schema where every proposed cut has `start`, `end`, `reason`, `evidence[]`, `confidence`, and `warnings[]`.
- Make frame/clip selection a named context-selection step after full extraction.

Sources:

- [B-Script: Transcript-based B-roll Video Editing with Recommendations](https://arxiv.org/abs/1902.11216)
- [Text-based Editing of Talking-head Video](https://arxiv.org/abs/1906.01524)
- [Text-based Editing project page](https://www.ohadf.com/projects/text-based-editing/)
- [PodReels: Human-AI Co-Creation of Video Podcast Teasers](https://arxiv.org/html/2311.05867v2)
- [Prompt-Driven Agentic Video Editing System](https://arxiv.org/abs/2509.16811)
- [Computational Video Editing for Dialogue-Driven Scenes](https://graphics.stanford.edu/papers/roughcut/)
- [Moment-DETR / QVHighlights](https://arxiv.org/abs/2107.09609)
- [WhisperX paper](https://arxiv.org/abs/2303.00747)

## Creator And Platform Style Rules

For talking-head social clips, the practical style guide is consistent:

- Use a complete single moment as the default unit.
- Hook fast: first frame and first spoken line matter.
- Keep platform packaging native: 9:16 vertical, high resolution, readable captions, face-safe text, and no obvious recycled-watermark look.
- Use active-word captions only from real word timings.
- B-roll should clarify the exact claim being spoken or cover a rough visual transition.
- Package the output with a cover frame, title options, post copy, hashtags, source timestamps, and render metadata.

Specific guardrails to encode:

- TikTok: introduce the content proposition in the first 3 seconds, prioritize the hook in the first 6 seconds, use captions/text overlays, and keep overlay text around 5-10 words per second.
- YouTube Shorts: vertical 9:16, capture attention in the first few seconds, stay concise.
- Captions: one or two lines, high contrast, active word/keyword emphasis, face-safe placement.
- DCMP accessibility: captions should stay within safe zones, generally no more than two lines, and not interfere with important visuals.

Sources:

- [TikTok creative best practices](https://ads.tiktok.com/help/article/creative-best-practices)
- [TikTok Creative Codes](https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads)
- [YouTube Shorts guide](https://blog.youtube/creator-and-artist-stories/your-guide-to-getting-started-with-youtube-shorts/)
- [Instagram Reels guidance](https://creators.instagram.com/blog/instagram-reels-creators-simplify-video)
- [DCMP captioning tip sheet](https://dcmp.org/learn/225-captioning-tip-sheet)
- [DCMP Captioning Key](https://dcmp.org/learn/captioningkey)
- [Captions active-word highlights](https://captions.ai/help/guides/engagement/highlight-keywords)
- [Riverside B-roll guide](https://riverside.com/blog/b-roll)

## Agent Skills And Tooling Patterns

Skills are useful here because video production has exact workflow rules that agents forget if they only see generic docs. The best pattern is progressive disclosure: a short `SKILL.md` entrypoint plus optional references, scripts, templates, and examples.

MCP is useful as a discovery and typed-tool surface, but it should wrap the CLI and expose project artifacts as resources. The CLI should remain the stable runtime.

Useful hints:

- MCP tools: `init`, `prepare`, `observe`, `find_moments`, `plan`, `caption`, `render`, `verify`, `package`, `release_checkpoint`.
- MCP resources: `cutroom.json`, `timeline.json`, transcript, review pack, contact sheets, observations, edit plan, caption plan, render report, release manifest.
- MCP prompts: "review footage", "plan a rough cut", "make active-word captions", "package for Instagram", "create HyperFrames polish pass".
- Approval gates: pause before final render/release when the edit plan, caption plan, or generated B-roll changes creative intent.

Sources:

- [Anthropic Agent Skills repo](https://github.com/anthropics/skills)
- [Anthropic Agent Skills engineering post](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Agent Skills specification](https://agentskills.io/specification)
- [MCP tools spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP resources spec](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [MCP prompts spec](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)
- [OpenAI Agents SDK human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/)
- [ComfyUI workflow API format](https://docs.comfy.org/development/api-development/workflow-api-format)

## Recommended Agent Cutroom Additions

### Artifacts

Add or formalize these files:

```txt
project/
  cutroom.json
  timeline.json
  transcript/
    transcript.json
    transcript.txt
    provenance.json
  analysis/
    silences.json
    shots.json
    cut-suitability.json
    highlight-candidates.json
  review/
    review-pack.md
    decisions.json
  plans/
    edit-plan.json
    caption-plan.json
    broll-plan.json
    render-plan.json
    social-package.json
  renders/
    rough-cut.mp4
    captioned.mp4
    release.mp4
    render-report.json
  hyperframes/
    brief.md
    composition/
    lint-report.json
  release/
    release-manifest.json
    cover-frame.jpg
    post-copy.md
```

### Commands

Near-term commands worth adding:

- `find-moments`: produce ranked candidate windows from transcript, silences, frames, and a clip brief.
- `caption`: generate SRT/VTT/ASS from real word timings, including active-word ASS.
- `verify`: run ffprobe, decode checks, duration checks, preview-frame extraction, caption readability checks, and warning summaries.
- `package`: create platform-specific package manifests for Instagram, TikTok, YouTube Shorts, and LinkedIn.
- `export-otio`: export the chosen edit as OTIO for external NLE workflows.

### Skills

Add focused skills rather than one large all-purpose skill:

- `cutroom-review`: prepare footage, inspect contact sheets, record visual observations, and complete `review-pack.md`.
- `cutroom-rough-cut`: select candidate moments, inspect `edit-plan.json`, render, and verify rough cuts.
- `cutroom-captions`: generate word-synced ASS captions from `segments[].words[]`, burn subtitles, and inspect preview frames.
- `cutroom-social-package`: turn a rough cut into a platform package with crop, hook, cover frame, title options, post copy, hashtags, and source timestamps.
- `cutroom-hyperframes-polish`: create and verify HyperFrames title cards, overlays, lower thirds, pull quotes, and vertical compositions.
- `cutroom-release`: run final QA, write `release-manifest.json`, checksums, render report, and publish/readiness note.

### Style Packs

Create reusable style packs for:

- caption typography, outline, active-word color, line length, placement, and safe zones;
- platform dimensions and bitrate/export presets;
- hook title style and first-frame rules;
- lower thirds and pull quotes;
- B-roll pacing and default duration;
- brand colors, fonts, logos, intro/outro assets, and music rules.

### Review Gates

Use explicit checkpoints:

```txt
draft artifacts -> review pack -> decisions.json -> edit plan -> rough render
  -> caption/style plans -> polished render -> verify -> release manifest
```

Each gate should include:

- source paths and hashes;
- selected timestamps;
- reasons and warnings;
- preview frames/contact sheets;
- exact render commands;
- approval or rejection state.

## Practical Build Order

1. Formalize the artifact contract and schemas.
2. Add `caption` and `verify` because they immediately improve the current real-video workflow.
3. Add `find-moments` with candidate windows and reasons.
4. Add `social-package` and platform style packs.
5. Add focused skills for review, rough cuts, captions, social packaging, HyperFrames polish, and release QA.
6. Add an MCP wrapper that exposes the same CLI commands plus project artifacts as resources.
7. Add OTIO export once the edit-plan model stabilizes.

## Key Principle

Agent Cutroom should not compete by promising a more magical editor. It should compete by making an AI-assisted editor auditable: the agent can see the footage, explain the edit, revise it, render it, verify it, and leave behind a project folder that another agent or human can inspect later.
