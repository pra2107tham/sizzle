# 03 · Architecture Decision Records

Append-only. Each ADR: context, decision, consequences. Supersede rather than edit history.

---

## ADR-001 · Pipeline with fixed LLM steps, not an autonomous agent framework

**Status:** Accepted

**Context:** The product promise is consistency — same input reliably yields a postable video. Free-form multi-agent frameworks (CrewAI/AutoGen) optimize for flexibility on open-ended tasks and pay with variance: two runs on identical input diverge in plan, cost, and failure mode. Fatal for a rendering product.

**Decision:** Model Sizzle as a durable workflow with LLM judgment at three fixed points (understand, script, judge). Everything else is deterministic code. LLM outputs are schema-constrained and code-validated; LLMs never control flow. The only autonomy is a bounded repair loop (max 2 attempts → human).

**Consequences:** Predictable cost and behavior; easy debugging (open the trace + plan). Less "magic," more engineering. Still legitimately describable as multi-agent orchestration with evals — the disciplined, production-grade version. LangGraph acceptable as a deterministic DAG; Temporal/Inngest preferred for production semantics.

---

## ADR-002 · The Edit Plan JSON is the single contract

**Status:** Accepted

**Context:** Need to decouple intelligence from rendering so each can change independently, be tested, replayed, and eventually exposed via API.

**Decision:** Every AI stage compiles into one validated, versioned Edit Plan. Rendering is a pure function of (plan, assets). Nothing renders that isn't in the plan; nothing in the plan is un-validated.

**Consequences:** Regenerate plans without rendering; re-render without re-calling models; A/B templates on frozen plans; hand failing plans to the repair loop as small inspectable objects; the plan becomes the Phase 3 API surface. Requires disciplined schema versioning. Proven by the spine.

---

## ADR-003 · Selection over generation for spatial accuracy

**Status:** Accepted

**Context:** VLM-generated pixel coordinates drift and hallucinate; CV boxes are pixel-exact but semantically blind.

**Decision:** Deterministic CV/OCR produces candidate regions with exact boxes; the VLM only *selects and ranks* among numbered marks (Set-of-Mark). VLMs never emit coordinates.

**Consequences:** Eliminates the biggest accuracy failure mode (wrong-place zooms). Adds a CV/OCR dependency (PaddleOCR + OpenCV in a Python sidecar). Same pattern reused for recording UI targets via OmniParser.

---

## ADR-004 · Remotion + Lambda for rendering

**Status:** Accepted

**Context:** Need deterministic, parametrized, cheap, scalable rendering; team is TS-native; want in-browser preview equal to server render.

**Decision:** Templates are React/Remotion compositions; the Edit Plan is inputProps. Render on Remotion Lambda (own AWS account), distributed chunked parallel rendering, scale-to-zero.

**Consequences:** ~pennies per video; preview == render; one language across schema/compiler/validators/templates. Requires the Remotion "Automators" license ($0.01/render, $100/mo min) once operating as a company — budget from first paying month. Never bake secrets into templates (serve bundles are public); pass via inputProps.

---

## ADR-005 · Screenshots-first, recordings-second

**Status:** Accepted

**Context:** Recordings carry hidden friction (need a working product, clean data, good mic, large uploads). Screenshots are universal, work pre-launch, and are cheap to animate.

**Decision:** Ship screenshots → video as Phase 1 with a "good enough" bar. Recordings are Phase 2 with an "exceed Clueso" bar.

**Consequences:** Lowest activation barrier first; better early margins; a demo that never embarrasses. Recording quality expectations are deliberately higher and gated separately.

---

## ADR-006 · Dual ingest paths for recordings, one plan schema

**Status:** Accepted

**Context:** Our own recorder can log cursor+clicks from the OS (perfect signals). Arbitrary uploads (incl. Loom) have no metadata and need CV recovery, which is the risky part.

**Decision:** Two ingest paths — metadata (own recorder) and CV recovery (uploads) — both compile to the same Edit Plan. Build the metadata path first (de-risks the whole recording product); build CV recovery second as the moat, measured against ground truth.

**Consequences:** The visually impressive parts (camera, synthetic cursor, ripples) can ship with zero ML using perfect data. CV recovery becomes an isolated, measurable bet rather than a blocker.

---

## ADR-007 · Auto-zoom ships only above a precision threshold

**Status:** Accepted

**Context:** A zoom that fires on the wrong element (phantom click / missed click) reads as broken and worse than no zoom.

**Decision:** Auto-zoom from inferred clicks (CV path) ships only when click-inference precision exceeds ~90% on a held-out ground-truth set. Below that, degrade gracefully (fewer/no auto-zooms, or metadata-path only).

**Consequences:** Protects perceived quality. Requires a labeled ground-truth set (pynput logger, see build spec). Threshold is tunable with data.

---

## ADR-008 · Generative video excluded from screen content

**Status:** Accepted

**Context:** Generative video models hallucinate UI text and are non-deterministic per run — unacceptable when the actual product UI must be shown accurately.

**Decision:** Core screen content is 100% deterministic in Remotion. Generative video (Veo/Runway/etc.) is allowed only for optional, decorative intro/outro b-roll or backgrounds — never the screen itself.

**Consequences:** Brand-safe, reproducible output. Avoids dependency on volatile generative-video APIs. Optional b-roll behind an interface, re-evaluated quarterly.

---

## ADR-009 · Audio: enhance by default, replace optionally; ElevenLabs for shipped VO

