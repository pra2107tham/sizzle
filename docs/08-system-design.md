# Sizzle — Technical System Design

**Author:** Senior Applied AI Engineering perspective · **Status:** Draft v1.0 · **Scope:** Phase 1 (screenshots → video) with Phase 2 deltas (recordings)

---

## 0. TL;DR — the five decisions that matter

1. **Pipeline, not autonomous agents.** Sizzle is a *workflow with LLM steps*, not a crew of agents talking to each other. LLMs make judgments at three fixed points (understand, script, judge); everything else is deterministic code. Agent autonomy is reserved for exactly one place: the bounded repair loop.
2. **The Edit Plan JSON is the product's spine.** Every AI stage compiles down to one validated, versioned JSON document. Rendering is a pure function of it: same plan in, same video out, every time. This is what makes output consistent and debuggable.
3. **Selection over generation.** VLMs never invent pixel coordinates. Deterministic CV/OCR finds candidate regions; the VLM only *chooses and ranks* among them (Set-of-Mark prompting). This single pattern eliminates the biggest accuracy failure mode.
4. **QA before render, not after.** Each scene is validated as a cheap still image before we pay for the full video render. Deterministic checks first (text fits, contrast passes, zoom in bounds), VLM-as-judge second.
5. **Remotion + Lambda for rendering.** Templates are React components; the Edit Plan is props. Distributed serverless rendering costs pennies per video and scales to zero.

---

## 1. Why not an agentic framework (CrewAI / AutoGen / free-form multi-agent)?

The product promise is *consistency*: a founder uploads screenshots and gets a postable video, every time. Free-form multi-agent systems optimize for the opposite property — flexibility on open-ended tasks — and they pay for it with variance. Two runs of a conversational agent crew on identical input produce different plans, different failure modes, different costs. That's fine for research assistants; it's fatal for a rendering product where "usually good" reads as "broken."

The industry data backs the instinct: the gap between an 80%-reliable demo and a production system is architectural robustness, and most agentic pilots die exactly there. The fix isn't a better agent framework, it's removing degrees of freedom.

So the rule for this system: **use an LLM only where human-like judgment is genuinely required, constrain its output to a schema, validate everything it says with code, and never let it control flow directly.** Control flow lives in a durable workflow engine with typed steps, retries, and state — the boring, reliable kind.

Where does agency survive? One place: the **repair loop**. When QA fails a scene, an LLM gets the failure report and the scene's plan fragment and proposes a fix, max 2 attempts, then escalates to human review. That's an agent with a two-step leash — all the benefit, none of the chaos.

(LangGraph is acceptable as the orchestrator if you want the graph ergonomics, run as a *deterministic DAG* with checkpointing — but a durable workflow engine like Temporal/Inngest gives you the same guarantees with better production semantics: idempotent steps, replay, timeouts, observability. Recommendation below.)

---

## 2. System overview

```
┌──────────┐   ┌───────────────────────────── ORCHESTRATOR (durable workflow) ─────────────────────────────┐
│ Next.js  │   │                                                                                            │
│ frontend │──▶│ 1.INGEST → 2.UNDERSTAND → 3.SCRIPT → 4.COMPILE+VALIDATE → 5.SCENE QA → 6.RENDER → 7.POST  │
│ (upload, │   │   (code)     (VLM+CV)      (LLM)        (code)             (stills+     (Remotion   (ffmpeg│
│ progress,│   │                                            │                judge)       Lambda)     +CDN) │
│ player)  │   │                                            ▼                   │                           │
└──────────┘   │                                     EDIT PLAN JSON ◀── repair loop (≤2) ──┘               │
               └────────────────────────────────────────────────────────────────────────────────────────────┘
                        Postgres (jobs, plans, scores) · R2 (assets, renders) · Langfuse/OTel (traces)
```

Every stage is an idempotent workflow step. Every artifact (screenshot analysis, script, plan, QA report, render) is persisted with the prompt version and model that produced it. A failed job resumes from its last completed step, never from zero.

---

## 3. The Edit Plan contract

