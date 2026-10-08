import Phaser from 'phaser'
import { lerpColor } from './liquidColor'

// ---- The gift bottle of the delivery animation: tuning constants (canvas px, ms) ----
export const GIFT_BOTTLE_KEY = 'gift_bottle'
// Where it stands: on the counter in front of the customer (x = center, bottom = the line it stands on)
const PLACE = { x: 640, bottom: 645, scale: 0.75, depth: -55 }
// The round glass body in the picture (165x220), in picture pixels: center and radius of the circle the
// liquid fills. The radius is a bit smaller than the glass so the outline stays visible.
const PICTURE = { width: 165, height: 220 }
const BODY = { x: 82, y: 138, radius: 60 }
const CORK = { x: 82, y: 22 } // where the sparkles come from
const POP = { fromScale: 0.6, ms: 200 }
const FILL = { level: 0.75, ms: 700, alpha: 0.75 } // level: share of the body's height
// The wavy surface: a sine wave across the body. It wobbles faster than the liquid rises and calms down at the end.
const WAVE = { amplitude: 3, length: 38, cycles: 3, lighten: 0.45, lineWidth: 2, lineAlpha: 0.9, step: 2 } // px, in picture pixels
const SEAL = { squashX: 1.07, squashY: 0.92, ms: 110 }
const SPARKLES = { count: 5, distance: { min: 22, max: 40 }, size: 4, ms: 450, color: 0xfff2b0 }
const HAND_OVER = { rise: 80, ms: 400, shrink: 0.85 } // slides up, towards the customer, and fades out
const EVENING_TINT = 0xffd9b0

