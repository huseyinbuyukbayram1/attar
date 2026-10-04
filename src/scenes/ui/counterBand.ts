import Phaser from 'phaser'

// The light counter-top band of counter_view.jpg in canvas pixels (1280x720), measured from the
// picture: the back edge is where the wall meets the counter (y 497 from x 160 on), the front edge
// is where the light wood meets the dark front face (y 617). Things stand INSIDE this band, never
// on its edges. At the far left the back edge slopes down (perspective): leftCorner says where.
export const COUNTER = { backY: 497, frontY: 617, leftCorner: { x: 160, backYAtZero: 543 } }

// The new counter top is light orange; a dark warm-brown overlay on the band only (not the wall)
// tunes it towards the darker wood of the old picture. Raise the alpha for darker wood.
export const COUNTER_DARKEN_ALPHA = 0.18
const COUNTER_DARKEN_COLOR = 0x3b2418

// Draws that overlay over the counter-top band. The caller sets its depth: above the background,
// below the bottles, their shadows and the flask.
export function addCounterDarken(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const width = scene.scale.width
  const { backY, frontY, leftCorner } = COUNTER
  const band = scene.add.graphics()
  band.fillStyle(COUNTER_DARKEN_COLOR, COUNTER_DARKEN_ALPHA)
  band.fillPoints(
    [
      new Phaser.Math.Vector2(0, leftCorner.backYAtZero),
      new Phaser.Math.Vector2(leftCorner.x, backY),
      new Phaser.Math.Vector2(width, backY),
      new Phaser.Math.Vector2(width, frontY),
      new Phaser.Math.Vector2(0, frontY),
    ],
    true,
  )
  return band
}

// Where things stand, as a share of the band depth (0 = back edge, 1 = front edge)
export const BASE_FRACTION = { backRow: 0.12, frontRow: 0.55, flask: 0.52 } // the notebook uses `flask`

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
