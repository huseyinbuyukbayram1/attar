import Phaser from 'phaser'
import { MAX_DROPS } from '../../game/scoring'
import { BASE_FRACTION, baseY, COUNTER, createShadow, SHADOW } from './counterBand'
import { CLEAR_FLASK_KEY } from './clearFlaskTexture'
import { measureGlass } from './glassBox'
import { lerpColor } from './liquidColor'

// Where the flask stands (canvas pixels): x = center, bottom = the line it stands on
// x is shifted 8 px right of the old 430 to leave room for the notebook between it and the alembic
// bottom = the line the VISIBLE glass bottom stands on; the picture is shifted down by its empty rows
const FLASK = { x: 438, bottom: baseY(BASE_FRACTION.flask), height: 190 }
export const FLASK_X = FLASK.x // the drop slots are centered under it
// The mixing_flask.png is 305x480. BODY describes its round body in pixels of that image:
// center and radius of the circle the liquid fills. The radius is a bit smaller than the glass
// itself (about 136) so the outline stays visible. Retune these if the art changes.
const TEXTURE = { width: 305, height: 480 }
const BODY = { x: 153, y: 326, radius: 120 }
const LIQUID_ALPHA = 0.92
const SURFACE = { lighten: 0.35, alpha: 0.55, flatness: 0.2 } // lighter ellipse on top of the liquid
const LIQUID_MS = 250
// Emptying: the flask leans AWAY from the viewer (a bit smaller and higher, no rotation) and the
// liquid pours out behind it: a stream along the back of the glass that runs over the counter's
// back edge and is gone, with a small mist puff where it disappears.
const LEAN_AWAY_SCALE = 0.94
const LEAN_AWAY_RISE = 12 // px the flask moves up while leaning
const LEAN_IN_MS = 350 // ease out
const RETURN_MS = 250
const SHADOW_AWAY = { scaleX: 0.85, alpha: 0.25 } // the base shadow while leaning: narrower and lighter
const SURFACE_LEAN_STRETCH = 0.7 // the liquid's surface ellipse is this tall while leaning (seen from above)
// The drain (stream running while the level drops) lasts longer the more liquid there is
const EMPTY_BASE_MS = 250
const EMPTY_PER_DROP_MS = 140 // per drop: 1 drop = 390 ms, 6 drops = 1090 ms
const EMPTY_END_HOLD_MS = 250 // after the stream stops, the flask waits this long, then goes back
const STREAM_WIDTH = { full: 7, min: 2 } // px: at a full flask, and just before the end
// Measured in counter_view.jpg (at 1280x720) at the flask's x: where the counter top meets the wall.
// The stream is cut off here, as if the liquid fell over the edge.
const COUNTER_BACK_EDGE_Y = COUNTER.backY
const EMPTY_STREAM_REACH_MS = 120 // how long the stream takes to grow from the mouth to the edge
// The mist puff where the stream disappears: overlapping circles (offset from the stream's end, radius)
const MIST = {
  puffs: [
    { dx: -8, dy: 0, radius: 14 },
    { dx: 8, dy: -3, radius: 18 },
    { dx: 0, dy: -7, radius: 12 },
    { dx: -3, dy: 4, radius: 10 },
  ],
  lighten: 0.5, // blended towards white, so it is a lighter version of the liquid color
  // size and alpha grow with the amount of liquid: smallest at 1 drop, biggest at a full flask
  scale: { min: 0.55, max: 1 },
  alpha: { min: 0.3, max: 0.5 },
  fadeInMs: 150,
  growTo: 1.3, // scale factor at the end of the fade
  fadeMs: 500, // after the stream has stopped
}
// tiny droplets at the wall line; their number grows with the amount of liquid (1 drop: 1, full: 5)
const SPRAY = { count: { min: 1, max: 5 }, radius: 2, riseMin: 6, riseMax: 10, spreadX: 10, ms: 350 }