The Edit Plan is a single JSON document, JSON-Schema validated, semver'd. Nothing renders that isn't in the plan; nothing in the plan is un-validated. Sketch:

```jsonc
{
  "plan_version": "1.3",
  "brand": { "logo_url": "...", "primary_hex": "#4F46E5", "product_name": "Acme", "cta_url": "acme.io" },
  "template_id": "hype_v2",
  "audio": { "track_id": "upbeat_03", "duck_under_vo": false },
  "formats": ["16x9", "9x16", "1x1"],
  "scenes": [
    {
      "id": "s2",
      "kind": "screenshot_feature",
      "asset_id": "shot_003",
      "duration_frames": 150,
      "headline": "Invoices in one click",        // ≤ 6 words, enforced
      "subline": "No more spreadsheet exports",
      "zoom": { "region_id": "r7", "scale": 1.6, "easing": "easeInOutCubic" },  // r7 = CV-detected box, not VLM-invented
      "callout": { "region_id": "r7", "style": "pill" },
      "transition_out": "push_left"
    }
  ]
}
```

Why this matters beyond tidiness: it decouples the AI layer from the render layer completely. You can regenerate a plan without re-rendering, re-render without re-calling models, A/B test templates on frozen plans, and hand a failing plan to the repair agent as a small, inspectable object. It's also the future API surface (Phase 3): customers POST inputs, get back a plan they can tweak, then render.

---

## 4. Pipeline stages in detail (Phase 1)

### Stage 1 — Ingest (deterministic)
Validate formats/dimensions, strip EXIF, reject NSFW/unsafe uploads (provider moderation endpoint), normalize to working resolution, extract dominant palette from screenshots+logo (suggests brand color, catches white-text-on-white disasters early). Store originals in R2.

### Stage 2 — Understand (CV/OCR + VLM, per screenshot, parallel)
This is where accuracy is won or lost, so it's engineered in two layers:

- **Layer A, deterministic detection:** OCR (PaddleOCR) for all text + boxes; OpenCV contour/edge detection + simple heuristics for UI regions (cards, buttons, nav, charts). Output: 10–30 candidate regions with precise pixel boxes, each assigned an ID and a numbered visual mark.
- **Layer B, VLM selection (Set-of-Mark):** send the screenshot *with numbered marks overlaid* to the VLM. It answers, in schema: what screen this is, which numbered regions are the most demo-worthy, what each does, caption candidates. The VLM picks `r7`; it never writes `x:412,y:200`.

Why: VLM-generated coordinates drift and hallucinate; CV boxes are pixel-exact but semantically blind. Selection fuses them. This is the same trick GUI-agent research converged on, applied to marketing video.

Model: a fast multimodal model (Gemini Flash-class or Haiku-class) is sufficient here and keeps per-screenshot cost at fractions of a cent. Temperature 0.

### Stage 3 — Script (LLM, once per video)
Input: product name/description, per-screenshot analyses, template's scene grammar (each template declares slots: intro / 3–5 feature beats / outro, with hard constraints like headline ≤ 6 words). Output, in schema: scene order, headlines/sublines, which region each scene zooms to, pacing.

Engineering notes: strongest model here (Sonnet-class) because copywriting quality is the perceived product quality; temperature ~0.6 for spark, but the schema and template grammar bound the blast radius; 3–5 few-shot golden examples per template pinned in the prompt; prompts versioned in-repo and stamped onto every plan.

### Stage 4 — Compile + validate (deterministic — the cheap guardrail army)
Compiler turns the script into a full Edit Plan, then runs validators that need zero AI:

- Text fitting: measure headline width with the *actual font metrics* at render size; overflow → auto-shrink one step or bounce back for a shorter line.
- Zoom sanity: region inside image bounds at target scale; zoom rect respects safe areas for the 9:16 crop.
- Contrast: WCAG ratio between text color and the sampled pixels behind it; fails → switch to scrim/pill style automatically.
- Timing: durations sum to target ±0.5s; min scene length enforced.
- Brand: logo present in intro/outro; CTA URL valid.

Roughly 80% of "AI made an ugly video" failures die here, for free, deterministically.

