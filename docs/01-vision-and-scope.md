# 01 · Vision & Scope

## North star

Sizzle is the fastest way to turn what you already have — screenshots, or a rough screen recording — into a video good enough to post. The long-term vision is the programmatic video engine for product marketing: one input, many outputs (formats, languages, variants), regenerable when the UI changes, available via API. The engine is the moat; the screenshot tool is the wedge.

## Who it's for (in order)

1. **The Friday launcher** — indie hackers, solo/student founders shipping on Product Hunt/X. Screenshots + a deadline. Convert fast, share loudly.
2. **SaaS product marketing & CS teams** — feature launches every sprint, stale help-center videos, Clueso quote too high. Bring recordings and Loom libraries.
3. **Agencies & growth teams** — variants, localization, white-label, API at volume.

Anti-persona (not now): enterprises demanding SOC 2 / SSO / procurement. Serve via concierge if they insist; no roadmap promises until there's pull.

## The two product surfaces

- **Screenshots → video (Phase 1).** "Good enough" is the bar. Lowest input friction; works pre-launch (mockups). Cheap to render.
- **Recordings → video (Phase 2+).** Must *exceed* Clueso/Screen Studio: smooth synthetic cursor, spring auto-zoom on clicks, click ripples, studio audio. This is where we earn premium and reputation.

## Phases and gates

| Phase | Delivers | Gate to advance |
|-------|----------|-----------------|
| 1 · Screenshots | 30s branded launch video from stills | 100+ videos by strangers; ≥25% shared; ≥10 "let me pay to remove watermark" |
| 2 · Recordings | Cursor + click + auto-zoom + audio, own-recorder metadata path first, CV recovery second | Free→paid ≥3%; auto-zoom precision >90% on ground truth before it ships |
| 3 · Scale | Variants, languages, API, white-label | API revenue >15% of MRR; ≥3 white-label agencies |
| 4 · Enterprise | PII redaction, brand governance, SSO | Only on named-customer pull |

## Non-goals (things we deliberately don't build)

- A timeline video editor. We generate; we don't ask users to edit frame by frame. (A light "nudge the plan" UI is allowed later, not a full NLE.)
- Avatar/talking-head generation. Out of scope; partners exist.
- Live/real-time rendering. Offline render is fine and cheaper; quality beats latency here.
- Generative video for screen content. Screen pixels stay real and deterministic. Generative is decorative b-roll only, optional.
- Seat-based pricing before Phase 4. It's the thing users resent about incumbents.

## Principles (hold the line on these)

1. Time-to-wow < 90 seconds.
2. Output must be *postable*, not merely watchable.
3. Every free video markets us (tasteful watermark).
4. Never require a recording to get value.
5. AI decides *what* (regions, story, pass/fail); code decides *how* (coordinates, fitting, timing, rendering).
6. The Edit Plan is the single contract between intelligence and rendering.
