# Sizzle — Product Requirements Document

**Tagline: Turn screenshots into videos that sell.**

One-liner: Sizzle takes 5 screenshots of your product and gives you back a launch-ready demo video in 60 seconds. No editor, no recording, no video skills.

| | |
|---|---|
| **Author** | Pratham |
| **Status** | Draft v1.0 |
| **Date** | July 2026 |
| **Doc type** | PRD with business context (BRD-lite sections included) |

---

## 1. Why this name and tagline

The naming wasn't a vibe pick. Here's the reasoning, so future copy decisions follow the same logic.

**Name: Sizzle.** A "sizzle reel" is the industry term for a short, high-energy promotional video. So the name literally describes the output while sounding like a consumer brand, not a dev tool. It's one syllable-and-a-half, spellable after hearing it once, and works as a verb ("just sizzle it"), which matters for word of mouth. Compare with the descriptive route (LaunchReel, DemoKit): clearer on first read, but generic, hard to trademark, and forgettable in a Product Hunt feed full of "-AI" names.

Domain reality: sizzle.com won't be available. Ship on **trysizzle.app**, **sizzle.so**, or **getsizzle.video** and let the product earn a better domain later. (Verify trademark availability in your launch markets before committing.)

Backup names, in order: **Stillmotion** (screenshots are stills, output is motion; clever but needs explaining), **LaunchReel** (clearest, dullest), **Demoforge** (fine, but sounds like a dev tool and we want marketers too).

**Tagline methodology.** Three classic copywriting frames were tested:

1. *Transformation frame* (input → output): "Screenshots in. Sales video out."
2. *Benefit frame* (what the customer gets): "Videos that sell your product."
3. *Enemy frame* (what we kill): "Fire your video editor."

The chosen tagline fuses frames 1 and 2: **"Turn screenshots into videos that sell."** Every word earns its place. "Turn" promises transformation. "Screenshots" signals the shockingly low input bar (this is the differentiator, so it goes in the tagline). "Videos that sell" names the outcome the buyer actually wants — nobody wants a video, they want conversions.

Secondary lines for specific surfaces:
- Hero sub-headline: "Your launch video, ready before your coffee is."
- Product Hunt tagline: "5 screenshots → 1 launch video in 60 seconds."
- Paid-tier page: "No seats. No export caps. No watermark."

Rule for all future copy: lead with the input ("just screenshots"), close with the outcome ("that sells"). Never lead with "AI" — in 2026 that's table stakes, not a differentiator.

---

## 2. Problem

Every software product needs video now. Launch posts with video outperform static posts, App Store listings need preview videos, and sales teams want demo clips for outreach. But making one is still miserable for small teams:

- A professionally produced demo video costs $1,000–5,000 per finished minute and takes weeks.
- DIY means learning After Effects or fighting a timeline editor for a weekend.
- Existing AI tools (Clueso, Guidde, Trupeer) all start from a **screen recording** — which assumes you have a working product, clean test data, a good mic, and the patience to re-record mistakes. Clueso's entry price is $120/month with export caps.
- Loom recordings exist by the millions but look like what they are: raw screen shares. Loom's own AI does summaries and filler-word removal, not production polish.

The gap: **nobody serves the person who has screenshots and a deadline.** Pre-launch founders with Figma mockups, indie hackers shipping on Product Hunt Friday, mobile devs needing App Store previews. They're the most urgent buyers and the least served.

---

## 3. Solution and product vision

**Phase 1 promise:** upload 3–8 screenshots, type your product name and one sentence, pick a vibe. Sixty seconds later: a 30-second video with animated zooms and pans across your screenshots, kinetic text callouts, music, your logo and brand color, exported in 16:9, 9:16, and 1:1.

**Long-term vision:** the programmatic video engine for product marketing. One input, N outputs — variants, languages, formats, all regenerable when your UI changes, all available via API. The engine is the moat; the screenshot tool is the wedge.

**Product principles:**
1. **Time-to-wow under 90 seconds.** If a first-time user doesn't have a shareable video within 90 seconds of landing, we failed.
2. **Output must be postable, not just watchable.** The bar is "would a founder proudly tweet this," not "is it technically a video."
3. **Every free video markets us.** Tasteful watermark on free tier; the videos spread, we spread.
4. **Never require a recording to get value.** Recordings are an upgrade, not a prerequisite.

---

## 4. Market and competition

Four camps exist today, none owning the screenshot-first slot:

| Camp | Players | What they need from you | Weakness we exploit |
|---|---|---|---|
| AI-enhanced recorders | Clueso, Guidde, Trupeer | A screen recording | $120/mo entry (Clueso), export caps, docs-tutorial look (Guidde) |
| Interactive demo platforms | Arcade, Supademo, Storylane, Navattic | Recording/HTML capture | Output is an embed, not a video you can post anywhere |
| Avatar/text-to-video | Synthesia, HeyGen | A script | Doesn't show your actual product |
| Async recorders | Loom (Atlassian), Tella, Screen Studio | A recording | Communication tools, not production tools; Loom explicitly unfit for polished marketing video |

Positioning statement: *For founders and product marketers who need a demo video now, Sizzle turns plain screenshots into launch-ready videos in under a minute — unlike Clueso or Guidde, which require screen recordings, cost 4–6x more, and cap your exports.*

Pricing anchors from the market: Clueso $120/mo entry, Guidde ~$18–23/creator, Arcade $32–42/seat, Loom Business+AI $24/seat. There's a wide-open lane at ~$19–29/mo flat with no seats and no caps.

---

## 5. Target customers

**Phase 1 ICP — "the Friday launcher."** Indie hackers, solo founders, student founders launching on Product Hunt, X, or LinkedIn. Budget: $0–50/month. Buying trigger: launch is days away, no video exists. They convert fast, tweet loudly, and don't ask for SOC 2. Found on: Product Hunt "coming soon" pages, IndieHackers, build-in-public X/LinkedIn.

**Phase 2 ICP — SaaS product marketing and CS teams** (seed to Series B). Budget: $50–300/month. Trigger: feature launches every sprint, help-center videos going stale, Clueso quote came in too high. They bring recordings and Loom libraries.

**Phase 3 ICP — agencies and growth teams.** Budget: $300+/month, want white-label and API. Trigger: producing ad variants and localized videos at volume for clients.

**Anti-persona (do not build for yet):** enterprises demanding SSO, SOC 2, procurement cycles. Politely take their money via concierge service if they insist, but no roadmap commitments until Phase 4 traction exists.

---

## 6. Scope by phase

### Phase 1 — "Launch video in 60 seconds" (weeks 1–6)

**In scope:**
- Input form: 3–8 screenshots (PNG/JPG, drag-drop), product name, one-line description, logo upload, brand color picker, template choice (3 launch styles at start: "Hype" / "Clean" / "Dark mode"), music choice (5 licensed tracks)
- Generation: AI writes the video script/story from the description + reads the screenshots to decide what to zoom on and what to call out
- Output: ~30s video, animated zoom/pan (Ken Burns done properly), kinetic text callouts, intro card with logo, outro card with CTA/URL; rendered in 16:9, 9:16, 1:1
- Watermarked free tier (3 videos/month, 720p), shareable link + MP4 download
- Landing page with 6 real example videos and a "made with Sizzle" gallery

**Out of scope for P1:** screen recording upload, voiceover, editing timeline, team features, API, more than 3 templates, auth beyond email magic-link.

**User stories:**
- As a founder launching Thursday, I upload 5 screenshots and get a video I actually post, without opening an editor.
- As a mobile dev, I upload app screenshots and get a 9:16 App Store preview.
- As a free user, I can regenerate with a different template until one feels right.

**P1 success criteria (gate to Phase 2):** 100+ videos created by strangers (not friends), ≥25% of completed videos publicly posted or shared, ≥10 unsolicited "can I pay to remove the watermark" signals.

### Phase 2 — Recordings and voice (months 2–4)

**In scope:** screen recording upload (and paste-a-Loom-link ingestion), auto-zoom on click points, dead-air/silence trimming, AI voiceover generated from the script, auto-captions, branded intro/outro applied to recordings, Pro tier launch.

**Out of scope:** live capture extension (upload only), multi-language, collaboration.

**Success criteria:** free→paid conversion ≥3%, ≥40% of paying accounts create 3+ videos/month (habit signal), churn <8% monthly.

### Phase 3 — Variants, languages, API (months 4–8)

**In scope:** one-click A/B variants (5 stylistic versions of one video), multi-language voiceover + captions, "regenerate from new screenshots" (solves the stale-demo-library pain nobody addresses), public API with per-render pricing, agency white-label option.

**Success criteria:** API revenue >15% of MRR, ≥3 agencies on white-label.

### Phase 4 — Enterprise-shaped (only on pull, not push)

PII auto-blur (emails, names, account numbers detected in frames), locked brand templates/governance, team workspaces, SSO. Architecture should keep the door open from day one; features get built when a named customer with budget asks.

---

## 7. Monetization

