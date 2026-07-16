# 09 · Eval & Quality Spec

How Sizzle defines and defends "good." Built when the project moves past hand-inspection (post Phase-1 T5). Treat prompts and templates like code: nothing ships without passing evals.

## 1. The golden set

30–50 curated input bundles spanning the ugly real world. Each bundle = inputs + expected *properties* (not pixel-perfect outputs).

**Coverage targets:**
- Dark-mode apps, light-mode apps
- Dense dashboards (many candidate regions) and sparse screens
- Mobile screenshots (portrait, 9:16-native)
- Non-English UI text
- Low-resolution / compressed uploads
- Screenshots with sensitive-looking data (for later PII work)
- Recordings: fast clicker, slow narrator, lots of dead air, cursor heavily occluded by menus

**Expected properties per bundle (examples):**
- "zoom in scene 3 lands on the pricing table" (region correctness)
- "all headlines ≤ 6 words"
- "text contrast ≥ 4.5:1 everywhere"
- "total duration = 30s ± 0.5"
- recordings: "auto-zoom fires within 0.3s of each ground-truth click"

## 2. Offline harness (CI gate)

Runs on any change to a prompt, model, or template.

1. Run the full pipeline on every golden bundle.
2. Assert deterministic properties in code (fast, free, exact).
3. VLM-judge the rendered stills on the rubric (§3).
4. Produce a scorecard; diff against the last release.
5. **Fail the merge** if any hard property regresses or judge score drops beyond tolerance.

Example catch: a prompt tweak improves copy but drops zoom-accuracy 8% → blocked before users see it.

For templates specifically, additionally render 3 reference videos and visual-diff frames.

## 3. Judge rubric (VLM-as-judge, temperature 0)

Score each rendered still 0–1 per criterion, schema-locked:
- **Legibility** — is all text readable against its background?
- **Composition** — is the framing balanced, subject not cut off?
- **Zoom correctness** — does the zoom actually frame the claimed feature?
- **Brand consistency** — colors/logo applied correctly?
- **Postability** — holistic "would a founder proudly post this?"

A scene passes if all criteria ≥ threshold (tune per criterion). Failing scenes trigger the repair loop (max 2, then human).

## 4. Judge calibration (don't trust an unaudited judge)

Monthly: hand-label 30 stills, measure agreement with the VLM judge. If agreement drifts below tolerance, fix the rubric before trusting scores again. A judge nobody audits is vibes with extra steps.

## 5. Online monitoring

Every production job logs: OTel spans per stage, LLM spans with prompt versions (Langfuse/LangSmith), QA scores, repair counts, cost per video.

**The two numbers watched weekly:**
- **First-pass rate** — videos needing zero repairs. Target > 85%.
- **Regeneration rate** — user hit "try again." The honest quality signal (lower is better after template selection; target < 2.5 regenerations/video).

## 6. The data flywheel

Concierge-phase and repair-loop human fixes are diffed against the machine's plan and folded back into (a) few-shot examples for the Script stage and (b) new golden-set bundles. Every human correction makes the next version better and guards against regressing that exact case.

## 7. Recording-specific evals (Phase 2)

- **Cursor path accuracy:** recovered vs. ground-truth pixel error distribution.
- **Click precision/recall:** vs. ground-truth log. Auto-zoom ship gate: precision > ~90% (ADR-007).
- **Zoom timing:** zoom-in begins within tolerance of the click; hold duration within tolerance.
- **Blind quality test:** metadata-path output vs. Screen Studio — testers can't reliably pick the better one.

## 8. What "done" means for a quality change

A prompt/template/model change ships only when: all hard properties pass, judge scores hold or improve, no regression on existing golden bundles, and (for templates) reference-video visual diff reviewed. Otherwise it's iterated behind the gate.
