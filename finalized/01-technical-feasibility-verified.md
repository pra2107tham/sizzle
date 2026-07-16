# Technical Feasibility — Verified Against Library Docs

**Finalized.** Each pipeline stage was checked against the actual library documentation (Context7). Verdict per stage: does the library do what the architecture claims?

| Stage | Library | Claim | Verified? | Evidence |
|---|---|---|---|---|
| Ingest / Deliver | **FFmpeg** | probe, cut, extract audio, mux, encode per format | ✅ | Industry standard; Remotion itself hands frames to FFmpeg to encode |
| Base video in composition | **Remotion `OffthreadVideo`** | play uploaded file as base layer, `trimBefore`/`trimAfter` = cuts | ✅ | Confirmed API; `<Series>`/`<Sequence>` for clip placement |
| Layered actions | **Remotion `AbsoluteFill`** | stack cursor/spotlight/captions over video by DOM order | ✅ | Confirmed layering pattern in docs |
| Camera zoom + hold | **Remotion CSS transform** driven by a precomputed **crop track** | per-frame `scale`+`translate` from `cropTrack[frame]`; hold = flat region of the track; renderer is a pure stateless lookup | ✅ | Crop track computed once in `calculateMetadata`; `interpolate`/`Easing.spring` available too |
| Zoom algorithm | **Screen-Studio-Effects** (vendored) | smooth cursor, dwell→auto-zoom, **stateful per-frame crop** | ✅ | `buildSmoothedCursor`, `detectSilenceZones`, `generateAutoZoomSegments`, `evaluateZoom`. **`evaluateZoom` is a stateful sequential sim → run once in a compile pass, never per-frame in the renderer** |
| Cursor recovery (upload) | **cursor-tracker / Focus Cam** (OSS) | recover cursor path from a file with no metadata | ✅ | Template discovery → match → spatiotemporal path optimization |
| Transcript / captions / cuts | **WhisperX** | word-level timestamps + VAD silence for cutting | ✅ | `whisperx.align()` → `word['start']`/`word['end']`; `load_vad_model` + `vad_onset`/`vad_offset`, `no_speech_threshold` for silence |
| UI element context | **OmniParser** (Microsoft) | screenshot → interactable element boxes + labels | ✅ | `parse()` → `parsed_content_list`: `{type, bbox, interactivity, content}` per element |
| Render at scale | **Remotion Lambda** | parallel chunked render, dynamic per-job data | ✅ | `renderMediaOnLambda({inputProps})`; `getInputProps()` in composition; up to 200 functions |
| AI plan | LLM/VLM (schema-locked) | select moments + action type + captions; never coordinates | ✅ (design) | Selection-over-generation (`ADR-003`); OmniParser supplies boxes, LLM picks IDs |

## The one honest caveat (not a blocker, a gate)
Cursor/click recovery from an **arbitrary upload has no ground-truth metadata**, so accuracy is probabilistic. This is why `ADR-007` exists: click-driven auto-zoom is exposed only above ~90% inferred-click precision, measured against a hand-labeled set. Below that, degrade to dwell-only / fewer zooms. The gate is live from day one on the upload path — this is the real engineering risk and the moat.

## Verdict
**We are on the correct path.** Every stage maps to a real, documented, high-reputation library doing exactly what the architecture needs — no hand-waving, no library asked to do something it can't. The novel work is *integration* (glue + the AI plan step + tuning the CV precision), not inventing capabilities. The only genuine risk is CV precision on metadata-less uploads, and it's already fenced by `ADR-007`.
