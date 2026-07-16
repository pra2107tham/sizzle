# 04 · Edit Plan Specification

> **⚠️ Partially superseded (2026-07-15, ADR-011).** The v1 build uses schema **1.2**, recording-only, whose live source of truth is the zod schema in `packages/schema/src/plan.ts` (per the render-spine plan). Two deltas from what's written below: (1) **camera is `camera.segments[]`** (`{sourceStart, sourceEnd, amount, manualCenter?}`, times in seconds, `manualCenter` in UV [0,1]) — the `camera.keyframes` in §8 is **deprecated-unbuilt**; a per-frame crop track is precomputed from segments at compile time. (2) The **screenshots** halves (§7 scenes, regions) are parked. The principles, validation rules (§5), cursor/clicks/captions/cuts (§8), and provenance (§9) below still hold.

**This is the contract.** Every stage compiles to an Edit Plan; the renderer is a pure function of it. If you're building anything that reads or writes a plan, this is the authority. Version this document alongside the schema.

Current schema version: **`1.2`** (recording, `camera.segments[]`). History: `1.0` screenshots, `1.1` recording w/ `camera.keyframes` (deprecated), `0.1-spine`.

## 1. Core principles the schema enforces

1. **Coordinates are always source-image pixels**, never render-canvas pixels. The renderer computes the display scale. This keeps plans resolution-independent.
2. **The VLM selects region IDs; it never writes coordinates.** Coordinates come from CV/OCR only.
3. **Every constraint that can be checked by code is checked by code** before render (see §5).
4. **Additive evolution.** New optional fields are minor bumps; removing/retyping fields is a major bump.

## 2. Top-level shape

```jsonc
{
  "plan_version": "1.0",
  "job_id": "job_abc123",
  "source_kind": "screenshots",          // "screenshots" | "recording"
  "brand": { /* §3 */ },
  "template_id": "clean_v1",
  "fps": 30,
  "formats": ["16x9", "9x16", "1x1"],     // one render per format from this plan
  "audio": { /* §6 */ },
  "assets": [ /* §4 */ ],
  "scenes": [ /* §7 — screenshots */ ],
  "timeline": { /* §8 — recordings (present when source_kind=recording) */ },
  "provenance": { /* §9 */ }
}
```

## 3. Brand

```jsonc
"brand": {
  "product_name": "PayFlow",
  "primary_hex": "#4F46E5",
  "secondary_hex": "#312E81",     // optional; derived from primary if absent
  "logo_asset_id": "logo_01",     // optional
  "cta_url": "payflow.io",
  "tagline": "Invoicing on autopilot"
}
```
Rules: `primary_hex` required, validated hex. If `secondary_hex` absent, renderer derives a darker shade (no hardcoded gradient — this was a spine finding). `tagline` ≤ 40 chars.

## 4. Assets

```jsonc
"assets": [
  {
    "id": "shot_003",
    "kind": "screenshot",          // "screenshot" | "logo" | "video" | "audio"
    "uri": "r2://uploads/job_abc123/shot_003.png",
    "width": 1920, "height": 1080,
    "regions": [ /* §4.1, screenshots only */ ]
  }
]
```

### 4.1 Regions (produced by CV/OCR, selected by VLM)

```jsonc
"regions": [
  {
    "id": "r7",
    "box": { "x": 132, "y": 330, "w": 1268, "h": 310 },  // source-image px
    "kind": "chart",               // button|chart|panel|nav|text|input|card|other
    "text": "Revenue — last 12 months",   // OCR text if any
    "salience": 0.82,              // 0..1, CV/VLM importance; drives default zoom targets
    "interactable": false          // from OmniParser-style parsing (recordings/mobile)
  }
]
```
Rule: `box` must lie within the asset's `width`/`height`. `id` unique per asset.

## 5. Validation rules (run at compile time, before render)

These are the "guardrail army." A plan that fails any hard rule does not render.

**Hard (block render):**
- `plan_version` present and supported.
- Every referenced `asset_id` / `region.id` exists.
- Every `box` within its asset bounds.
- Scene/segment durations sum to target ± 0.5s; each ≥ min duration (see §7/§8).
- `primary_hex`, any color, valid hex.
- For zoomed regions: region fully visible at target scale within the chosen format's safe area (esp. 9:16 crop).
- Text contrast (headline/subline vs sampled pixels behind) ≥ WCAG 4.5:1; if fail, renderer must apply scrim/pill (plan flags `needs_scrim: true`).
- Headlines ≤ 6 words (screenshots) / caption lines ≤ configured width.

**Soft (warn, allow):**
- `salience` present for auto-selected regions.
- `secondary_hex` present (else derived).
- Music track present (else silent).

Text fitting uses **actual font metrics at render size**, not character counts.

## 6. Audio

```jsonc
"audio": {
  "music": { "track_id": "upbeat_03", "gain_db": -18, "duck_under_speech": true },
  "voiceover": {                     // recordings / optional
    "mode": "enhance",               // "none" | "enhance" | "replace"
    "source_asset_id": "narration_raw",
    "replace_voice_id": "eleven_xyz", // when mode=replace
    "language": "en"
  },
  "speech_spans": [ {"start": 6.8, "end": 12.1} ]   // for ducking + zoom sync
}
```