**Status:** Proposed

**Context:** Raw mic narration is often poor; some users want a clean AI voice; Sizzle renders offline so quality dominates latency.

**Decision:** Default = clean the user's own voice (resemble-enhance / Adobe API) + filler/dead-air removal from Whisper word timestamps. Optional = AI voiceover replacement, ElevenLabs (Instant Voice Clone on v3) as the quality default, Cartesia as a cheap/high-volume tier. Cloning requires explicit consent.

**Consequences:** Studio sound without forcing voice replacement. Per-character API cost on the optional path; abstract providers behind one interface. Marked proposed pending Phase 3.

---

## ADR-010 · Build recordings first, capture in the browser; park screenshots-input

**Status:** SUPERSEDED by ADR-011 (browser-capture and upload-first both dropped in favor of an own-recorder). Kept for history. The "recordings before screenshots" call still holds; the *capture mechanism* here does not.

**Context:** ADR-005 chose screenshots-first as the low-friction wedge. Revised priority: build Clueso's actual flagship — recording → polished video — first, and capture **in the browser** (`getDisplayMedia`) rather than a native app, to ship fast on the platform we already develop on. Screenshots-input is not cancelled, just parked; the recording pipeline is the current build target. (Original analysis lived in the now-deleted `11-recording-mvp-browser.md`.)

**Decision:**
1. **Recordings before screenshots.** The recording → Edit Plan → Remotion path is what we build now. Docs `01`/`05`/`07`/`02` keep their screenshot content for reference but are not the current target; `11` is.
2. **Browser capture (Path A).** `getDisplayMedia` + `MediaRecorder` for video; `CaptureController.oncapturedmousechange` for cursor telemetry synced to the captured surface (the browser-native equivalent of Screen Studio's cursor log). Chromium-first; feature-detect and degrade.
3. **Reuse, don't rebuild.** Lift `pythonlearner1025/Screen-Studio-Effects` (MIT) for cursor smoothing, dwell-based auto-zoom detection, and per-frame crop; translate its output into Edit-Plan `camera.keyframes`. Clicks: exact when we own the page, else dwell/decel heuristic gated by ADR-007.
4. **Contract unchanged.** Everything still compiles to the 1.1 `timeline` Edit Plan (`04 §8`); Remotion stays the pure renderer. Native/system-wide capture later is an ingest swap, not a rewrite (ADR-006).

**Consequences:** Fastest path to a Screen-Studio-grade demo with near-zero ML (cursor telemetry is a native browser API; the motion algorithm is off-the-shelf). Limits: Chromium-only cursor events, no exact clicks on arbitrary surfaces (security boundary), OS cursor may burn into frames.

---

## ADR-011 · Own-recorder first (metadata path); upload/CV and browser-capture deferred

**Status:** Accepted (supersedes ADR-010's capture mechanism; keeps "recordings before screenshots")

**Context:** ADR-010 proposed browser capture; a later analysis proposed upload-first (arbitrary `.mp4`). Both put the hardest work — recovering cursor **and clicks** — on the critical path. Browser capture can get cursor position but not clicks on an arbitrary surface (security boundary). Upload has no mouse log at all, so clicks must be recovered from pixels by GPU-heavy CV gated at >90% precision (ADR-007) — the project's single biggest risk. There is a third option that sidesteps both: **control the recorder.**

**Decision:** Get cursor + click data from **our own recorder** (the "metadata path"). While recording, the OS hands us exact cursor position *and* exact clicks — zero CV, zero GPU. This is how every OSS Screen-Studio clone (Cap, Focus Cam, Screenize) works.

1. **Recorder-first.** A desktop recorder emits `{video.mp4, events.json}` (cursor ≥60Hz + clicks with timestamps). This is the v1 data source.
2. **Deletes the two hardest stations.** With OS-provided data, cursor-recovery (CV) and click-inference (CV + the ADR-007 gate) are **not built** for v1.
3. **UI parsing (OmniParser) kept but deferred** — repurposed from "did/where a click happened" to "*what* was clicked" (snap zoom to the element box + semantic context for the planner + named callouts). Enhancement, not blocker; GPU-gated; click-frames only.
4. **Upload + CV path becomes v2** — `cursor-tracker` (position) + click inference (gated) widen the product to "any video" once v1 works.
5. **Contract unchanged.** Compiles to the Edit Plan (schema bumps to 1.2 with `camera.segments[]`; see below). Remotion stays the pure renderer. Path swap, not rewrite (ADR-006).

**Consequences:** Fastest path to a working, stranger-usable product with no GPU. Cost: perfect clicks require a *desktop* recorder (a browser tab can't get arbitrary-page clicks), so v1 is a small native/Electron recorder rather than a web page. The GTM "we don't need a recording" wedge (07) is a *later* widening (v2 upload path), consciously sequenced after the engine works. Recorder OSS to adapt must be MIT/Apache (CursorLens, Screenize, `scap-*`); most Screen-Studio clones are AGPL (reference-only).

**Camera representation change (accompanies this ADR):** the Edit Plan stores zoom **segments** (`camera.segments[]`, schema 1.2), and a per-frame **crop track** is precomputed once in a compile step (the vendored `screen-studio-effects` `evaluateZoom` is a stateful sequential simulation and must not run per-frame inside the parallel/seeking Remotion renderer). `camera.keyframes[]` from ADR-010 is deprecated-unbuilt. See `04-edit-plan-spec.md` and the render-spine plan.
