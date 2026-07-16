# 10 · Open Questions & Risk Register

Living document. Review at planning and before phase gates. Close items by linking the ADR or spec that resolves them.

## Open questions (unresolved decisions)

| # | Question | Current lean | Resolve by |
|---|----------|--------------|-----------|
| Q1 | Brand story: "launch videos for founders" (viral, B2C) vs "demo video infrastructure" (B2B, API)? | Founders-first, migrate at Phase 3 | Before landing-page copy is finalized |
| Q2 | Keep concierge tier forever (high-margin service) or sunset once self-serve is good? | Keep as premium service | Phase 3 |
| Q3 | India-first concierge validation vs global-first Product Hunt launch? | Validate concierge in India, launch product globally | Before first public launch |
| Q4 | Build all motion templates in-house or commission 1–2 from a motion designer for the quality bar? | Commission 1 to set the bar, clone the rest | Phase 1 T2 |
| Q5 | Workflow engine: start on Inngest, migrate to Temporal at scale — when's the migration trigger? | Migrate when job volume/observability needs exceed Inngest tier | Phase 2 |
| Q6 | Voiceover provider default: ElevenLabs quality vs Cartesia cost as the shipped default? | ElevenLabs for shipped VO (offline render), Cartesia as volume tier | Phase 3 (ADR-009 proposed) |

## Risk register

| Risk | Likelihood | Impact | Mitigation | Owner/Status |
|------|-----------|--------|-----------|--------------|
| **Output quality below "postable"** → product reads as a toy | High | Critical | Obsess over 3 always-good templates over 10 sometimes-good; human-review first 100; free regeneration; the eval gate | The #1 risk. Active. |
| CV recovery (cursor/click) underperforms on real screen recordings | Medium | High | Ground-truth logger + precision gate (ADR-007); metadata path ships value regardless; measure before GA | Isolated bet, gated |
| Incumbent adds screenshot mode (Clueso/Arcade) | Medium | Medium | Speed + price positioning; own the "launch video" identity/community first | Watch |
| Loom/Atlassian ships auto-zoom polish | Medium | Medium | They serve internal comms; our buyer is marketing; differentiate on outputs (variants/formats/API) | Watch |
| ProPainter/OmniParser GPU cost erodes margins | Medium | Medium | Keyframes-only parsing; premium-gate inpainting; per-stage cost logging; weekly review | Design-mitigated |
| One-person bandwidth (final-year student + intern) | High | High | Phase gates; concierge revenue+learning even when product half-built; build metadata path before CV | Structural |
| Music/asset licensing misstep | Medium | High | Only licensed tracks day one; no user audio uploads P1; Remotion Automators license budgeted | Policy |
| Generative-video API volatility (e.g., Sora 2 API sunset) | Low | Low | Generative excluded from core (ADR-008); optional b-roll behind an interface; quarterly re-eval | Contained |
| Judge drift → trusting bad scores | Medium | Medium | Monthly human-agreement audit before trusting judge | Process (spec 09) |
| Voice-clone consent/legal | Low | High | Explicit consent required; providers mandate it; document consent flow | Policy (ADR-009) |

## Decisions already closed (see ADRs)
- Agent framework vs pipeline → ADR-001 (pipeline).
- Contract design → ADR-002 (Edit Plan).
- Spatial accuracy → ADR-003 (selection over generation).
- Rendering → ADR-004 (Remotion Lambda).
- Sequencing → ADR-005 (screenshots first).
- Recording ingest → ADR-006 (dual path).
- Auto-zoom safety → ADR-007 (precision gate).
- Generative video → ADR-008 (excluded from screen content).

## Review log
- 2026-07-12 — Initial register created alongside the doc set.
