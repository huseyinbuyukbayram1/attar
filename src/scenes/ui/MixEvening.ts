import Phaser from 'phaser'
import { addGlow, ensureGlowTexture } from './glow'
import { lerpColor } from './liquidColor'
import { addProjectedPatch, addShapedLight, addSoftShaft, ensureShapedLight } from './shapedLight'
import type { Band, Rect } from './shapedLight'

// The evening look for the MIX phase, drawn over the counter_view picture and behind the
// bottles and flask. Positions are in 1280x720 canvas pixels, measured on the arched window and
// the lantern of counter_view.jpg; tune everything here.
// The arched window of counter_view.jpg (measured: the lit panes span x 154..251, y 194..428, the
// whole arch about x 144..280, y 72..448). The rectangle is a little larger than the arch.
const WINDOW_RECT: Rect = { x: 140, y: 70, width: 145, height: 380 }
const WINDOW_EVENING_COLOR = 0xff9a4d // the color of the evening light (shaft and patch use it as it is)
const WINDOW_GLOW_COLOR = lerpColor(WINDOW_EVENING_COLOR, 0xffffff, 0.3) // the panes: less saturated, 30 percent white
const WINDOW_SHARP_ALPHA = 0.6
const WINDOW_BLOOM = { scale: 1.08, alpha: 0.22 } // the same shape, a bit bigger and fainter
const WINDOW_BRIGHTNESS = { morning: 0.35, evening: 1 } // alpha of all window light together
const BREATH = { min: 0.92, max: 1, ms: 2500 } // evening only; ms one way, so a full breath is 5 s
// The light shaft: the window's right edge (A..B) swept down and to the right. Its gradient is
// gone (alpha 0) at SHAFT.to, well before the counter top (y 497), and it is blurred so it has no
// straight edge.
const SHAFT_BLUR_PX = 24
const SHAFT_ALPHA = 0.16 // evening
const SHAFT = {
  points: [
    { x: 275, y: 90 }, // A: top of the window's right edge
    { x: 560, y: 470 },
    { x: 400, y: 450 },
    { x: 275, y: 440 }, // B: bottom of the window's right edge
  ],
  from: { x: 275, y: 265 },
  to: { x: 420, y: 430 },
}
// The window's bars as gentle shadows in the shaft: darker by BAR_DARKEN along thin blurred
// bands. The two horizontal bars of the window (y 190 and 298) run along the beam; the vertical
// bar (mullion) shows as an upright band. Positions are estimates of the projection.
const BAR_DARKEN = 0.3
const BAR_BLUR_PX = 10
const BAR_WIDTH_PX = 12
const BEAM_DIRECTION = { dx: 0.55, dy: 0.84 } // the direction the light travels across the wall
const BANDS: Band[] = [
  { x: 275, y: 190, ...BEAM_DIRECTION, width: BAR_WIDTH_PX },
  { x: 275, y: 298, ...BEAM_DIRECTION, width: BAR_WIDTH_PX },
  { x: 350, y: 0, dx: 0, dy: 1, width: BAR_WIDTH_PX },
]
// The lit panes thrown onto the counter top: the main sign that sunlight comes in
const PATCH = {
  center: { x: 500, y: 557 },
  size: { width: 280, height: 110 },
  shearPx: 70, // the bottom is pushed this far to the right
  blurPx: 8,
  alpha: 0.22, // evening
}
// Dust in the shaft: tiny warm specks that drift slowly up and to the right, evening only
const DUST = {
  count: 14,
  radius: { min: 1, max: 2 },
  alpha: 0.45,
  color: 0xfff0d8,
  speedPx: { min: 4, max: 10 }, // px per second
  seconds: { min: 6, max: 10 }, // life of one speck, fading in and out
  maxY: 430, // specks only live where the shaft is visible (it is gone below this)
}
const TINTED_COPY = { tint: 0xffa66b, alpha: 0.5 }
const VIOLET = { color: 0x3a2060, alpha: 0.2 }
const LANTERN_GLOW = { x: 398, y: 100, radius: 90, color: 0xffc266, alpha: 1 } // the hanging lantern