// The gift bottle: pops in on the counter, fills with the mix colour, is sealed and handed over.
// The liquid is not masked (Phaser 4 has geometry masks only in Canvas, not in WebGL): it is a polygon
// that follows the body circle itself, so it can never leave the glass (same idea as the flask).
export class GiftBottle {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private sprite: Phaser.GameObjects.Image
  private liquid: Phaser.GameObjects.Graphics
  private color = 0xffffff
  private done = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // The container sits at the bottle's feet, so scaling it keeps the feet on the counter
    this.sprite = scene.add.image(0, 0, GIFT_BOTTLE_KEY).setOrigin(0.5, 1)
    this.liquid = scene.add.graphics()
    this.root = scene.add.container(PLACE.x, PLACE.bottom, [this.sprite, this.liquid]).setDepth(PLACE.depth).setScale(PLACE.scale).setVisible(false)
    scene.events.once('shutdown', () => this.root.destroy())
  }

  // Ready for a new delivery: empty, at its place, not visible yet
  prepare(color: number, evening: boolean) {
    this.scene.tweens.killTweensOf(this.root)
    this.color = color
    this.done = false
    this.liquid.clear()
    if (evening) this.sprite.setTint(EVENING_TINT)
    else this.sprite.clearTint()
    this.root.setPosition(PLACE.x, PLACE.bottom).setScale(PLACE.scale * POP.fromScale).setAlpha(0).setVisible(true)
  }

  // 1. Pops in: grows from 0.6 to full size and appears
  pop(onDone: () => void) {
    this.scene.tweens.add({ targets: this.root, scale: PLACE.scale, alpha: 1, duration: POP.ms, ease: 'Back.easeOut', onComplete: onDone })
  }

  // 2. The liquid rises from the bottom of the body to FILL.level, with a wobbling lighter surface
  fill(onDone: () => void) {
    const progress = { t: 0 }
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: FILL.ms,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.drawLiquid(FILL.level * progress.t, progress.t),
      onComplete: () => {
        this.drawLiquid(FILL.level, 1)
        onDone()
      },
    })
  }

  // 3. Seals: a tiny squash and a few sparkles at the cork
  seal(onDone: () => void) {
    this.scene.tweens.add({
      targets: this.root,
      scaleX: PLACE.scale * SEAL.squashX,
      scaleY: PLACE.scale * SEAL.squashY,
      duration: SEAL.ms,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.root.setScale(PLACE.scale)
        onDone()
      },
    })
    this.sparkle()
  }

  // 4. Hand-over: slides up towards the customer and fades out
  handOver(onDone: () => void) {
    this.scene.tweens.add({
      targets: this.root,
      y: PLACE.bottom - HAND_OVER.rise,
      scale: PLACE.scale * HAND_OVER.shrink,
      alpha: 0,
      duration: HAND_OVER.ms,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.root.setVisible(false)
        this.done = true
        onDone()
      },
    })
  }

  // Everything at once (an animation that is cut short, or a scene that goes away)
  hide() {
    this.scene.tweens.killTweensOf(this.root)
    this.root.setVisible(false)
    this.done = true
  }

  isDone(): boolean {
    return this.done
  }

  // The liquid up to `level` (share of the body's height) as one polygon: a wavy top edge, the body circle below.
  // Picture pixels, relative to the bottle's feet (the container's origin).
  private drawLiquid(level: number, t: number) {
    const g = this.liquid
    g.clear()
    if (level <= 0) return
    const cx = BODY.x - PICTURE.width / 2
    const cy = BODY.y - PICTURE.height
    const r = BODY.radius
    const surface = cy + r - level * 2 * r // y of the flat surface
    const calm = 1 - 0.7 * t // the wobble gets smaller as the bottle fills
    const wave = (x: number) => Math.sin((x / WAVE.length) * Math.PI * 2 + t * Math.PI * 2 * WAVE.cycles) * WAVE.amplitude * calm
    const top: Phaser.Math.Vector2[] = []
    const bottom: Phaser.Math.Vector2[] = []
    for (let x = -r; x <= r; x += WAVE.step) {
      const half = Math.sqrt(Math.max(0, r * r - x * x))
      const lowest = cy + half // the circle's bottom edge at this x
      const y = Phaser.Math.Clamp(Math.max(surface + wave(x), cy - half), cy - half, lowest)
      top.push(new Phaser.Math.Vector2(cx + x, y))
      bottom.unshift(new Phaser.Math.Vector2(cx + x, lowest))
    }
    g.fillStyle(this.color, FILL.alpha)
    g.fillPoints([...top, ...bottom], true)
    // The lighter surface line, only where the surface is inside the glass
    g.lineStyle(WAVE.lineWidth, lerpColor(this.color, 0xffffff, WAVE.lighten), WAVE.lineAlpha)
    g.beginPath()
    let started = false
    for (const p of top) {
      const inside = Math.abs(p.x - cx) < r - 1 && p.y > cy - Math.sqrt(Math.max(0, r * r - (p.x - cx) ** 2)) + 1
      if (!inside) continue
      if (!started) g.moveTo(p.x, p.y)
      else g.lineTo(p.x, p.y)
      started = true
    }
    g.strokePath()
  }

  // A few small four-pointed sparkles fly out of the cork and fade
  private sparkle() {
    for (let i = 0; i < SPARKLES.count; i++) {
      const angle = Phaser.Math.DegToRad(-90 + Phaser.Math.Between(-80, 80) + (i - SPARKLES.count / 2) * 4)
      const distance = Phaser.Math.Between(SPARKLES.distance.min, SPARKLES.distance.max) / PLACE.scale // the container is scaled
      const s = SPARKLES.size / PLACE.scale
      const star = this.scene.add.graphics()
      star.fillStyle(SPARKLES.color, 1)
      star.fillPoints([new Phaser.Math.Vector2(0, -s * 1.6), new Phaser.Math.Vector2(s * 0.5, -s * 0.5), new Phaser.Math.Vector2(s * 1.6, 0), new Phaser.Math.Vector2(s * 0.5, s * 0.5), new Phaser.Math.Vector2(0, s * 1.6), new Phaser.Math.Vector2(-s * 0.5, s * 0.5), new Phaser.Math.Vector2(-s * 1.6, 0), new Phaser.Math.Vector2(-s * 0.5, -s * 0.5)], true)
      star.setPosition(CORK.x - PICTURE.width / 2, CORK.y - PICTURE.height)
      this.root.add(star)
      this.scene.tweens.add({
        targets: star,
        x: star.x + Math.cos(angle) * distance,
        y: star.y + Math.sin(angle) * distance,
        scale: 0,
        alpha: 0,
        duration: SPARKLES.ms,
        ease: 'Sine.easeOut',
        onComplete: () => star.destroy(),
      })
    }
  }
}
