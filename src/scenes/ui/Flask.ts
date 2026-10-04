import Phaser from 'phaser'
import { MAX_DROPS } from '../../game/scoring'
import { BASE_FRACTION, baseY, createShadow, SHADOW } from './counterBand'
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
// ---- Emptying the flask: tuning constants ----
// A copper waste pot (waste_pot.png, 360x322) slides in along the counter from the side of the
// screen nearest the flask, stops beside it, and the flask tilts towards it and pours into it.
// Then the flask tilts back and the pot slides out again. Times are in ms.
const WASTE_POT_KEY = 'waste_pot'
const WASTE_POT_HEIGHT_OF_FLASK = 0.8 // pot height as a share of the flask's height (0.8 to 1.0)
const WASTE_POT_TARGET_Y = 575 // canvas y of the pot's bottom: on the counter (band y 497..617)
const WASTE_POT_X_OFFSET = 0 // moves the pot sideways from the spot where the stream hits its opening
const WASTE_POT_SLIDE_MS = 450 // slide in, and the same for the slide out
const WASTE_POT_OFFSCREEN_MARGIN = 20 // the pot starts this far outside the screen
// The pot's opening, in picture pixels: MOUTH is the middle of the dark opening (measured: the dark
// area spans x 56..290, y 60..151), INTERIOR the size of the opening itself (estimated)
const WASTE_POT_MOUTH = { x: 173, y: 105 }
// The dark inside of the pot, an ellipse drawn just above the sprite and sized to fit inside the
// copper rim (the picture itself shows a lighter, teal-ish bottom there). Position and size are
// in picture pixels, relative to the picture's top-left corner.
const WASTE_POT_DARK = { x: 173, y: 110, width: 183, height: 75, color: 0x2a1810 } // was 176x68 at y 105; covers the teal sliver at the bottom edge
// Ripples inside the mouth while pouring: rings that grow to `maxShare` of the dark ellipse and fade
const RIPPLE = { everyMs: 260, ms: 520, startShare: 0.15, maxShare: 0.9, alpha: 0.4, lineWidth: 2, lighten: 0.5 }
// Vapour when the pour ends: soft puffs rise from the mouth, drift sideways, grow and fade
const VAPOUR = {
  count: { min: 6, max: 10 },
  radius: { min: 3, max: 6 }, // they start small
  grow: 3.4, // and grow a lot while they fade
  rise: { min: 40, max: 80 }, // px
  drift: 18, // px sideways, either way
  ms: 1000,
  maxDelayMs: 250, // the puffs do not all start at once
  alpha: 0.3, // the strongest a puff gets
  lighten: 0.6, // the mix colour mixed this far towards white
  // A soft edge without a blur: each puff is 3 circles on top of each other, the biggest the
  // faintest (radius as a share of the puff's radius)
  layers: [
    { radius: 1, alpha: 0.3 },
    { radius: 0.68, alpha: 0.4 },
    { radius: 0.4, alpha: 0.5 },
  ],
}
const FLASK_TILT_DEG = 62 // how far the flask tilts towards the pot (60 to 80)
const FLASK_TILT_MS = 400 // tilting towards the pot, and the same for tilting back
const POUR_HOLD_MS = 150 // after the last drop, the flask waits this long before tilting back
// The pour itself (the stream running while the level drops) lasts longer the more liquid there is
const POUR_BASE_MS = 250
const POUR_PER_DROP_MS = 140 // per drop: 1 drop = 390 ms, 6 drops = 1090 ms
const STREAM_WIDTH = { full: 7, min: 2 } // px: at a full flask, and just before the end
const STREAM_REACH_MS = 120 // how long the stream takes to grow from the flask's mouth to the pot
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
  private evening = false
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
    this.evening = evening
    if (evening) this.sprite?.setTint(EVENING_TINT)
    else this.sprite?.clearTint()
  }

  // The emptying animation, in steps: 1) the pot slides in, 2) the flask tilts towards it, 3) the
  // liquid pours into the pot while the level drops, 4) the flask tilts back, 5) the pot slides out.
  // Only a picture. Callbacks: onPour when the pouring starts (the caller plays the pour sound),
  // onBack when the flask starts to tilt back (the slots empty), onDone at the very end (the
  // caller resets the state then).
  playEmpty(callbacks: { onPour: () => void; onBack: () => void; onDone: () => void }) {
    const { scene, baseEdge, mouthPoint } = this
    const { onPour, onBack, onDone } = callbacks
    const width = scene.scale.width

    // How much liquid there is decides the length of the pour
    const startLevel = this.level
    const drops = Math.max(1, Math.round(startLevel * MAX_DROPS))
    const pourMs = POUR_BASE_MS + POUR_PER_DROP_MS * drops
    const liquid = this.color

    // The pot comes from the side nearest the flask, and the flask tilts towards that side
    const fromLeft = FLASK.x < width / 2
    const dir = fromLeft ? -1 : 1 // negative rotation = the top of the flask goes left
    const tilt = Phaser.Math.DegToRad(FLASK_TILT_DEG) * dir

    // Where the flask's mouth ends up when it is tilted: the mouth point turned around the pivot,
    // the bottom corner of the flask on the pot's side. The stream falls straight down from there.
    const pivot = { x: FLASK.x + dir * (baseEdge.x - FLASK.x), y: baseEdge.y } // baseEdge is the right end of the base
    const turn = (point: { x: number; y: number }, angle: number) => ({
      x: pivot.x + (point.x - pivot.x) * Math.cos(angle) - (point.y - pivot.y) * Math.sin(angle),
      y: pivot.y + (point.x - pivot.x) * Math.sin(angle) + (point.y - pivot.y) * Math.cos(angle),
    })
    const pourPoint = turn(mouthPoint, tilt)

    // Stream, pot, mist: one layer just BELOW the flask in its parent, so the pot is in front of the
    // counter and the other props, and the flask (transparent glass) is in front of the pot
    const parent = this.parentContainer
    const layer = scene.add.container(0, 0)
    if (parent) parent.addAt(layer, parent.getIndex(this))

    // The pot: its bottom stands on the counter at WASTE_POT_TARGET_Y, its opening is right under
    // the pour point (plus the offset)
    let pot: { sprite: Phaser.GameObjects.Image; dark: Phaser.GameObjects.Ellipse; scale: number; targetX: number; startX: number } | undefined
    let potMouthY = WASTE_POT_TARGET_Y - 60 // only used without a pot
    if (scene.textures.exists(WASTE_POT_KEY)) {
      const sprite = scene.add.image(0, 0, WASTE_POT_KEY).setOrigin(0.5, 1)
      if (this.evening) sprite.setTint(EVENING_TINT)
      const scale = (FLASK.height * WASTE_POT_HEIGHT_OF_FLASK) / sprite.height
      sprite.setScale(scale)
      const gap = measureGlass(scene, WASTE_POT_KEY).gapBelow * scale // empty rows under the pot
      const spriteBottom = WASTE_POT_TARGET_Y + gap
      sprite.setY(spriteBottom)
      // The sprite's x for which the middle of the opening is at x = pourPoint.x + offset
      const targetX = pourPoint.x + WASTE_POT_X_OFFSET - (WASTE_POT_MOUTH.x - sprite.width / 2) * scale
      const startX = fromLeft ? -sprite.displayWidth / 2 - WASTE_POT_OFFSCREEN_MARGIN : width + sprite.displayWidth / 2 + WASTE_POT_OFFSCREEN_MARGIN
      sprite.setX(startX)
      potMouthY = spriteBottom - (sprite.height - WASTE_POT_MOUTH.y) * scale
      const dark = scene.add
        .ellipse(0, spriteBottom - (sprite.height - WASTE_POT_DARK.y) * scale, WASTE_POT_DARK.width * scale, WASTE_POT_DARK.height * scale, WASTE_POT_DARK.color)
      layer.add([sprite, dark]) // the dark inside is just above the pot picture
      pot = { sprite, dark, scale, targetX, startX }
    } else {
      console.warn('Texture "waste_pot" missing, emptying without the pot')
    }
    // The dark inside follows the sprite when it slides
    const placeDark = () => {
      if (pot) pot.dark.setX(pot.sprite.x + (WASTE_POT_DARK.x - pot.sprite.width / 2) * pot.scale)
    }
    placeDark()
    const slidePot = (toX: number, ease: string, then: () => void) => {
      if (!pot) {
        then()
        return
      }
      scene.tweens.add({ targets: pot.sprite, x: toX, duration: WASTE_POT_SLIDE_MS, ease, onUpdate: placeDark, onComplete: then })
    }

    const stream = scene.add.graphics()
    layer.add(stream)
    // Everything created for the animation that has its own tween or timer, so that it can be
    // stopped before the layer is destroyed
    const effects: { remove: () => void }[] = []
    let rippleTimer: Phaser.Time.TimerEvent | undefined
    const pale = (amountToWhite: number) => lerpColor(liquid, 0xffffff, amountToWhite)
    const mouthX = pourPoint.x + WASTE_POT_X_OFFSET // the middle of the pot's mouth, on the screen
    const darkWidth = pot ? pot.dark.width : 0
    const darkHeight = pot ? pot.dark.height : 0

    // One ring that grows inside the mouth and fades. It stays inside the dark ellipse (it never
    // gets bigger than maxShare of it), so it cannot spill over the rim; no mask is needed.
    const ripple = () => {
      if (!pot) return
      const ring = scene.add.ellipse(mouthX, pot.dark.y, darkWidth, darkHeight).setStrokeStyle(RIPPLE.lineWidth, pale(RIPPLE.lighten), RIPPLE.alpha)
      layer.add(ring)
      const grow = { t: 0 }
      const tween = scene.tweens.add({
        targets: grow,
        t: 1,
        duration: RIPPLE.ms,
        onUpdate: () => {
          ring.setScale(Phaser.Math.Linear(RIPPLE.startShare, RIPPLE.maxShare, grow.t))
          ring.setAlpha(1 - grow.t)
        },
        onComplete: () => ring.destroy(),
      })
      effects.push(tween)
    }

    // Soft vapour puffs from the mouth when the pour is over
    const vapour = () => {
      const count = Phaser.Math.Between(VAPOUR.count.min, VAPOUR.count.max)
      for (let i = 0; i < count; i++) {
        const radius = Phaser.Math.FloatBetween(VAPOUR.radius.min, VAPOUR.radius.max)
        const color = pale(VAPOUR.lighten)
        const puff = scene.add
          .container(mouthX + Phaser.Math.FloatBetween(-0.4, 0.4) * darkWidth, potMouthY, VAPOUR.layers.map((l) => scene.add.circle(0, 0, radius * l.radius, color, l.alpha)))
          .setAlpha(0)
        layer.add(puff)
        const rise = Phaser.Math.FloatBetween(VAPOUR.rise.min, VAPOUR.rise.max)
        const drift = Phaser.Math.FloatBetween(-VAPOUR.drift, VAPOUR.drift)
        const startX = puff.x
        const life = { t: 0 }
        effects.push(
          scene.tweens.add({
            targets: life,
            t: 1,
            delay: Phaser.Math.Between(0, VAPOUR.maxDelayMs),
            duration: VAPOUR.ms,
            onUpdate: () => {
              puff.setPosition(startX + drift * life.t, potMouthY - rise * life.t)
              puff.setScale(Phaser.Math.Linear(1, VAPOUR.grow, life.t))
              puff.setAlpha(VAPOUR.alpha * Math.sin(Math.PI * life.t)) // in, then out
            },
            onComplete: () => puff.destroy(),
          }),
        )
      }
    }

    // The flask tilts around its bottom corner: turning a container around a point also means
    // moving it, so that point stays where it is. 0 = upright, 1 = fully tilted.
    const lean = { amount: 0 }
    const shadowY = FLASK.bottom - SHADOW.overlap
    const apply = () => {
      const angle = tilt * lean.amount
      this.rotation = angle
      this.x = pivot.x - (pivot.x * Math.cos(angle) - pivot.y * Math.sin(angle))
      this.y = pivot.y - (pivot.x * Math.sin(angle) + pivot.y * Math.cos(angle))
      // The shadow belongs on the counter: it fades out while the flask lies over
      this.shadow.setAlpha(SHADOW.alpha * (1 - lean.amount))
      this.shadow.setY(shadowY)
    }
    const tiltTo = (target: number, then: () => void) =>
      scene.tweens.add({ targets: lean, amount: target, duration: FLASK_TILT_MS, ease: 'Sine.easeInOut', onUpdate: apply, onComplete: then })

    // The pour: ONE tween drives the level and the stream, so they cannot get out of step. The
    // stream starts with the pour and is gone exactly when the level reaches 0. It falls straight
    // down from the tilted mouth into the pot's opening.
    const pour = (then: () => void) => {
      onPour()
      scene.tweens.killTweensOf(this.progress)
      this.from = { level: startLevel, color: this.color }
      this.to = { level: 0, color: this.color }
      const flow = { t: 0 }
      // Ripples while pouring
      ripple()
      rippleTimer = scene.time.addEvent({ delay: RIPPLE.everyMs, loop: true, callback: ripple })
      scene.tweens.add({
        targets: flow,
        t: 1,
        duration: pourMs,
        onUpdate: () => {
          this.progress.t = flow.t
          this.drawAt(flow.t)
          const reach = Math.min(1, (flow.t * pourMs) / STREAM_REACH_MS)
          const length = Math.max(0, potMouthY - pourPoint.y) * reach
          const streamWidth = STREAM_WIDTH.min + (STREAM_WIDTH.full - STREAM_WIDTH.min) * this.level
          stream.clear()
          stream.fillStyle(liquid, 1)
          stream.fillRoundedRect(pourPoint.x - streamWidth / 2, pourPoint.y, streamWidth, length, streamWidth / 2)
        },
        onComplete: () => {
          stream.destroy() // the level is 0: nothing flows any more
          rippleTimer?.remove() // the rings already on their way finish by themselves
          vapour()
          then()
        },
      })
    }

    // The steps, one after the other
    slidePot(pot ? pot.targetX : 0, 'Sine.easeOut', () =>
      tiltTo(1, () =>
        pour(() =>
          scene.time.delayedCall(POUR_HOLD_MS, () => {
            onBack()
            tiltTo(0, () => {
              this.setRotation(0).setPosition(0, 0)
              this.shadow.setAlpha(SHADOW.alpha).setY(shadowY)
              this.drawAt(this.progress.t)
              slidePot(pot ? pot.startX : 0, 'Sine.easeIn', () => {
                effects.forEach((effect) => effect.remove())
                layer.destroy() // the pot is out of the screen; this also removes anything left
                onDone()
              })
            })
          }),
        ),
      ),
    )
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
    this.liquid.fillEllipse(cx, surfaceY, chord, chord * SURFACE.flatness)
  }
}
