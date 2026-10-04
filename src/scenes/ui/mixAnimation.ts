import Phaser from 'phaser'
import type { Flask } from './Flask'
import { lerpColor } from './liquidColor'

const MIX_MS = 900
const SHAKE = { px: 5, cycles: 4 } // how far and how many times the flask swings left and right
const SWIRL = { turns: 1.5, flatness: 0.28, lineWidth: 3, alpha: 0.7, lighten: 0.5 }
const BRIGHTEN_MAX = 0.22 // how far the liquid is blended towards white at the peak
const SPARKLES = { min: 3, max: 6, radius: 3, rise: 70, ms: 500, maxDelay: 350, lighten: 0.65 }

// "Let them smell" animation: the flask shakes, a swirl turns inside the liquid, the liquid
// brightens and a few sparkles rise. It is only a picture; the state does not change here.
// One tween on a 0..1 number drives the shake, swirl and brightness, so they stay in step.
export function playMixAnimation(scene: Phaser.Scene, flask: Flask, onDone: () => void) {
  const body = flask.bowl
  const level = flask.liquidLevel
  const color = flask.liquidColor

  // The swirl sits in the middle of the liquid and is kept small enough to stay inside it
  const depth = level * 2 * body.radius
  const centerY = body.y + body.radius - depth / 2
  const halfLength = Math.min(body.radius * 0.6, depth * 0.45)
  const swirlColor = lerpColor(color, 0xffffff, SWIRL.lighten)
  const swirls = [0, Math.PI / 2].map((start) => {
    const ring = scene.add
      .ellipse(body.x, centerY, halfLength * 2, halfLength * 2 * SWIRL.flatness)
      .setStrokeStyle(SWIRL.lineWidth, swirlColor, SWIRL.alpha)
      .setRotation(start)
      .setAlpha(0)
    flask.add(ring)
    return { ring, start }
  })

  // Sparkles: lighter dots that rise from the liquid surface and fade out
  const surfaceY = flask.surfaceYAt(level)
  const sparkleColor = lerpColor(color, 0xffffff, SPARKLES.lighten)
  const count = Phaser.Math.Between(SPARKLES.min, SPARKLES.max)
  for (let i = 0; i < count; i++) {
    const x = body.x + Phaser.Math.FloatBetween(-0.6, 0.6) * body.radius
    const dot = scene.add.circle(x, surfaceY, SPARKLES.radius, sparkleColor)
    flask.add(dot)
    scene.tweens.add({
      targets: dot,
      y: surfaceY - SPARKLES.rise,
      alpha: 0,
      scale: 0.3,
      delay: Phaser.Math.Between(0, SPARKLES.maxDelay),
      duration: SPARKLES.ms,
      onComplete: () => dot.destroy(),
    })
  }

  const progress = { t: 0 }
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: MIX_MS,
    onUpdate: () => {
      const t = progress.t
      const bump = Math.sin(Math.PI * t) // 0 -> 1 -> 0 over the animation
      flask.x = Math.sin(t * Math.PI * 2 * SHAKE.cycles) * SHAKE.px * bump
      flask.setBrighten(bump * BRIGHTEN_MAX)
      swirls.forEach(({ ring, start }, i) => {
        // The two rings turn in opposite directions
        ring.setRotation(start + (i === 0 ? 1 : -1) * t * Math.PI * 2 * SWIRL.turns)
        ring.setAlpha(bump)
      })
    },
    onComplete: () => {
      flask.x = 0
      flask.setBrighten(0)
      swirls.forEach(({ ring }) => ring.destroy())
      onDone()
    },
  })
}
