# Sizzle — The Product in Three Points

**Finalized summary.** This folder holds decisions we've committed to. For the full reasoning, see `../docs/` (esp. `ADR-011` — recorder-first — and `08-system-design.md`).

One line to hold onto: **AI decides *what*, code decides *how*, one JSON Edit Plan is the contract between them.**

---

## 1. What the final product looks like (user's view)

Record with our recorder (v1) — or upload a raw recording (v2) → wait ~1–2 min → download a polished demo video.

The raw, wide, static, shaky recording comes back with:
- the camera **punching in on each click** and holding while you work,
- a **smooth oversized cursor** with click ripples,
- **dead air and filler ("ums") cut out**,
- **subtitles** (and optionally an AI voiceover),
- your **brand / intro / outro**,
- exported in **16:9, 9:16, 1:1**.

No timeline, no editing. Recording in, postable video out.

## 2. What happens behind the scenes

```
Record  →  {video.mp4, events.json}   (OUR recorder logs cursor + clicks from the OS — no CV)
  → INGEST      FFmpeg: probe, normalize, pull audio, find silences
  → ANALYZE     Whisper → transcript + timings.  (events.json already has exact cursor + clicks.)
                [deferred] OmniParser names the clicked element for prettier framing
  → PLAN        picks WHICH moments get WHICH action + writes captions   ← the brain
                (rules first, LLM later; data gives the pixel box; AI never emits coordinates)
                → produces one Edit Plan JSON (the contract)
  → VALIDATE    code guardrails: in-bounds, safe-area, timing, contrast
  → RENDER      Remotion: video as base layer + zoom/cursor/caption layers
  → DELIVER     FFmpeg: mux audio, loudness, encode per format
```

Everything compiles to **one Edit Plan JSON**; the renderer is a pure function of it (same plan in → same video out). The planner decides *what / where-in-time / why*; deterministic code decides *coordinates / timing / pixels*.

**Recorder-first (ADR-011) deletes the two hardest stations:** because our recorder logs cursor + clicks from the OS, there is no cursor-recovery and no click-inference CV in v1. Upload + CV (recovering both from an arbitrary `.mp4`) is a later v2 that widens us to "any video."

## 3. Which architecture fits

A **durable pipeline (workflow with fixed steps), not autonomous agents** — because the promise is *consistency*, and agents give variance.

- **Orchestration:** durable workflow engine (Inngest → Temporal). Each stage is an idempotent, retryable step; a failed job resumes from its last step. Fan-out for parallel analysis.
- **Two runtimes:** a **Python sidecar** (Whisper now; UI-parsing + the v2 upload-CV later) + a **TypeScript core** (Edit Plan schema, validators, Remotion) — one language across schema → compiler → renderer.
- **Render:** Remotion (Lambda later for scale; local for v1). FFmpeg for ingest + delivery.
- **AI:** rules planner first; LLM only at the *plan* step, schema-locked, code-validated — never controlling flow, never emitting coordinates. One bounded repair loop is the only autonomy.

This is what `ADR-001` and `08 §0` already commit to. Recorder-first (ADR-011) *lightens* the analyze stage for v1 — the recorder supplies the cursor/click data that CV would otherwise have to recover.
