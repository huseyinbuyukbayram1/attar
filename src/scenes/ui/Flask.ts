import Phaser from 'phaser'
import { CLEAR_FLASK_KEY } from './clearFlaskTexture'
import { lerpColor } from './liquidColor'

// Where the flask stands (canvas pixels): x = center, bottom = the line it stands on
const FLASK = { x: 430, bottom: 622, height: 190 } // bottom = the counter surface it stands on
// The mixing_flask.png is 305x480. BODY describes its round body in pixels of that image:
// center and radius of the circle the liquid fills. The radius is a bit smaller than the glass
// itself (about 136) so the outline stays visible. Retune these if the art changes.
const TEXTURE = { width: 305, height: 480 }
const BODY = { x: 153, y: 326, radius: 120 }
const LIQUID_ALPHA = 0.92
const SURFACE = { lighten: 0.35, alpha: 0.55, flatness: 0.2 } // lighter ellipse on top of the liquid
const LIQUID_MS = 250
const START_COLOR = 0xf3e2b3
const EVENING_TINT = 0xffd9b0 // multiplied into the flask picture in the evening

// Where a flying drop should end up: just inside the flask's mouth
export const FLASK_MOUTH = { x: FLASK.x, y: FLASK.bottom - FLASK.height + 10 }

// The mixing flask. The flask picture (a see-through copy, see clearFlaskTexture.ts) is drawn
// first and the liquid ABOVE it, so the liquid is always visible. The liquid is a circle segment
// (the part of the body circle below the surface line), which clips it to the round body
// without a mask: Phaser 4 only supports geometry masks in Canvas, not in WebGL.
export class Flask extends Phaser.GameObjects.Container {
  private liquid: Phaser.GameObjects.Graphics
  private sprite?: Phaser.GameObjects.Image
  private brighten = 0 // 0..1, how far the liquid is blended towards white (mix animation)
  // The body circle in canvas pixels, from the image numbers above
  private cx: number
  private cy: number
  private radius: number

  // What is drawn now, where the last change started and where it is heading
  private level = 0
  private color = START_COLOR
  private from = { level: 0, color: START_COLOR }
  private to = { level: 0, color: START_COLOR }
  // Tweened 0 -> 1; the level and color are blended from it (see setTarget)
  private progress = { t: 1 }

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0) // children use absolute canvas coordinates
    scene.add.existing(this)

    const scale = FLASK.height / TEXTURE.height
    this.cx = FLASK.x + (BODY.x - TEXTURE.width / 2) * scale
    this.cy = FLASK.bottom - (TEXTURE.height - BODY.y) * scale
    this.radius = BODY.radius * scale

    // The see-through copy if it was made, else the original, else just an outline circle
    const key = [CLEAR_FLASK_KEY, 'mixing_flask'].find((k) => scene.textures.exists(k))
    if (key) {
      this.sprite = scene.add.image(FLASK.x, FLASK.bottom, key).setOrigin(0.5, 1).setScale(scale)
      this.add(this.sprite)
    } else {
      this.add(scene.add.circle(this.cx, this.cy, this.radius).setStrokeStyle(3, 0xf6e7c1))
    }
    this.liquid = scene.add.graphics()
    this.add(this.liquid)
  }

  // The round body in canvas pixels, the current liquid color and where its surface is. The mix
  // animation uses these to put its swirl and sparkles inside the liquid.
  get bowl() {
    return { x: this.cx, y: this.cy, radius: this.radius }
  }
  get liquidColor() {
    return this.color
  }
  get liquidLevel() {
    return this.level
  }

  // Canvas y of the liquid surface for a level 0..1
  surfaceYAt(level: number): number {
    return this.cy + this.radius - level * 2 * this.radius
  }

  // Warm tint for evening customers; plain white (no tint) in the morning
  setEvening(evening: boolean) {
    if (evening) this.sprite?.setTint(EVENING_TINT)
    else this.sprite?.clearTint()
  }

  // 0..1: blends the liquid towards white and redraws it
  setBrighten(amount: number) {
    this.brighten = amount
    this.drawAt(this.progress.t)
  }

  // level is 0..1 (drops / MAX_DROPS), as a fraction of the round body. A null color keeps the
  // current one, used when empty.
  setTarget(level: number, color: number | null, animate: boolean) {
    this.scene.tweens.killTweensOf(this.progress)
    this.from = { level: this.level, color: this.color }
    this.to = { level, color: color ?? this.color }
    // An empty flask has no color to blend from, so the first drop shows its own color at once
    if (this.from.level === 0) this.from.color = this.to.color

    if (!animate) {
      this.progress.t = 1
      this.drawAt(1)
      return
    }
    this.progress.t = 0
    this.scene.tweens.add({
      targets: this.progress,
      t: 1,
      duration: LIQUID_MS,
      onUpdate: () => this.drawAt(this.progress.t),
    })
  }

  private drawAt(t: number) {
    this.level = this.from.level + (this.to.level - this.from.level) * t
    this.color = lerpColor(this.from.color, this.to.color, t)

    this.liquid.clear()
    if (this.level < 0.005) return

    const { cx, cy, radius } = this
    const shown = lerpColor(this.color, 0xffffff, this.brighten)
    this.liquid.fillStyle(shown, LIQUID_ALPHA)
    if (this.level > 0.995) {
      this.liquid.fillCircle(cx, cy, radius)
      return
    }

    // The surface line is level * 2R above the bottom of the circle. dy is its offset from the
    // center (+ below, - above). The liquid is the arc below that line, closed by a chord.
    const surfaceY = this.surfaceYAt(this.level)
    const dy = surfaceY - cy
    const angle = Math.asin(dy / radius) // where the line meets the circle on the right side
    this.liquid.beginPath()
    this.liquid.arc(cx, cy, radius, angle, Math.PI - angle, false)
    this.liquid.closePath()
    this.liquid.fillPath()

    // A lighter, flat ellipse on the surface so the liquid reads as a volume
    const chord = 2 * Math.sqrt(radius * radius - dy * dy)
    this.liquid.fillStyle(lerpColor(shown, 0xffffff, SURFACE.lighten), SURFACE.alpha)
    this.liquid.fillEllipse(cx, surfaceY, chord, chord * SURFACE.flatness)
  }
}