export class MixEvening {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private windowLight: Phaser.GameObjects.Container // everything of the window light; faded as one
  private breath: Phaser.GameObjects.Container // glow, shaft and patch; breathes in the evening
  private dust: Phaser.GameObjects.Container
  private windowOnlyEvening: Phaser.GameObjects.GameObject[] = [] // hidden in the morning: bloom, shaft, patch
  private dustRunning = false
  private dustTweens: Phaser.Tweens.Tween[] = [] // so they can be stopped with the specks

  constructor(scene: Phaser.Scene, backgroundKey: string, depth: number) {
    this.scene = scene
    const { width, height } = scene.scale
    ensureGlowTexture(scene)

    const layers: Phaser.GameObjects.GameObject[] = []
    if (scene.textures.exists(backgroundKey)) {
      layers.push(
        scene.add
          .image(width / 2, height / 2, backgroundKey)
          .setDisplaySize(width, height)
          .setTint(TINTED_COPY.tint)
          .setAlpha(TINTED_COPY.alpha),
      )
    }
    layers.push(
      scene.add
        .rectangle(width / 2, height / 2, width, height, VIOLET.color, VIOLET.alpha)
        .setBlendMode(Phaser.BlendModes.MULTIPLY),
      addGlow(scene, LANTERN_GLOW.x, LANTERN_GLOW.y, LANTERN_GLOW.radius, LANTERN_GLOW.color).setAlpha(LANTERN_GLOW.alpha),
    )
    this.root = scene.add.container(0, 0, layers).setDepth(depth).setVisible(false)

    // The window light, built from the picture itself. It sits just above the evening look and
    // below the bottles, the flask, the notebook and their shadows (all at depth 0).
    ensureShapedLight(scene, backgroundKey, 'window_light', WINDOW_RECT)
    const [bloom, sharp] = addShapedLight(scene, 'window_light', WINDOW_RECT, WINDOW_GLOW_COLOR, WINDOW_SHARP_ALPHA, WINDOW_BLOOM.scale, WINDOW_BLOOM.alpha)
    const shaft = addSoftShaft(scene, 'window_shaft', SHAFT.points, SHAFT.from, SHAFT.to, BANDS, {
      color: WINDOW_EVENING_COLOR,
      alpha: SHAFT_ALPHA,
      blurPx: SHAFT_BLUR_PX,
      bandBlurPx: BAR_BLUR_PX,
      bandDarken: BAR_DARKEN,
    })
    const patch = addProjectedPatch(scene, 'window_patch', 'window_light', PATCH.center, PATCH.size, PATCH.shearPx, {
      color: WINDOW_EVENING_COLOR,
      alpha: PATCH.alpha,
      blurPx: PATCH.blurPx,
    })
    const evening: Phaser.GameObjects.GameObject[] = [...(patch ? [patch] : []), shaft, ...(bloom ? [bloom] : [])]
    this.windowOnlyEvening = evening
    this.breath = scene.add.container(0, 0, [...evening, ...(sharp ? [sharp] : [])])
    this.dust = scene.add.container(0, 0)
    this.windowLight = scene.add.container(0, 0, [this.breath, this.dust]).setDepth(depth + 1).setVisible(false)
  }

