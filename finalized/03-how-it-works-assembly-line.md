# How It Actually Works — The Assembly Line (plain-English mental model)

**Finalized.** This is the intuition doc. If you're ever lost on "how do all these libraries fit together," read this. The formal version is `../docs/08-system-design.md` + `ADR-011` (recorder-first); this is the same thing explained by following one real video through the machine. (Note: under recorder-first, Stations 2–3 below — cursor recovery + click inference — are **deleted for v1**; our recorder logs that data from the OS. They return only for the v2 arbitrary-upload path.)

## The one idea to hold

It's an **assembly line, not a magic box.**

A raw recording goes in one end and passes through **stations**. Each station **does not change the video** — it just writes notes onto a shared clipboard (the **Edit Plan**, a JSON file). Only the very last station reads the whole clipboard and actually draws the polished video.

That's the entire architecture. **Every library's job is to add notes to the clipboard — except the last one, which reads the clipboard and paints.**

## Follow one video through the line

You record yourself creating an invoice — 40 seconds, 3 clicks, you talk. You upload `raw.mp4`.

| # | Station | What happens | Library | Clipboard gains |
|---|---|---|---|---|
| 1 | **Ingest** | Validate file; note it's 40s / 1920×1080 / 30fps; rip audio to `audio.wav` | FFmpeg | `video, duration, size` |
| 2 | **Watch the cursor** | Scan frames, *recover* where the mouse was 30×/sec (upload has no mouse log) | cursor-tracker (CV) | `cursorPath: [{t,x,y}, ...]` |
| 3 | **Find the clicks** | Spot the moments the mouse stopped + screen changed = clicks, with confidence | small rule (from Screen-Studio-Effects) | `clicks: [{t,x,y,confidence}]` |
| 4 | **Name what was clicked** | Look at the frame at each click: "that's the **Send button**, box (800,320)-(900,360)" | OmniParser | click gains `element, box` |
| 5 | **Transcribe** | Every word + timestamp; flag dead air (20–24s) and filler ("um") | WhisperX | `captions, cuts` |
| 6 | **The brain (AI)** | *The only station that decides.* Reads clicks+elements+transcript → editorial calls: "punch in on Send at 6.8s as they say 'hit send'"; "cut the dead air"; "caption here." Says **"zoom on element #3"**, never coordinates. | LLM/VLM (schema-locked) | `actions: [{type,target,start,hold}]` |
| 7 | **Decisions → camera moves** | Expand "zoom on Send 6.5–8.0s" into `camera.segments`, then precompute a smooth per-frame crop track (once) | Screen-Studio-Effects (vendored) | `camera.segments` + derived crop track |
| 8 | **Check** | Cheap code guardrails: zoom on-screen? caption not colliding? fix or flag. Nothing rendered yet. | our validators | — |
| 9 | **Paint the video** | Read the finished clipboard, draw every frame: `raw.mp4` zoomed via `cropTrack[frame]` + synthetic cursor + click ripples + captions | Remotion (custom compositor; `remotion-saas-showcase` for cursor/caption refs) | → frames |
| 10 | **Deliver** | Glue cleaned audio back, normalize loudness, export MP4 in 16:9 / 9:16 / 1:1 | FFmpeg | → final MP4 |

## Why it's built exactly this way

The clipboard-in-the-middle is the whole trick. It buys three things:

1. **Every library is swappable.** Whisper too slow? Swap Station 5. Better cursor CV later? Swap Station 2. Nothing else changes — they all just read/write the same clipboard.
2. **You can debug.** Bad video? Open its clipboard JSON and *see* the wrong decision. Never guessing.
3. **Same plan = same video, every time.** The consistency the product promises is free, because rendering is just "read clipboard, paint" — no AI, no randomness, at the paint step.

## The two-language split (why Python *and* TypeScript)

- **Stations 2–5 (CV + Whisper) = Python** — where the vision/audio ML libraries live. This is the "analysis sidecar."
- **Stations 1, 6–10 (plan, render, deliver) = TypeScript** — because Remotion is React; one language for the clipboard schema + render.

They talk by passing the clipboard JSON + file URLs. The "workflow engine" (Inngest → Temporal) is just the conveyor belt: run each station in order, retry if one trips, resume from the last good station on failure.

## What "building it" actually means

You do **not** build the hard parts (cursor smoothing, transcription, UI detection, rendering) — you **plug in** libraries for those. You build only:
- the **clipboard schema** (the Edit Plan),
- the **AI brain's prompt** (Station 6),
- the **glue** that passes the clipboard down the line.

## First thing to actually build

**The render spine (Station 9) with a hand-written plan.** Take a real recording, hand-write zoom **segments** (`camera.segments[]`) in an Edit Plan, watch Remotion paint it — the camera crop is precomputed once from the segments, then the renderer is a pure `cropTrack[frame]` lookup. This proves the paint end works before building the recorder or any AI. Everything else (the recorder, the planner) is added *behind* a spine you've already seen render. The concrete task-by-task version is `../docs/superpowers/plans/2026-07-15-render-spine-v1.md`.