### Stage 5 — Scene QA (stills + VLM judge)
Before paying for video: render each scene's midpoint as a still (`renderStill`, ~1s each). Run the deterministic validators against the actual rendered pixels, then a cheap VLM judge scores each still on a fixed rubric — legibility, composition, does the zoom actually frame the claimed feature, overall "would a founder post this" — returning per-criterion scores in schema, temperature 0.

- All scenes pass threshold → proceed to render.
- A scene fails → **repair loop**: failure report + scene fragment go to the repair LLM, which may rewrite the headline, pick a different region, or swap the scene's asset. Recompile, revalidate, re-judge. Max 2 attempts, then the job is flagged; during concierge phase a human fixes it in minutes, and every human fix becomes a labeled example for the golden set.

### Stage 6 — Render (deterministic — Remotion Lambda)
Templates are Remotion compositions; the plan is `inputProps`. Lambda splits the video into chunks rendered in parallel across many functions, so a 30s video finishes in tens of seconds and you pay only while rendering — real-world numbers are pennies per render, with a typical animated composition landing around $0.01–0.03 of compute. Assets served from R2 to avoid S3 egress on every render. One deployed function serves all templates; plans parametrize everything.

Licensing note (business-relevant): Remotion is free for individuals/small orgs, but a company building an automated video pipeline needs the "Automators" license at $0.01/render with a $100/month minimum — budget it into unit economics from the first paying month.

### Stage 7 — Post-process + deliver
FFmpeg: mux licensed track, EBU R128 loudness normalization, H.264 MP4 per aspect ratio, poster frame, upload to R2, CDN URL back to the app. Optional watermark burn-in for free tier happens here (not in the template) so paid re-exports don't re-render.

---

## 5. Phase 2 deltas — recordings

The architecture doesn't change; three stages grow.

- **Ingest:** accept MP4/WebM upload and Loom link ingestion; ffprobe metadata; scene boundaries via ffmpeg scene detection; silence spans via `silencedetect`; audio extracted.
- **Understand:** Whisper transcription with word timestamps (also yields filler-word spans to cut); click/cursor moments via frame differencing + cursor template matching at ~5fps, with a low-fps VLM pass only on ambiguous segments ("what changed on screen here?") to keep cost sane. Output: an event timeline (click@t, scene@t, speech spans) — the recording's equivalent of Stage 2's regions.
- **Script:** now plans cuts, auto-zoom keyframes at click events, and a voiceover script; TTS (ElevenLabs/Cartesia-class) generates narration; captions come from the script with word timings.
- Everything downstream — compile, validate, still-QA, render, post — is unchanged, because the Edit Plan schema just gains `cut`, `zoom_keyframe`, and `vo` node types. That's the payoff of the contract-first design.

---

## 6. Evaluation system (the consistency engine)

Treat prompts and templates like code: nothing ships without passing evals.

**Golden set.** 30–50 curated input bundles (screenshots + descriptions) spanning the ugly real world: dark-mode apps, dense dashboards, mobile shots, non-English text, low-res images. Each has expected *properties*, not pixel-perfect outputs: "zoom lands on the pricing table," "headline ≤ 6 words," "contrast ≥ 4.5," "duration = 30s ± 0.5."

**Offline harness (CI).** On any prompt, model, or template change: run the full pipeline on the golden set, assert deterministic properties in code, VLM-judge the stills, produce a scorecard diff vs the last release. A prompt tweak that improves copy but drops zoom-accuracy 8% gets caught before users see it. This doubles as the portfolio-grade eval story: pass-rate dashboards per pipeline stage, regression history, judge-vs-human agreement tracking.

**Online monitoring.** Every job logs traces (OTel spans per stage; Langfuse/LangSmith for LLM spans with prompt versions), QA scores, retry counts, cost per video. The two numbers watched weekly: **first-pass rate** (videos needing zero repairs — target >85%) and **regeneration rate** (user hit "try again" — the honest quality signal). Concierge-phase human edits are diffed against machine plans and folded back into few-shots and the golden set: the data flywheel.

**Judge calibration.** Monthly, hand-label 30 stills and measure agreement with the VLM judge; if it drifts, fix the rubric before trusting it again. A judge nobody audits is just vibes with extra steps.

