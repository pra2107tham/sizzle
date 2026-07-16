# 02 · Glossary

Shared vocabulary. If a term here is used loosely in code or docs, fix it.

**Edit Plan** — The single JSON document that fully determines a video. Schema-validated, versioned. Rendering is a pure function of it: same plan + assets in, same video out. The contract between the AI layer and the render layer. See `04-edit-plan-spec.md`.

**Spine** (a.k.a. render spine) — The minimal proof that plan → Remotion template → rendered MP4 works, with no recorder, no AI, no workflow engine, no evals. **Not yet built** — it is v1 (`docs/superpowers/plans/2026-07-15-render-spine-v1.md`).

**Region** — A rectangle (in *source-image pixel coordinates*) marking a meaningful part of a screenshot: a button, chart, panel. Produced deterministically by CV/OCR, then *selected* (never invented) by a VLM.

**Set-of-Mark (SoM)** — Prompting technique where numbered marks are overlaid on candidate regions and the VLM chooses among them by ID, so it never emits raw pixel coordinates. Core accuracy mechanism.

**Segment** — For recordings: a contiguous span of one activity (typing, clicking, scrolling, idle). The unit the zoom planner reasons over. Analogous to a "scene" for screenshots.

**Scene** — For screenshots: one beat of the video (intro, a feature shot, outro). Each scene is one entry in the Edit Plan's `scenes` array.

**Zoom choreography** — The rules that decide when/where/how much the virtual camera zooms: default ~1.5x, ~1.2s hold after a click, dead-zone for tiny moves, velocity gating (no zoom during fast transit), look-ahead before the next click. Deterministic.

**Metadata path** — Recording ingest where our own recorder logged cursor + clicks from the OS. Perfect signals, no CV. Preferred.

**CV recovery path** — Recording ingest for arbitrary uploads (incl. Loom) with no metadata. Recovers cursor (template match → CoTracker3), infers clicks (dwell + frame-diff), parses UI (OmniParser). The moat; also the risk.

**Synthetic cursor** — An oversized, smoothly-animated cursor drawn on top of the video at render time, following the smoothed path. The "buttery" Screen Studio look.

**Repair loop** — Bounded agentic step: when Scene QA fails, an LLM proposes a fix (rewrite headline, pick different region, swap asset), max 2 attempts, then human. The only place with real autonomy.

**Judge** — The VLM-as-judge that scores rendered stills against a fixed rubric (legibility, framing, "would a founder post this"). Temperature 0. Audited monthly against human labels.

**Golden set** — 30–50 curated input bundles spanning the ugly real world (dark mode, dense dashboards, mobile, non-English, low-res), each with expected *properties* (not pixel-perfect outputs). The regression gate in CI.

**First-pass rate** — % of videos that clear QA with zero repairs. Target >85%.

**Regeneration rate** — How often a user hits "try again." The honest online quality signal.

**Concierge tier** — Human-in-the-loop paid service ("send screenshots, get a video in 24h") used to earn revenue and learning before self-serve is polished.
