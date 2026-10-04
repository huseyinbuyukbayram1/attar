import Phaser from 'phaser'

// The light counter-top band of counter_view.jpg in canvas pixels (1280x720), measured from the
// picture: the back edge is where the wall meets the counter, the front edge is where the light
// wood meets the darker front face. Things stand INSIDE this band, never on its edges.
export const COUNTER = { backY: 524, frontY: 588 }

// Where things stand, as a share of the band depth (0 = back edge, 1 = front edge)
export const BASE_FRACTION = { backRow: 0.3, frontRow: 0.72, flask: 0.66 }

// Canvas y for a fraction of the band depth
export function baseY(fraction: number): number {
  return Math.round(COUNTER.backY + (COUNTER.frontY - COUNTER.backY) * fraction)
}

// Soft contact shadow: a dark brown ellipse under an object so it looks like it stands on the wood
// alpha is the resting value, liftedAlpha is used while the object is lifted off the counter.
// The center sits `overlap` px above the base, so the shadow tucks under the bottom of the glass.
export const SHADOW = { color: 0x2a170d, alpha: 0.4, liftedAlpha: 0.2, height: 11, overlap: 2, bottleShare: 0.8, flaskShare: 0.9 }

// Centered on x and just above `baseY` (the visible bottom of the object). `glassWidth` is the
// displayed width of the visible glass and `share` how much of it the shadow covers.
export function createShadow(
  scene: Phaser.Scene,
  x: number,
  baseY: number,
  glassWidth: number,
  share: number,
): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(x, baseY - SHADOW.overlap, glassWidth * share, SHADOW.height, SHADOW.color)
    .setAlpha(SHADOW.alpha)
}
