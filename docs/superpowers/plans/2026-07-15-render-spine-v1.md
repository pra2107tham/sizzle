# Render Spine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a hand-written Edit Plan JSON into an MP4 where the camera punches into hand-picked regions of a real screen recording, holds, releases, and shows captions — proving the "paint end" of the pipeline before any recorder, CV, or AI exists.

**Architecture:** A pnpm monorepo. `packages/schema` holds the Edit Plan zod contract plus a `segmentsToCropTrack()` function that runs the (vendored, stateful) `screen-studio-effects` zoom simulation **once, sequentially**, producing a per-frame crop track. `packages/render` is a Remotion project whose composition computes that crop track in `calculateMetadata` (runs once, before Remotion's parallel/seeking frame render) and passes it as a prop; the camera component is a pure stateless `cropTrack[frame]` lookup applied as a CSS transform over an `OffthreadVideo` base layer, with captions layered on top.

**Tech Stack:** TypeScript, pnpm workspaces, Remotion (`OffthreadVideo`, `AbsoluteFill`, `calculateMetadata`, `interpolate`), Zod, vitest, vendored `screen-studio-effects` (spring-physics zoom algorithm).

## Global Constraints

- **Node** ≥ 20, **pnpm** ≥ 9 (Remotion + workspace requirement).
- **Zoom is precomputed, never evaluated per-frame in a React component.** `screen-studio-effects`'s `evaluateZoom(segments, time, pos, state, lookahead)` is a *stateful sequential spring simulation* (mutates `state` from `createZoomState()`, reads a lookahead into future frames). Remotion renders frames non-sequentially and in parallel (Studio seeking, Lambda chunking) — calling it per-frame gives non-deterministic crops and seams. All crop computation happens in ONE forward pass in `segmentsToCropTrack()`.
- **`ZoomSegment` shape is fixed by the vendored lib** (`src/types.ts`): `{ sourceStart: number (sec), sourceEnd: number (sec), amount: number, manualCenter?: [u, v] (UV 0–1), instantAnimation?: boolean }`. There is **no `mode` field** — a segment with `manualCenter` set is fixed-center; a segment with `manualCenter` undefined is auto/follow (needs a real cursor path, so v1 ONLY uses `manualCenter`).
- **`CropBounds` shape is fixed by the vendored lib:** `{ x, y, w, h }` in normalized UV [0,1]. Full frame = `{x:0,y:0,w:1,h:1}`.
- **Coordinates in the Edit Plan camera are UV [0,1], not pixels.** (Corrects the strategic plan doc, which said pixels.)
- **Vendor `screen-studio-effects`, do not depend on the npm package** (4-star repo, untrusted). Copy its `src/` into `packages/schema/src/vendor/screen-studio-effects/`, pin the source commit in a `VENDOR.md`.
- **Commit after every green test.** Conventional commit messages.

---

### Task 1: Monorepo scaffold + git init

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/vitest.config.ts`

**Interfaces:**
- Produces: a buildable `@sizzle/schema` workspace package that later tasks add source to.

- [ ] **Step 1: Initialize git (repo is not yet a git repo)**

Run:
```bash
cd /Users/prathamshirbhate/Desktop/sizzle && git init
```
Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Write root `package.json`**

Create `package.json`:
```json
{
  "name": "sizzle",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Write `.gitignore`**

Create `.gitignore`:
```
node_modules/
dist/
out/
*.log
.DS_Store
packages/render/out/
```

- [ ] **Step 5: Write the schema package manifest**

Create `packages/schema/package.json`:
```json
{
  "name": "@sizzle/schema",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 6: Write `packages/schema/tsconfig.json`**

Create `packages/schema/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Write `packages/schema/vitest.config.ts`**

Create `packages/schema/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 8: Install and verify the workspace resolves**

Run:
```bash
cd /Users/prathamshirbhate/Desktop/sizzle && pnpm install
```
Expected: installs without error; `packages/schema` recognized as a workspace package.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with schema package"
```

---

### Task 2: Vendor screen-studio-effects

**Files:**
- Create: `packages/schema/src/vendor/screen-studio-effects/` (copied source: `types.ts`, `spring.ts`, `cursor.ts`, `auto-zoom.ts`, `zoom.ts`, `index.ts`)
- Create: `packages/schema/src/vendor/screen-studio-effects/VENDOR.md`

**Interfaces:**
- Produces: `import { evaluateZoom, createZoomState, type ZoomSegment, type CropBounds, type SmoothedCursor } from "./vendor/screen-studio-effects/index.js"`
- Key signatures (from upstream `src/`):
  - `createZoomState(): ZoomState`
  - `evaluateZoom(segments: ZoomSegment[], timeSecs: number, cursorPos: {u:number,v:number}, state: ZoomState, lookahead: (t:number)=>{u:number,v:number}, springConfig?: SpringConfig): CropBounds`
  - `ZoomSegment = { sourceStart: number; sourceEnd: number; amount: number; manualCenter?: [number, number]; instantAnimation?: boolean }`
  - `CropBounds = { x: number; y: number; w: number; h: number }`

- [ ] **Step 1: Copy the upstream source**

Clone the repo to a temp dir and copy its `src/` (TypeScript, NOT the `rust/` dir) into the vendor folder:
```bash
cd /tmp && git clone https://github.com/pythonlearner1025/Screen-Studio-Effects.git sse-vendor
mkdir -p /Users/prathamshirbhate/Desktop/sizzle/packages/schema/src/vendor/screen-studio-effects
cp /tmp/sse-vendor/src/*.ts /Users/prathamshirbhate/Desktop/sizzle/packages/schema/src/vendor/screen-studio-effects/
git -C /tmp/sse-vendor rev-parse HEAD
```
Note the printed commit hash for Step 2. If any `import` uses `.js` extensions that fail under `Bundler` moduleResolution, they resolve fine — leave them.

- [ ] **Step 2: Record provenance**

Create `packages/schema/src/vendor/screen-studio-effects/VENDOR.md`:
```markdown
# Vendored: screen-studio-effects
Source: https://github.com/pythonlearner1025/Screen-Studio-Effects
Commit: <paste the hash printed in Step 1>
Vendored: 2026-07-15
Reason: 4-star repo, untrusted as a dependency. Pinned copy for reproducibility.
Only src/*.ts (the TS implementation) is vendored; rust/ is omitted.
```

- [ ] **Step 3: Verify it type-checks inside our package**

Create a throwaway `packages/schema/src/vendor/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createZoomState, evaluateZoom } from "./screen-studio-effects/index.js";
import type { ZoomSegment } from "./screen-studio-effects/index.js";

describe("vendored screen-studio-effects", () => {
  it("returns a full-frame crop when no segments are active", () => {
    const segments: ZoomSegment[] = [];
    const state = createZoomState();
    const crop = evaluateZoom(segments, 0, { u: 0.5, v: 0.5 }, state, () => ({ u: 0.5, v: 0.5 }));
    expect(crop.w).toBeCloseTo(1, 2);
    expect(crop.h).toBeCloseTo(1, 2);
  });
});
```

- [ ] **Step 4: Run the smoke test**

Run:
```bash
cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm test
```
Expected: PASS. If the vendored code needs a tsconfig tweak (e.g. `allowJs`), fix `packages/schema/tsconfig.json` until it passes. Then delete `smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
rm packages/schema/src/vendor/smoke.test.ts
git add -A
git commit -m "vendor: pin screen-studio-effects source"
```

---

### Task 3: Edit Plan schema (zod)

**Files:**
- Create: `packages/schema/src/plan.ts`
- Test: `packages/schema/src/plan.test.ts`

**Interfaces:**
- Produces:
  - `editPlanSchema` (zod schema) and `type EditPlan = z.infer<typeof editPlanSchema>`
  - `type CameraSegment = { sourceStart: number; sourceEnd: number; amount: number; manualCenter?: [number, number] }`
  - `type Caption = { start: number; end: number; text: string }`
  - Shape (schema 1.2, recording-only subset needed to render):
    ```
    { plan_version: "1.2", job_id: string, source_kind: "recording", fps: number,
      base: { uri: string, width: number, height: number, durationSec: number },
      camera: { segments: CameraSegment[] },
      captions: Caption[] }
    ```

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/plan.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { editPlanSchema } from "./plan.js";

const valid = {
  plan_version: "1.2",
  job_id: "demo01",
  source_kind: "recording",
  fps: 30,
  base: { uri: "raw.mp4", width: 1920, height: 1080, durationSec: 40 },
  camera: { segments: [{ sourceStart: 6.5, sourceEnd: 8.4, amount: 1.5, manualCenter: [0.42, 0.31] }] },
  captions: [{ start: 0.4, end: 2.1, text: "Creating an invoice takes one click" }],
};

describe("editPlanSchema", () => {
  it("accepts a valid recording plan", () => {
    expect(editPlanSchema.parse(valid)).toMatchObject({ job_id: "demo01" });
  });

  it("rejects amount below 1", () => {
    const bad = { ...valid, camera: { segments: [{ sourceStart: 1, sourceEnd: 2, amount: 0.5 }] } };
    expect(() => editPlanSchema.parse(bad)).toThrow();
  });

  it("rejects manualCenter outside 0..1", () => {
    const bad = { ...valid, camera: { segments: [{ sourceStart: 1, sourceEnd: 2, amount: 1.5, manualCenter: [1.4, 0.2] }] } };
    expect(() => editPlanSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm test`
Expected: FAIL — cannot resolve `./plan.js`.

- [ ] **Step 3: Write the schema**

Create `packages/schema/src/plan.ts`:
```ts
import { z } from "zod";

const uv = z.number().min(0).max(1);

export const cameraSegmentSchema = z.object({
  sourceStart: z.number().nonnegative(),
  sourceEnd: z.number().nonnegative(),
  amount: z.number().min(1).max(4),
  manualCenter: z.tuple([uv, uv]).optional(),
}).refine((s) => s.sourceEnd > s.sourceStart, { message: "sourceEnd must exceed sourceStart" });

export const captionSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string().min(1),
});

export const editPlanSchema = z.object({
  plan_version: z.literal("1.2"),
  job_id: z.string().min(1),
  source_kind: z.literal("recording"),
  fps: z.number().int().positive(),
  base: z.object({
    uri: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationSec: z.number().positive(),
  }),
  camera: z.object({ segments: z.array(cameraSegmentSchema) }),
  captions: z.array(captionSchema),
});

export type CameraSegment = z.infer<typeof cameraSegmentSchema>;
export type Caption = z.infer<typeof captionSchema>;
export type EditPlan = z.infer<typeof editPlanSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "feat(schema): add Edit Plan 1.2 zod schema (recording)"
```

---

### Task 4: segmentsToCropTrack — the precompute pass

**Files:**
- Create: `packages/schema/src/crop-track.ts`
- Create: `packages/schema/src/index.ts`
- Test: `packages/schema/src/crop-track.test.ts`

**Interfaces:**
- Consumes: `CameraSegment` (Task 3); `evaluateZoom`, `createZoomState`, `ZoomSegment`, `CropBounds` (Task 2).
- Produces:
  - `type CropFrame = { x: number; y: number; w: number; h: number }`
  - `segmentsToCropTrack(segments: CameraSegment[], durationFrames: number, fps: number): CropFrame[]`
    - Runs `evaluateZoom` ONCE per frame in ascending frame order, threading one `createZoomState()` — the required sequential pass.
    - For v1, cursor position is fixed at frame center `{u:0.5,v:0.5}` (auto/follow needs a real path; not in v1). `manualCenter` on each segment drives the actual center.
  - Barrel `index.ts` re-exporting plan + crop-track symbols.

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/crop-track.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { segmentsToCropTrack } from "./crop-track.js";
import type { CameraSegment } from "./plan.js";

describe("segmentsToCropTrack", () => {
  const fps = 30;
  const segments: CameraSegment[] = [
    { sourceStart: 1.0, sourceEnd: 2.0, amount: 2.0, manualCenter: [0.5, 0.5] },
  ];

  it("produces one crop per frame", () => {
    const track = segmentsToCropTrack(segments, 90, fps); // 3s
    expect(track).toHaveLength(90);
  });

  it("is full-frame before any segment", () => {
    const track = segmentsToCropTrack(segments, 90, fps);
    expect(track[0].w).toBeCloseTo(1, 2);
    expect(track[0].h).toBeCloseTo(1, 2);
  });

  it("is zoomed in (w < 1) during the segment hold", () => {
    const track = segmentsToCropTrack(segments, 90, fps);
    const mid = track[45]; // 1.5s, inside 1..2
    expect(mid.w).toBeLessThan(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm test`
Expected: FAIL — cannot resolve `./crop-track.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/crop-track.ts`:
```ts
import { createZoomState, evaluateZoom } from "./vendor/screen-studio-effects/index.js";
import type { ZoomSegment, CropBounds } from "./vendor/screen-studio-effects/index.js";
import type { CameraSegment } from "./plan.js";

export type CropFrame = CropBounds;

const CENTER = { u: 0.5, v: 0.5 } as const;

export function segmentsToCropTrack(
  segments: CameraSegment[],
  durationFrames: number,
  fps: number,
): CropFrame[] {
  const zoomSegments: ZoomSegment[] = segments.map((s) => ({
    sourceStart: s.sourceStart,
    sourceEnd: s.sourceEnd,
    amount: s.amount,
    manualCenter: s.manualCenter,
  }));
  const state = createZoomState();
  const track: CropFrame[] = [];
  // ONE sequential forward pass — evaluateZoom is stateful; never call it out of order.
  for (let f = 0; f < durationFrames; f++) {
    const t = f / fps;
    const crop = evaluateZoom(zoomSegments, t, CENTER, state, () => CENTER);
    track.push({ x: crop.x, y: crop.y, w: crop.w, h: crop.h });
  }
  return track;
}
```

- [ ] **Step 4: Write the barrel export**

Create `packages/schema/src/index.ts`:
```ts
export * from "./plan.js";
export * from "./crop-track.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm test`
Expected: PASS (all schema + crop-track tests green).

- [ ] **Step 6: Build the package**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/schema && pnpm build`
Expected: emits `dist/` with `.d.ts` files, no type errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "feat(schema): precompute per-frame crop track from segments"
```

---

### Task 5: Remotion project scaffold + sample assets

**Files:**
- Create: `packages/render/` (via `create-video`)
- Create: `packages/render/public/demo01.mp4` (a real short screen recording)
- Create: `samples/demo01/editplan.json`

**Interfaces:**
- Produces: a runnable Remotion Studio and a sample plan later tasks render.

- [ ] **Step 1: Scaffold a blank Remotion project into the workspace**

Run:
```bash
cd /Users/prathamshirbhate/Desktop/sizzle && npx create-video@latest --yes --blank packages/render
```
Expected: creates `packages/render` with `src/Root.tsx`, `src/index.ts`, `remotion.config.ts`, `package.json`.

- [ ] **Step 2: Add the schema package as a dependency**

Edit `packages/render/package.json` — add to `dependencies`:
```json
"@sizzle/schema": "workspace:*"
```
Then run: `cd /Users/prathamshirbhate/Desktop/sizzle && pnpm install`
Expected: `@sizzle/schema` linked into `packages/render`.

- [ ] **Step 3: Add a real sample recording**

Place any short (~10–40s) screen recording with visible mouse activity at `packages/render/public/demo01.mp4`. If none exists, record one with QuickTime (File → New Screen Recording) and export/copy it there. Note its exact width, height, fps, and duration (via `ffprobe packages/render/public/demo01.mp4` if ffmpeg is installed, else QuickTime's inspector).

- [ ] **Step 4: Hand-write the sample Edit Plan**

Create `samples/demo01/editplan.json` (replace width/height/durationSec/fps with the real values from Step 3; eyeball 2–3 `manualCenter` UV points over regions where the mouse acts):
```json
{
  "plan_version": "1.2",
  "job_id": "demo01",
  "source_kind": "recording",
  "fps": 30,
  "base": { "uri": "demo01.mp4", "width": 1920, "height": 1080, "durationSec": 20 },
  "camera": {
    "segments": [
      { "sourceStart": 3.0, "sourceEnd": 5.0, "amount": 1.6, "manualCenter": [0.35, 0.4] },
      { "sourceStart": 9.0, "sourceEnd": 11.0, "amount": 1.8, "manualCenter": [0.7, 0.55] }
    ]
  },
  "captions": [
    { "start": 2.5, "end": 5.0, "text": "First we open the invoice screen" },
    { "start": 8.5, "end": 11.0, "text": "Then we hit send" }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "chore(render): scaffold Remotion project + demo01 sample plan"
```

---

### Task 6: CameraLayer — stateless crop-track lookup

**Files:**
- Create: `packages/render/src/camera/CameraLayer.tsx`
- Test: `packages/render/src/camera/cropToTransform.test.ts`
- Create: `packages/render/src/camera/cropToTransform.ts`

**Interfaces:**
- Consumes: `CropFrame` (from `@sizzle/schema`).
- Produces:
  - `cropToTransform(crop: CropFrame): { scale: number; translatePctX: number; translatePctY: number }` — pure math, unit-tested.
  - `CameraLayer: React.FC<{ cropTrack: CropFrame[]; children: React.ReactNode }>` — reads `useCurrentFrame()`, looks up `cropTrack[frame]`, applies the transform to a wrapping `AbsoluteFill` inside an `overflow:hidden` container.

- [ ] **Step 1: Write the failing test for the pure transform math**

Create `packages/render/src/camera/cropToTransform.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cropToTransform } from "./cropToTransform.js";

describe("cropToTransform", () => {
  it("full frame => scale 1, no translate", () => {
    const t = cropToTransform({ x: 0, y: 0, w: 1, h: 1 });
    expect(t.scale).toBeCloseTo(1, 3);
    expect(t.translatePctX).toBeCloseTo(0, 3);
    expect(t.translatePctY).toBeCloseTo(0, 3);
  });

  it("centered half-frame crop => scale 2", () => {
    const t = cropToTransform({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(t.scale).toBeCloseTo(2, 3);
    // crop center is (0.5,0.5) => already centered => no translate
    expect(t.translatePctX).toBeCloseTo(0, 3);
    expect(t.translatePctY).toBeCloseTo(0, 3);
  });

  it("off-center crop translates toward the crop center", () => {
    const t = cropToTransform({ x: 0, y: 0, w: 0.5, h: 0.5 });
    // crop center (0.25,0.25) is up-left => content shifts down-right (positive translate)
    expect(t.translatePctX).toBeGreaterThan(0);
    expect(t.translatePctY).toBeGreaterThan(0);
  });
});
```

Add vitest to `packages/render`: edit `packages/render/package.json` to add `"vitest": "^2.0.5"` to `devDependencies` and a `"test": "vitest run"` script, plus a `packages/render/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```
Run `cd /Users/prathamshirbhate/Desktop/sizzle && pnpm install`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/render && pnpm test`
Expected: FAIL — cannot resolve `./cropToTransform.js`.

- [ ] **Step 3: Write the transform math**

Create `packages/render/src/camera/cropToTransform.ts`:
```ts
import type { CropFrame } from "@sizzle/schema";

/**
 * Convert a UV crop rect into a CSS transform that shows only that rect.
 * scale = 1/w (assumes w===h aspect-preserving zoom; use w for horizontal fit).
 * translate percentages move the crop center to the viewport center, expressed
 * as a percentage of the (scaled) element, consumed as translate(%) on the child.
 */
export function cropToTransform(crop: CropFrame): {
  scale: number;
  translatePctX: number;
  translatePctY: number;
} {
  const scale = 1 / crop.w;
  const cropCenterX = crop.x + crop.w / 2;
  const cropCenterY = crop.y + crop.h / 2;
  // How far the crop center sits from frame center, in pre-scale fraction.
  // Translate the child so that point lands at center. Percentage is of the child's own size.
  const translatePctX = (0.5 - cropCenterX) * 100;
  const translatePctY = (0.5 - cropCenterY) * 100;
  return { scale, translatePctX, translatePctY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/render && pnpm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the CameraLayer component**

Create `packages/render/src/camera/CameraLayer.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CropFrame } from "@sizzle/schema";
import { cropToTransform } from "./cropToTransform.js";

export const CameraLayer: React.FC<{
  cropTrack: CropFrame[];
  children: React.ReactNode;
}> = ({ cropTrack, children }) => {
  const frame = useCurrentFrame();
  const crop = cropTrack[Math.min(frame, cropTrack.length - 1)] ?? { x: 0, y: 0, w: 1, h: 1 };
  const { scale, translatePctX, translatePctY } = cropToTransform(crop);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "center center",
          scale: String(scale),
          translate: `${translatePctX}% ${translatePctY}%`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 6: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "feat(render): CameraLayer with pure crop-to-transform lookup"
```

---

### Task 7: CaptionLayer

**Files:**
- Create: `packages/render/src/captions/CaptionLayer.tsx`

**Interfaces:**
- Consumes: `Caption[]` (from `@sizzle/schema`), `fps`.
- Produces: `CaptionLayer: React.FC<{ captions: Caption[]; fps: number }>` — shows the caption whose `[start,end]` (seconds) contains the current time.

- [ ] **Step 1: Write the component**

Create `packages/render/src/captions/CaptionLayer.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Caption } from "@sizzle/schema";

export const CaptionLayer: React.FC<{ captions: Caption[]; fps: number }> = ({ captions, fps }) => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const active = captions.find((c) => t >= c.start && t <= c.end);
  if (!active) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 80 }}>
      <div
        style={{
          background: "rgba(0,0,0,0.7)",
          color: "white",
          fontSize: 42,
          fontFamily: "sans-serif",
          padding: "12px 28px",
          borderRadius: 12,
          maxWidth: "80%",
          textAlign: "center",
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "feat(render): CaptionLayer with time-window visibility"
```

---

### Task 8: RecordingComposition + calculateMetadata + Root registration

**Files:**
- Create: `packages/render/src/RecordingComposition.tsx`
- Modify: `packages/render/src/Root.tsx`

**Interfaces:**
- Consumes: `EditPlan`, `segmentsToCropTrack`, `CropFrame` (from `@sizzle/schema`); `CameraLayer` (Task 6); `CaptionLayer` (Task 7).
- Produces: a registered composition `id="Recording"` whose `calculateMetadata` computes `durationInFrames` from `base.durationSec * fps` and precomputes `cropTrack`, passing it into props.

- [ ] **Step 1: Write the composition component**

Create `packages/render/src/RecordingComposition.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { EditPlan, CropFrame } from "@sizzle/schema";
import { CameraLayer } from "./camera/CameraLayer.js";
import { CaptionLayer } from "./captions/CaptionLayer.js";

export type RecordingProps = {
  plan: EditPlan;
  cropTrack: CropFrame[];
};

export const RecordingComposition: React.FC<RecordingProps> = ({ plan, cropTrack }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <CameraLayer cropTrack={cropTrack}>
        <OffthreadVideo src={staticFile(plan.base.uri)} />
      </CameraLayer>
      <CaptionLayer captions={plan.captions} fps={plan.fps} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Register the composition with calculateMetadata**

Replace the body of `packages/render/src/Root.tsx` with:
```tsx
import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { editPlanSchema, segmentsToCropTrack, type EditPlan } from "@sizzle/schema";
import { RecordingComposition, type RecordingProps } from "./RecordingComposition.js";
import demoPlan from "../../../samples/demo01/editplan.json";

const defaultPlan: EditPlan = editPlanSchema.parse(demoPlan);

const calculateMetadata: CalculateMetadataFunction<RecordingProps> = ({ props }) => {
  const plan = props.plan;
  const durationInFrames = Math.round(plan.base.durationSec * plan.fps);
  const cropTrack = segmentsToCropTrack(plan.camera.segments, durationInFrames, plan.fps);
  return {
    durationInFrames,
    fps: plan.fps,
    width: plan.base.width,
    height: plan.base.height,
    props: { ...props, cropTrack },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Recording"
      component={RecordingComposition}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ plan: defaultPlan, cropTrack: [] as RecordingProps["cropTrack"] }}
      calculateMetadata={calculateMetadata}
    />
  );
};
```
If `Root.tsx` importing JSON errors, add `"resolveJsonModule": true` to `packages/render/tsconfig.json` `compilerOptions`.

- [ ] **Step 3: Open Studio and verify visually**

Run: `cd /Users/prathamshirbhate/Desktop/sizzle/packages/render && npx remotion studio`
Expected: Studio opens the `Recording` composition; scrubbing shows the video playing, punching into the first region around 3–5s, releasing, punching into the second around 9–11s, with captions appearing in those windows. Preview reflects the plan.

- [ ] **Step 4: Commit**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add -A
git commit -m "feat(render): RecordingComposition + precompute crop track in calculateMetadata"
```

---

### Task 9: Render to MP4 — the milestone

**Files:**
- (No new source; produces `packages/render/out/recording.mp4`)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Render the composition to MP4**

Run:
```bash
cd /Users/prathamshirbhate/Desktop/sizzle/packages/render && npx remotion render Recording out/recording.mp4
```
Expected: render completes; `out/recording.mp4` exists.

- [ ] **Step 2: Verify the output visually (the acceptance test)**

Open `packages/render/out/recording.mp4`. Confirm, against `samples/demo01/editplan.json`:
- The camera is a wide 1.0 shot before the first segment.
- It punches into `manualCenter [0.35,0.4]` between 3–5s, holds, releases.
- It punches into `manualCenter [0.7,0.55]` between 9–11s, holds, releases.
- Captions "First we open the invoice screen" and "Then we hit send" appear in their windows.
- No black bars / edge clipping at max zoom (if there are, reduce `amount` in the plan — a validator enforces this in a later plan).
- **Preview (Studio) matched this render** — determinism confirmed.

- [ ] **Step 3: Commit the plan-render proof**

```bash
cd /Users/prathamshirbhate/Desktop/sizzle
git add samples/
git commit -m "test: demo01 hand-written plan renders to MP4 (render spine proven)"
```

---

## Out of scope for v1 (subsequent plans)

- **Ingest/Deliver (FFmpeg):** probe/normalize input; mux audio, EBU R128 loudness, export 16:9/9:16/1:1. (Strategic plan Stage 2.)
- **Recorder (Station 1):** desktop app emitting `{video.mp4, events.json}` with OS cursor+clicks — the recorder-first data source. (Stage 3.)
- **WhisperX captions/cuts, rules planner, OmniParser, LLM, orchestration.** (Stages 4–6.)
- **Validator** enforcing safe-area / on-screen at max zoom (referenced in Task 9 Step 2). Belongs with the crop track; build alongside deliver.

## Self-Review notes

- **Spec coverage:** v1 covers exactly the "prove the paint end" milestone (strategic plan Stage 0 + Stage 1). Recorder/CV/AI deliberately deferred and listed above.
- **Type consistency:** `CameraSegment`/`Caption`/`EditPlan`/`CropFrame` defined in Tasks 3–4, consumed by name in Tasks 6–8. `cropToTransform` (Task 6) and `segmentsToCropTrack` (Task 4) names are used consistently in Task 8.
- **Stateful-render constraint honored:** `evaluateZoom` is called only inside `segmentsToCropTrack` (one forward pass, Task 4); the React components (Tasks 6–8) only index the precomputed array. This is the plan's load-bearing correctness property.
- **Known assumption to validate during execution:** `cropToTransform`'s translate-percentage convention (Task 6) must visually center correctly in Task 8 Step 3 — if off-center, the translate sign/scale is the thing to fix (it's isolated + unit-tested, so cheap to correct).
```
