# Open-Source Libraries & Repos That Make This Easier

**Finalized.** Swept the ecosystem for repos that collapse our pipeline stages. Ranked by leverage. **Read the license column — most Screen-Studio clones are AGPLv3, which is a real constraint for a closed-source SaaS.**

## Tier 1 — lift directly (algorithm / render layer)

| Repo | What it gives us | License | How we use it |
|---|---|---|---|
| **pythonlearner1025/Screen-Studio-Effects** | The zoom brain: cursor smoothing (spring), dwell→auto-zoom detection, per-frame crop, lookahead jitter cancel. TS **and** Rust. | check repo | Store `camera.segments[]` in the plan; run its (stateful) `evaluateZoom` **once in a compile pass** to precompute a per-frame crop track. Vendor the source (4-star repo, untrusted). |
| **codeverbojan/remotion-cinematic** | A **Remotion** product-demo template with **geometry-aware cursor that targets elements by ID**, element-ID-targeted AutoZoom, scene-relative camera, spring/elastic easing — *and ships a Claude skill*. | check repo | **Reference only** — it renders *synthetic* app UI from JSON descriptors; it does NOT composite a real uploaded/recorded video under a camera. Study its cursor/camera/easing code; our render layer is custom (real video base + overlay layers). |
| **s0974092/remotion-saas-showcase** | Remotion toolkit: `Cursor` (arrow/pointer + click anim), `BrowserFrame`, `PhoneFrame`, `TextOverlay`, focus `Indicator`. | check repo | Drop-in render components: synthetic cursor, device frames, callouts. Saves building each layer. |

## Tier 2 — study the algorithm, likely reimplement (licensing)

| Repo | What it gives us | License | Note |
|---|---|---|---|
| **CapSoftware/Cap** (17k★) | The upstream Screen-Studio-Effects was ported *from*. Full production recorder+editor: Rust `crates/cursor-capture`, `crates/rendering`, `crates/editor` (non-destructive), `crates/export`. Clean Rust/TS split — the architecture we'd converge on. | **AGPLv3** (except `scap-*`/`cap-camera*` = MIT) | Best architecture reference in the space. AGPL means we *study* it, not copy code into a closed product. The **MIT `scap-*` capture crates** are reusable if we ever go native. |
| **Focus Cam**, **Screenize**, **Reframed**, **Focra**, **Recordly** (19k★), **open-screenstudio**, **CursorLens** | Each is a working Screen-Studio clone: auto-zoom from dwell/clicks, spring cursor, **spotlight/dim**, click ripples, keystroke overlays, captions (local Whisper), multi-aspect export. | mostly **AGPL/GPL**; some MIT (CursorLens) / Apache (Screenize) | Gold for *how* to tune each effect (dwell thresholds, spring configs, spotlight radius). Pick the **MIT/Apache** ones (CursorLens, Screenize) if we want to borrow code, not just ideas. |

## Tier 3 — CV: cursor/click recovery from metadata-less upload (our hard stage)

| Repo | What it gives us | Note |
|---|---|---|
| **nitinnat/cursor-tracker** | Unsupervised cursor recovery from a raw video (YouTube URL even): template discovery → multi-scale match → spatiotemporal path optimization. | Directly the Stage-2 CV we need for uploads. Research-grade; validate accuracy. |
| **SeeAction** (arXiv paper + model) | Reverse-engineers `[command][widget][location]` from screencasts (11 commands, 11 widgets). | The "context" object for AI action placement (the `[command][widget]` pairing that makes zooms story-matched). Reference model, v2. |
| **Microsoft OmniParser** | Screenshot → interactable element boxes + labels. | Names the clicked element for zoom snapping (verified in `01`). Run on click frames only (cost). |

## Tier 4 — capture, only if/when we go native (not MVP)

`scap-*` (MIT, from Cap), `node-mac-recorder` (MIT, macOS), `uiohook-napi` (global mouse/keyboard hooks, used by most clones for the metadata path). **These ARE our recorder (Station 1) under ADR-011** — the recorder emits `{video.mp4, events.json}` with OS cursor + clicks. Must be MIT/Apache to paste (most Screen-Studio clones are AGPL, reference-only).

---

## The license reality (important)
The screen-recorder OSS space is **dominated by AGPLv3** (Cap, Focus Cam, Recordly, Focra, open-screenstudio). AGPL requires releasing your source if you offer the software as a network service — **incompatible with a closed-source SaaS unless we keep it at arm's length.** Practical rule:
- **Ideas & architecture from AGPL repos: fine.** Read them, learn the thresholds, copy nothing.
- **Code we paste must be MIT/Apache/BSD:** Screen-Studio-Effects (verify), CursorLens (MIT), Screenize (Apache), OmniParser, `scap-*` (MIT), cursor-tracker (verify).
- **Verify each license before pulling code** — several repos say "license coming soon" or NOASSERTION.

## Net effect on the build (under recorder-first, ADR-011)
- **Render layer:** components to adapt — `remotion-saas-showcase` (cursor, click anim, callouts) for reference; `remotion-cinematic` for cursor/camera/easing code (reference only, not our compositor). The compositor itself is custom (real video base + overlay layers).
- **Zoom algorithm:** solved — Screen-Studio-Effects (vendored; emits a stateful per-frame crop, so precompute a crop track once — don't call it per-frame in the renderer).
- **Capture (Station 1) IS our v1** — adapt an MIT/Apache recorder (`scap-*`, CursorLens, Screenize, or `uiohook-napi`) to emit `{video.mp4, events.json}`.
- **CV recovery (cursor-tracker + click inference + OmniParser):** the v2 moat — only needed when we add the arbitrary-upload path. Deleted from v1 by recorder-first.

So the genuinely-novel work shrinks to: **the AI plan step + CV precision tuning + gluing these together behind the Edit Plan contract.** Everything else has a reference implementation.