## 7. Scenes (screenshots — schema 1.0)

Ordered array. Kinds: `intro`, `screenshot_feature`, `outro`.

```jsonc
{
  "id": "s2",
  "kind": "screenshot_feature",
  "asset_id": "shot_003",
  "duration_frames": 100,           // min 60 for feature, min 45 intro/outro
  "headline": "See every dollar",   // ≤ 6 words
  "subline": "Revenue and overdue at a glance",
  "zoom": {
    "region_id": "r7",              // MUST reference a region on this asset
    "scale": 1.45,                  // 1.0..2.0 screenshots
    "easing": "spring"              // "spring" | "easeInOutCubic"
  },
  "callout": {
    "region_id": "r7",
    "label": "Live revenue",
    "anchor": "top-left",           // top-left | bottom-left | auto
    "style": "pill"
  },
  "transition_out": "push_left"     // cut | fade | push_left | push_up
}
```
`intro`/`outro` omit `asset_id`/`zoom`/`callout` and carry `headline`+`subline` only.

Callout rule (spine finding): a callout must not occlude the region's own text; renderer offsets or `anchor:auto` resolves placement, and validation warns if overlap is unavoidable.

## 8. Timeline (recordings — schema 1.1)

Present when `source_kind: "recording"`. Replaces `scenes`. The recording is one continuous asset with a time-based plan.

```jsonc
"timeline": {
  "base_asset_id": "rec_main",
  "duration_frames": 1140,          // after cuts
  "cuts": [ {"from_s": 18.2, "to_s": 22.6} ],   // dead air / filler removed
  "cursor": {
    "path": [ {"t": 0.0, "x": 1412, "y": 96}, {"t": 0.033, "x": 1408, "y": 99} ],  // source px, smoothed
    "source": "os_log",             // "os_log" (metadata path) | "cv_recovered"
    "synthetic_style": "large_light",
    "confidence": 1.0               // 1.0 for os_log; <1 for cv_recovered
  },
  "clicks": [
    { "t": 6.8, "x": 812, "y": 340, "target_region_id": "r3", "confidence": 0.94, "ripple": true }
  ],
  "camera": {                        // keyframes from the zoom choreography engine
    "keyframes": [
      { "t": 6.5, "scale": 1.0, "cx": 960, "cy": 540 },
      { "t": 6.8, "scale": 1.5, "cx": 812, "cy": 340, "easing": "spring" },
      { "t": 8.0, "scale": 1.5, "cx": 812, "cy": 340 },
      { "t": 8.4, "scale": 1.0, "cx": 960, "cy": 540, "easing": "spring" }
    ]
  },
  "captions": [
    { "start": 0.4, "end": 2.1, "text": "Creating an invoice takes one click" }
  ]
}
```

### 8.1 Zoom choreography constraints (encoded by the planner, checked by validator)
- Default `scale` ≈ 1.5 (range 1.5–4.0 for dramatic close-ups).
- Hold ≈ 1.2s after a click before zooming out.
- Dead-zone: cursor moves under ~1% of frame within ~50ms don't create pan keyframes.
- Velocity gating: no zoom-in during fast transit segments.
- Look-ahead: zoom-in keyframe may begin ~0.3s before the click `t`.
- Min interval between distinct zooms enforced (no jackhammering).
- Every camera `cx/cy` + `scale` must keep content within the format safe area.

### 8.2 Click → zoom gating (ADR-007)
If `cursor.source == "cv_recovered"`, only clicks with `confidence ≥ 0.9` may spawn auto-zoom keyframes. Lower-confidence clicks may still show a ripple but must not drive the camera.

## 9. Provenance (stamped on every plan)

```jsonc
"provenance": {
  "created_at": "2026-07-12T09:00:00Z",
  "prompt_versions": { "understand": "u_2.1", "script": "s_3.0" },
  "models": { "understand": "vlm-fast", "script": "sonnet-class", "judge": "vlm-fast" },
  "compiler_version": "1.0.3",
  "qa": { "first_pass": true, "repairs": 0, "judge_scores": {"s2": 0.88} }
}
```
Purpose: every video is reproducible and debuggable from its plan alone.

## 10. Change log

- `0.1-spine` — hand-written, minimal (brand, scenes, inline zoom boxes). Proved render path.
- `1.0` — assets+regions split out, validation rules, provenance, formats array, audio.
- `1.1` — `timeline` block for recordings (cursor, clicks, camera, captions, cuts).

## 11. Reference: minimal valid plan

**No worked-example plan exists on disk yet** (earlier drafts referred to a "spine `editplan.json`" that was never committed). The first real example will be `samples/demo01/editplan.json`, hand-written in Task 5 of the render-spine plan — a minimal valid **1.2** recording plan (`base`, `camera.segments`, `captions`). That becomes the canonical reference once it renders.