| Tier | Price | What's in it | Why it exists |
|---|---|---|---|
| Free | $0 | 3 videos/mo, 720p, watermark | Distribution engine, not revenue |
| Pro | $24/mo (₹999/mo India) | No watermark, 1080p, all formats, brand kit, 30 videos/mo | The workhorse. Priced at ~1/5 of Clueso entry. "No seats. No export caps." |
| Team | $69/mo | 3 brand kits, variants, languages, 100 videos/mo, light collaboration | Captures the P2/P3 ICP without seat-count friction |
| API | Usage-based, ~$1.50–3 per rendered minute | Programmatic generation, webhooks | Highest margin, stickiest; agencies bake it into workflows |
| Concierge (day 1) | $49 / ₹3,999 per video | "Send screenshots, get your launch video in 24h" | Revenue before the product is polished; every delivery is a portfolio piece and a pricing experiment |

Regional pricing matters: purchasing-power pricing for India/SEA on Pro (roughly 50% of USD) grows the loud early user base without cannibalizing US revenue.

Rules: no seat-based pricing before Phase 4 (it's the thing users hate about incumbents), and the free watermark stays small and classy — it's an ad, not a punishment.

---

## 8. Go-to-market

**Phase 1 playbook (cost: mostly time):**
1. **Concierge-first.** Before public launch, make 10 launch videos free for upcoming Product Hunt launches (find them on the "coming soon" page). Ask only for a "made with Sizzle" credit and a testimonial.
2. **Build in public.** Document the journey on X/LinkedIn — the before/after clips are inherently shareable content.
3. **Launch on Product Hunt with our own product's video, made by our product.** The meta-story is the hook.
4. **Watermark loop.** Every free video posted is an acquisition channel; track referral source from watermark clicks.

**Phase 2 additions:** SEO comparison pages ("Clueso alternative", "Guidde alternative", "how to make a demo video from screenshots") — this category demonstrably wins traffic through comparison content; a template gallery for long-tail SEO; cold outreach to companies whose public demo videos look dated (personalized: send them a Sizzle remake of their own video).

**Phase 3 additions:** agency partnerships, affiliate program (30% first-year), API developer docs and a launch on dev-tool directories.

---

## 9. Key metrics

- **North star: videos publicly shared per week.** Not videos created — shared. It captures output quality, user pride, and our distribution loop in one number.
- Activation: % of signups reaching a downloaded/shared video in first session (target ≥50%)
- Time-to-first-video (target: median <90s)
- Free→paid conversion (target ≥3% by month 4)
- Regeneration rate per video (proxy for output quality: lower is better after template selection, target <2.5)
- MRR, churn, API share of revenue (Phase 3)

---

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Output quality below "postable" bar → product is a toy | High (this is *the* risk) | Obsess over 3 templates that always look good rather than 10 that sometimes do; human-review the first 100 outputs; regeneration is free |
| Incumbent adds screenshot mode (Clueso/Arcade could) | Medium | Speed and price positioning; own the "launch video" identity and community before they notice the segment |
| Loom/Atlassian ships auto-zoom polish | Medium | They serve internal comms at $24/seat; our buyer is marketing. Differentiate on outputs (variants, formats, API) they'd never build |
| Music/asset licensing missteps | Medium | Only properly licensed tracks from day one; no user-uploaded audio in P1 |
| One-person execution bandwidth (final-year student + intern) | High | Phases are deliberately gated; concierge tier generates revenue and learning even when the product is half-built |
| AI costs erode margins at free tier | Low-Medium | Screenshot animation is cheap to render vs full video processing; cap free tier; watch cost per render weekly |

---

## 11. Open questions

1. Brand story tension: launch with "launch videos for founders" (emotional, viral) and migrate to "demo video infrastructure" (B2B, API) — or commit to infrastructure positioning from day one? Current lean: founders-first, migrate at Phase 3.
2. Should the concierge tier stay forever as a high-margin service, or sunset once self-serve quality is proven?
3. India-first launch (cheaper concierge validation, personal network) vs global-first (Product Hunt gravity)? Current lean: validate concierge in India, launch product globally.
4. Template licensing: build all motion templates in-house or commission 1–2 from a motion designer for the quality bar?

---

## Appendix A — Messaging cheat sheet

- Homepage hero: **Turn screenshots into videos that sell.**
- Sub: Your launch video, ready before your coffee is. 5 screenshots in, a scroll-stopping demo out.
- Objection killers: "No editor. No recording. No watermark on Pro. No seats. No export caps."
- Social proof line (after concierge phase): "Videos for N launches and counting."
- Never say: "AI-powered" in the hero (everyone says it, nobody believes it). Show the 60-second before/after instead.