  // Called when the MIX phase starts, while the screen is still dark from the phase change, so the
  // look is put on at once: a fade here would show the daytime picture first. Evening: the whole
  // look, the window light breathes and dust drifts in the shaft. Morning: no evening look, only the faint sharp window light
  // (the morning window is already bright): no bloom, shaft, patch, dust or breathing.
  show(evening: boolean) {
    this.stopWindowLife()
    this.scene.tweens.killTweensOf([this.root, this.windowLight])
    this.windowOnlyEvening.forEach((layer) => (layer as Phaser.GameObjects.Image).setVisible(evening))
    this.windowLight.setAlpha(evening ? WINDOW_BRIGHTNESS.evening : WINDOW_BRIGHTNESS.morning).setVisible(true)
    if (!evening) {
      this.root.setVisible(false)
      return
    }
    this.root.setAlpha(1).setVisible(true)
    this.scene.tweens.add({ targets: this.breath, alpha: BREATH.min, duration: BREATH.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.startDust()
  }

  hide() {
    this.stopWindowLife()
    this.scene.tweens.killTweensOf([this.root, this.windowLight])
    this.root.setVisible(false)
    this.windowLight.setVisible(false)
  }

  // Stops the breathing and removes the dust (they only exist in the evening)
  private stopWindowLife() {
    this.dustRunning = false
    this.scene.tweens.killTweensOf(this.breath)
    this.breath.setAlpha(BREATH.max)
    this.dustTweens.forEach((tween) => tween.remove())
    this.dustTweens = []
    this.dust.removeAll(true)
  }

  private startDust() {
    this.dustRunning = true
    for (let i = 0; i < DUST.count; i++) this.spawnSpeck(Phaser.Math.Between(0, DUST.seconds.min * 1000))
  }

  // One speck: starts somewhere inside the shaft, drifts up and to the right while fading in and
  // out, then starts again somewhere else. Both its start and its end are inside the shaft.
  private spawnSpeck(delay: number) {
    if (!this.dustRunning) return
    const speed = Phaser.Math.FloatBetween(DUST.speedPx.min, DUST.speedPx.max)
    const seconds = Phaser.Math.FloatBetween(DUST.seconds.min, DUST.seconds.max)
    const move = { x: speed * seconds * 0.7, y: -speed * seconds * 0.7 } // up and to the right
    let start = this.randomPointInShaft()
    for (let tries = 0; tries < 30 && !this.insideShaft(start.x + move.x, start.y + move.y); tries++) {
      start = this.randomPointInShaft()
    }
    const speck = this.scene.add
      .circle(start.x, start.y, Phaser.Math.FloatBetween(DUST.radius.min, DUST.radius.max), DUST.color)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.dust.add(speck)
    const life = { t: 0 }
    const tween = this.scene.tweens.add({
      targets: life,
      t: 1,
      delay,
      duration: seconds * 1000,
      onUpdate: () => {
        speck.setPosition(start.x + move.x * life.t, start.y + move.y * life.t)
        speck.setAlpha(DUST.alpha * Math.sin(Math.PI * life.t)) // in, then out
      },
      onComplete: () => {
        speck.destroy()
        this.dustTweens = this.dustTweens.filter((t) => t !== tween)
        this.spawnSpeck(0)
      },
    })
    this.dustTweens.push(tween)
  }

  // The shaft polygon, cut off at DUST.maxY: that is the part where there is light to see
  private insideShaft(x: number, y: number): boolean {
    if (y > DUST.maxY) return false
    const pts = SHAFT.points
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const crosses = pts[i].y > y !== pts[j].y > y && x < ((pts[j].x - pts[i].x) * (y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x
      if (crosses) inside = !inside
    }
    return inside
  }

  private randomPointInShaft(): { x: number; y: number } {
    const xs = SHAFT.points.map((p) => p.x)
    const ys = SHAFT.points.map((p) => p.y)
    for (let tries = 0; tries < 50; tries++) {
      const x = Phaser.Math.FloatBetween(Math.min(...xs), Math.max(...xs))
      const y = Phaser.Math.FloatBetween(Math.min(...ys), Math.min(DUST.maxY, Math.max(...ys)))
      if (this.insideShaft(x, y)) return { x, y }
    }
    return { x: SHAFT.from.x + 10, y: SHAFT.from.y } // never reached in practice
  }
}
