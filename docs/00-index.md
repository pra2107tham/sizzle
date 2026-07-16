# Sizzle — Project Documentation

**Turn screenshots into videos that sell.**

This is the source of truth for Sizzle. It's structured for spec-driven development: every build task should trace back to a spec in here, and every significant choice should be recorded as a decision. If code and these docs disagree, fix one of them the same day.

## How to use these docs

The intended loop:
1. A capability is described in the **PRD** (what & why, business framing).
2. Its mechanism is described in the **System Design** (how, at architecture level).
3. Its contract is pinned in the **Edit Plan Spec** — the JSON schema everything compiles to.
4. A phase-scoped **Build Spec** turns that into concrete, testable tasks.
5. Non-obvious choices get an **ADR** so future-you knows why.

Write the spec before the code. When a spec is ambiguous, resolve the ambiguity in the doc first, then implement. That's the whole discipline.

## Document map

| # | Doc | Purpose | Read when |
|---|-----|---------|-----------|
| 00 | This index | Orientation + workflow | First |
| 01 | `01-vision-and-scope.md` | The one-page north star, phases, non-goals | Aligning on direction |
| 02 | `02-glossary.md` | Shared vocabulary (Edit Plan, region, segment, etc.) | Anytime a term is unclear |
| 03 | `03-decisions-adr.md` | Architecture Decision Records | Before revisiting a settled choice |
| 04 | `04-edit-plan-spec.md` | **The contract.** Full Edit Plan JSON schema | Building anything that reads/writes a plan |
| 07 | `07-prd.md` | Product requirements + business context | Product/GTM decisions |
| 08 | `08-system-design.md` | Full technical architecture | Understanding the system end to end |
| 09 | `09-eval-and-quality-spec.md` | Golden set, judge rubric, quality gates | Building evals / defining "good" |
| 10 | `10-open-questions-and-risks.md` | Live risk register + unresolved questions | Planning, standups, reviews |

The `finalized/` folder holds the committed decisions in plain language (product in three points, feasibility, OSS leverage, the assembly-line mental model). The active build plan is `docs/superpowers/plans/2026-07-15-render-spine-v1.md`.

Diagrams (kept alongside): `sizzle-recording-flow-diagram.svg`, `sizzle-recording-hld.svg`.

## Current build target (recorder-first — see ADR-011)

We are building **recordings → polished video first**, captured by **our own recorder** (`{video.mp4, events.json}` with OS-provided cursor + clicks — not browser capture, not arbitrary upload). Upload + CV is a later v2 widening. Screenshots-input is parked. **`ADR-011` + `finalized/` + the render-spine plan are authoritative for what we build now.** Superseded docs (screenshots pipeline, browser-capture, upload-first) were deleted 2026-07-15; ADR-005/010 remain in the ADR log marked superseded, for history.

## Status at a glance

- **Render spine: NOT yet built** — the hand-written-plan → Remotion → MP4 path is described but no code exists on disk. Building it is v1 (`docs/superpowers/plans/2026-07-15-render-spine-v1.md`).
- **Now:** writing specs (this set) so Phase 1 becomes spec-driven.
- **Next build:** Phase 1 AI stages (understand → script → compile) against the Edit Plan spec, then Phase 2 recording spine (own-recorder metadata path first, CV recovery second).

## Naming & versioning conventions

- Edit Plan carries `plan_version` (semver). Breaking schema changes bump major.
- Prompts are versioned in-repo and stamped onto every plan they produce.
- ADRs are append-only and numbered; supersede rather than delete.
- Docs use present tense for current decisions, and mark anything speculative as "proposed."