const START_COLOR = 0xf3e2b3
const EVENING_TINT = 0xffd9b0 // multiplied into the flask picture in the evening


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
  private shadow: Phaser.GameObjects.Ellipse
  private surfaceStretch = 1 // 1 normally; SURFACE_LEAN_STRETCH while leaning
  private baseEdge: { x: number; y: number } // the flask tilts around this point (right end of its base)
  private mouthPoint: { x: number; y: number } // top of the flask's rim, in canvas pixels

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
    // The picture to use, and how far its bottom edge must go below the base line so the glass
    // (not the empty padding) touches it. Everything below is placed from pictureBottom.
    const key = [CLEAR_FLASK_KEY, 'mixing_flask'].find((k) => scene.textures.exists(k))
    const glass = key
      ? measureGlass(scene, key)
      : { gapBelow: 0, width: TEXTURE.width, mouthX: TEXTURE.width / 2, mouthY: TEXTURE.height - FLASK.height / scale }
    const pictureBottom = FLASK.bottom + glass.gapBelow * scale
    this.baseEdge = { x: FLASK.x + (glass.width * scale) / 2, y: FLASK.bottom }
    // The measured rim of the flask, placed like the picture itself
    this.mouthPoint = {
      x: FLASK.x + (glass.mouthX - TEXTURE.width / 2) * scale,
      y: pictureBottom - (TEXTURE.height - glass.mouthY) * scale,
    }
    this.cx = FLASK.x + (BODY.x - TEXTURE.width / 2) * scale
    this.cy = pictureBottom - (TEXTURE.height - BODY.y) * scale
    this.radius = BODY.radius * scale

    // The shadow is added first, so the flask picture is drawn over it
    this.shadow = createShadow(scene, FLASK.x, FLASK.bottom, glass.width * scale, SHADOW.flaskShare)
    this.add(this.shadow)

    // The see-through copy if it was made, else the original, else just an outline circle
    if (key) {
      this.sprite = scene.add.image(FLASK.x, pictureBottom, key).setOrigin(0.5, 1).setScale(scale)
      this.add(this.sprite)
    } else {
      this.add(scene.add.circle(this.cx, this.cy, this.radius).setStrokeStyle(3, 0xf6e7c1))
    }
    this.liquid = scene.add.graphics()
    this.add(this.liquid)
  }

  // The top of the flask's rim: the pour is aimed at this point
  get mouth() {
    return this.mouthPoint
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

  // The emptying animation. No rotation: the flask leans away from the camera (scaled about the
  // middle of its base and moved up), the liquid drains and pours out behind it. Only a picture:
  // onReturn runs when the flask starts to go back, onDone when it stands normally again; the
  // caller resets the state then.
  playEmpty(onReturn: () => void, onDone: () => void) {
    const { scene, baseEdge, mouthPoint } = this
    const base = { x: FLASK.x, y: baseEdge.y } // the point the flask is scaled around
    const shadowY = FLASK.bottom - SHADOW.overlap // the shadow stays on the counter

    // How much liquid there is decides everything about the drain
    const startLevel = this.level
    const drops = Math.max(1, Math.round(startLevel * MAX_DROPS))
    const amount = MAX_DROPS > 1 ? (drops - 1) / (MAX_DROPS - 1) : 1 // 0 for 1 drop .. 1 for a full flask
    const drainMs = EMPTY_BASE_MS + EMPTY_PER_DROP_MS * drops
    const returnAt = drainMs + EMPTY_END_HOLD_MS

    // Stream, mist and droplets live in their own layer, inserted just BELOW the flask in the
    // parent, so they are behind the glass (seen through it) but above the bottles and counter.
    // The mouth is the normal mouth point scaled about the base and moved up like the flask.
    const parent = this.parentContainer
    const mouthX = base.x + (mouthPoint.x - base.x) * LEAN_AWAY_SCALE
    const mouthY = base.y + (mouthPoint.y - base.y) * LEAN_AWAY_SCALE - LEAN_AWAY_RISE
    const layer = scene.add.container(0, 0)
    if (parent) parent.addAt(layer, parent.getIndex(this))
    const liquid = this.color
    const stream = scene.add.graphics()
    layer.add(stream)
    const mist = this.makeMist(layer, mouthX, COUNTER_BACK_EDGE_Y, liquid, amount, drainMs)

    // ONE tween drives the level and the stream, so they cannot get out of step: the level goes
    // from where it is to 0 in a straight line, and the stream is as wide as the level is high.
    // The stream starts with the lean and is gone exactly when the level reaches 0.
    scene.tweens.killTweensOf(this.progress)
    this.from = { level: startLevel, color: this.color }
    this.to = { level: 0, color: this.color }
    const flow = { t: 0 }
    scene.tweens.add({
      targets: flow,
      t: 1,
      duration: drainMs,
      onStart: () => mist.begin(),
      onUpdate: () => {
        this.progress.t = flow.t
        this.drawAt(flow.t)
        // The stream grows from the mouth to the edge in the first moments, then stays that long
        const reach = Math.min(1, (flow.t * drainMs) / EMPTY_STREAM_REACH_MS)
        const length = (COUNTER_BACK_EDGE_Y - mouthY) * reach
        const width = STREAM_WIDTH.min + (STREAM_WIDTH.full - STREAM_WIDTH.min) * this.level
        stream.clear()
        stream.fillStyle(liquid, 1)
        stream.fillRoundedRect(mouthX - width / 2, mouthY, width, length, width / 2)
      },
      onComplete: () => {
        stream.destroy() // the level is 0: nothing flows any more
        mist.end()
      },
    })

    // One tween on a number: 0 = normal, 1 = leaning. Scaling a container about a point also
    // means moving it, so that point stays where it is.
    const lean = { amount: 0 }
    const apply = () => {
      const k = 1 + (LEAN_AWAY_SCALE - 1) * lean.amount
      this.setScale(k)
      this.setPosition(base.x - base.x * k, base.y - base.y * k - LEAN_AWAY_RISE * lean.amount)
      // The shadow is inside the flask: cancel the flask's scale and move, then apply its own
      // (narrower, lighter) look, kept at the same place on the counter
      this.shadow.setScale((1 + (SHADOW_AWAY.scaleX - 1) * lean.amount) / k, 1 / k)
      this.shadow.setY(base.y + (shadowY + LEAN_AWAY_RISE * lean.amount - base.y) / k)
      this.shadow.setAlpha(Phaser.Math.Linear(SHADOW.alpha, SHADOW_AWAY.alpha, lean.amount))
      this.surfaceStretch = 1 + (SURFACE_LEAN_STRETCH - 1) * lean.amount
      this.drawAt(this.progress.t)
    }
    scene.tweens.add({ targets: lean, amount: 1, duration: LEAN_IN_MS, ease: 'Sine.easeOut', onUpdate: apply })
    scene.time.delayedCall(returnAt, () => {
      onReturn()
      scene.tweens.add({
        targets: lean,
        amount: 0,
        duration: RETURN_MS,
        ease: 'Sine.easeInOut',
        onUpdate: apply,
        onComplete: () => {
          this.setScale(1).setPosition(0, 0)
          this.shadow.setScale(1).setY(shadowY).setAlpha(SHADOW.alpha)
          this.surfaceStretch = 1
          this.drawAt(this.progress.t)
          layer.destroy() // the mist has faded out by now; this also removes anything left
          onDone()
        },
      })
    })
  }

  // A soft mist puff at (x, y), where the stream ends: a few overlapping pale circles, and tiny
  // droplets that jump up. `amount` 0..1 (little .. a lot of liquid) sets the size, the alpha and
  // the number of droplets; `flowMs` is how long the liquid flows. begin() shows the puff once the stream reaches the edge and spawns
  // the droplets spread over the flow; end() starts the fade, which lasts MIST.fadeMs.
  private makeMist(layer: Phaser.GameObjects.Container, x: number, y: number, color: number, amount: number, flowMs: number) {
    const { scene } = this
    const pale = lerpColor(color, 0xffffff, MIST.lighten)
    const size = Phaser.Math.Linear(MIST.scale.min, MIST.scale.max, amount)
    const alpha = Phaser.Math.Linear(MIST.alpha.min, MIST.alpha.max, amount)
    const puff = scene.add.container(x, y).setAlpha(0).setScale(size)
    MIST.puffs.forEach(({ dx, dy, radius }) => puff.add(scene.add.circle(dx, dy, radius, pale)))
    layer.add(puff)
    const sprayCount = Math.round(Phaser.Math.Linear(SPRAY.count.min, SPRAY.count.max, amount))

    const spray = () => {
      const drop = scene.add.circle(x, y, SPRAY.radius, color)
      layer.add(drop)
      const dx = Phaser.Math.FloatBetween(-1, 1) * SPRAY.spreadX
      const rise = Phaser.Math.FloatBetween(SPRAY.riseMin, SPRAY.riseMax)
      const t = { v: 0 }
      scene.tweens.add({
        targets: t,
        v: 1,
        duration: SPRAY.ms,
        onUpdate: () => {
          drop.setPosition(x + dx * t.v, y - 4 * rise * t.v * (1 - t.v)) // a small arc, peak = rise
          drop.setAlpha(1 - t.v)
        },
        onComplete: () => drop.destroy(),
      })
    }

    return {
      begin: () => {
        // The puff appears when the stream gets there; the droplets jump one after another
        scene.tweens.add({ targets: puff, alpha, duration: MIST.fadeInMs, delay: EMPTY_STREAM_REACH_MS })
        const span = flowMs - EMPTY_STREAM_REACH_MS // the part of the flow in which the stream is at the edge
        for (let i = 0; i < sprayCount; i++) {
          scene.time.delayedCall(EMPTY_STREAM_REACH_MS + (i * span) / sprayCount, spray)
        }
      },
      end: () => scene.tweens.add({ targets: puff, alpha: 0, scale: size * MIST.growTo, duration: MIST.fadeMs }),
    }
  }

  // 0..1: blends the liquid towards white and redraws it
  setBrighten(amount: number) {
    this.brighten = amount
    this.drawAt(this.progress.t)
  }

  // level is 0..1 (drops / MAX_DROPS), as a fraction of the round body. A null color keeps the
  // current one, used when empty.
  setTarget(level: number, color: number | null, animate: boolean, ms = LIQUID_MS) {
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
      duration: ms,
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
    this.liquid.fillEllipse(cx, surfaceY, chord, chord * SURFACE.flatness * this.surfaceStretch)
  }
}