---

## 7. Deployment architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js on Vercel | Upload UX, progress via SSE/polling, Remotion Player for instant in-browser preview of the plan *before* final render — huge UX win, zero render cost |
| API + orchestration | Node/TypeScript (single monorepo with Remotion templates) | Remotion is TS-native; one language across plan schema (zod), compiler, validators, and templates removes a whole class of type-mismatch bugs |
| Workflow engine | Inngest (start) → Temporal (scale) | Durable steps, retries, backoff, fan-out for parallel screenshot analysis; Inngest's free tier fits a student budget and swaps out cleanly later |
| Models | Via OpenRouter/direct: fast multimodal for understand+judge, Sonnet-class for script, small model in repair loop | Right-size per stage; provider-agnostic behind one client, provider fallback on 5xx |
| CV/OCR | PaddleOCR + OpenCV in a small Python sidecar service (FastAPI) | Best OCR quality per dollar; isolated so the TS core stays clean |
| Rendering | Remotion Lambda (AWS, own account) | Distributed parallel rendering, pay-per-render, scales to zero; Cloud Run/own server only if volume makes flat-cost cheaper later |
| Storage/CDN | Cloudflare R2 + CF cache | Zero egress fees — matters doubly because Lambda pulls assets over HTTP during render |
| DB | Postgres (Supabase) | Jobs, plans, scores, users; already in the existing stack |
| Observability | OTel + Langfuse + Sentry | Trace every video end-to-end; debugging a bad video = opening its trace and plan, not guessing |
| CI/CD | GitHub Actions: tests → eval harness on golden set → deploy; template changes additionally render 3 reference videos for visual diff | Evals as a merge gate is the whole point |

**Unit economics per 30s video (Phase 1, rough):** understand 5 shots ≈ $0.01–0.02 · script ≈ $0.01 · stills+judge ≈ $0.01 · Lambda render ×3 formats ≈ $0.03–0.08 · Remotion license $0.01 · storage/CDN ≈ negligible → **≈ $0.07–0.13 all-in.** Free tier (3 videos/mo) costs well under $0.50/user/mo; Pro at $24 carries ~60–70 videos before margin pressure. Sustainable.

**Security/privacy:** EXIF stripped on ingest; signed URLs everywhere; uploads moderated; plans and assets deletable on request; no user assets in prompts beyond the job's own; API keys server-side only (Serve URL bundles are public — never bake secrets into templates, pass everything via inputProps).

---

## 8. Failure modes and their owners

| Failure | Caught by | Response |
|---|---|---|
| VLM misreads a screenshot region | Set-of-Mark constraint + still QA | Repair loop picks different region |
| Headline overflows / low contrast | Stage 4 validators (code) | Auto-fix (shrink/scrim) or bounce to script |
| Script quality is bland | Golden-set copy rubric in CI; regeneration-rate online | Prompt iteration behind eval gate |
| Provider outage / rate limit | Workflow retries + provider fallback | Job resumes from last step |
| Render crash / Lambda timeout | Chunked distributed render, per-chunk retry | Automatic; 30s videos never near limits |
| Judge drift | Monthly human-agreement audit | Rubric fix before trusting scores |
| Cost creep | Per-stage cost logged on every job | Weekly review; model right-sizing |

---

## 9. Build order (what I'd actually do first)

1. **Week 1 — prove the spine:** hardcode one Edit Plan by hand, build one Remotion template, render locally. If a hand-written plan doesn't produce a video you'd post, no AI will save it.
2. **Week 2 — Stage 2+3 offline:** notebook-grade pipeline: screenshots → CV/OCR marks → VLM selection → script → plan JSON. Eyeball 20 outputs.
3. **Week 3 — validators + still QA + repair loop.** This is where "demo" becomes "product."
4. **Week 4 — wire the workflow engine, Lambda rendering, minimal upload UI.** Ship to 5 concierge users.
5. **Weeks 5–6 — golden set + CI eval harness, second and third template, watermark, launch.**

The discipline: templates before models, contracts before prompts, validators before judges, judges before autonomy.
