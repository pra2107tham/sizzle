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
