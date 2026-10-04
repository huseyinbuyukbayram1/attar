import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES } from '../../data/ingredients'
import type { Axis, Ingredient } from '../../data/ingredients'
import { multiplyColor } from './liquidColor'
import { addPanel, FONT, TEXT_COLOR } from './theme'
import type { Tooltip } from './Tooltip'

export const HOVER_SCALE = 1.08
export const HOVER_LIFT = 8 // pixels the bottle rises on hover
const HOVER_MS = 120
const LABEL = { gap: 14, height: 22, padding: 16, minWidth: 56 } // name pill under the bottle; gap = bottom of bottle to pill center
const EVENING_TINT = 0xffd9b0 // multiplied into the ingredient color in the evening
const POUR_LIFT = 40 // extra height the bottle rises while it travels to the flask
const POUR_ANGLE = Phaser.Math.DegToRad(-70) // negative = tilts to the left, towards the flask
const LABEL_FADE_MS = 120 // the name pill hides while the bottle is tilted
const SHAKE = { px: 4, ms: 50 } // "the flask is full" wiggle

// Where one bottle stands: x = center, bottom = the line it stands on, height = displayed height.
// tooltipY is the fixed canvas y where the bottom of its tooltip goes (above the tallest bottle).
export type BottleLayout = { x: number; bottom: number; height: number; tooltipY: number }

// The two strongest axes tell the player what an ingredient smells like
function strongestAxes(ingredient: Ingredient): Axis[] {
  return AXES.filter((axis) => ingredient.scent[axis] > 0)
    .sort((a, b) => ingredient.scent[b] - ingredient.scent[a])
    .slice(0, 2)
}

// An ingredient bottle standing on the counter: a sprite tinted with the ingredient color,
// a name pill under it, and a tooltip with the scent axes while the mouse is over it.
export class Bottle extends Phaser.GameObjects.Container {
  private layout: BottleLayout
  private label: Phaser.GameObjects.Container
  private color: number
  private applyTint: (tint: number) => void
  private moving = { t: 0 } // 0 -> 1 progress of the current flight
  private shaking = false

  constructor(
    scene: Phaser.Scene,
    layout: BottleLayout,
    textureKey: string,
    ingredient: Ingredient,
    tooltip: Tooltip,
    onPick: () => void,
  ) {
    super(scene, layout.x, layout.bottom)
    scene.add.existing(this)
    this.layout = layout
    this.color = INGREDIENT_COLORS[ingredient.id] ?? FALLBACK_COLOR
    const tooltipText = `${ingredient.name}: ${strongestAxes(ingredient).join(', ')}`

    // The container sits on the counter line; the sprite's origin is its bottom center
    let hitTarget: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    let hover: (lifted: boolean) => void
    if (scene.textures.exists(textureKey)) {
      const sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5, 1).setTint(this.color)
      const baseScale = layout.height / sprite.height
      sprite.setScale(baseScale)
      hitTarget = sprite
      this.applyTint = (tint) => sprite.setTint(tint)
      hover = (lifted) => {
        scene.tweens.add({
          targets: sprite,
          scale: lifted ? baseScale * HOVER_SCALE : baseScale,
          y: lifted ? -HOVER_LIFT : 0,
          duration: HOVER_MS,
        })
      }
      this.add(sprite)
    } else {
      // Missing art: a plain colored block of about the same size, so the game stays playable
      const block = scene.add.rectangle(0, 0, layout.height * 0.6, layout.height, this.color).setOrigin(0.5, 1)
      hitTarget = block
      this.applyTint = (tint) => block.setFillStyle(tint)
      hover = (lifted) => {
        scene.tweens.add({ targets: block, y: lifted ? -HOVER_LIFT : 0, duration: HOVER_MS })
      }
      this.add(block)
    }

    const name = scene.add
      .text(0, LABEL.gap, ingredient.name, { fontFamily: FONT, fontSize: '14px', color: TEXT_COLOR })
      .setOrigin(0.5)
    const pillWidth = Math.max(LABEL.minWidth, name.width + LABEL.padding)
    // Its own container, so the pill can fade out as one piece while the bottle is tilted
    this.label = scene.add.container(0, 0, [addPanel(scene, 0, LABEL.gap, pillWidth, LABEL.height, LABEL.height / 2), name])
    this.add(this.label)

    hitTarget.setInteractive({ useHandCursor: true })
    hitTarget.on('pointerdown', () => onPick())
    hitTarget.on('pointerover', () => {
      hover(true)
      tooltip.show(tooltipText, this.x, layout.tooltipY)
    })
    hitTarget.on('pointerout', () => {
      hover(false)
      tooltip.hide()
    })
  }

  // Evening: the ingredient color is multiplied with a warm tint. Morning: the plain color.
  setEvening(evening: boolean) {
    this.applyTint(evening ? multiplyColor(this.color, EVENING_TINT) : this.color)
  }

  // Lifts and tilts the bottle so its mouth ends up exactly at `mouth` (canvas pixels)
  flyToMouth(mouth: { x: number; y: number }, ms: number, onDone: () => void) {
    // The mouth is the top center of the sprite, (0, -height) in the bottle's own coordinates.
    // Rotating that point by the angle tells where the container must be for the mouth to land.
    const { height } = this.layout
    const x = mouth.x - height * Math.sin(POUR_ANGLE)
    const y = mouth.y + height * Math.cos(POUR_ANGLE)
    this.glide(x, y, POUR_ANGLE, 0, ms, POUR_LIFT, onDone)
  }

  // Back to the exact spot on the counter, upright
  flyHome(ms: number, onDone: () => void) {
    this.glide(this.layout.x, this.layout.bottom, 0, 1, ms, 0, onDone)
  }

  // Tiny "no" wiggle, for a click when the flask is full
  shake() {
    if (this.shaking) return
    this.shaking = true
    this.scene.tweens.add({
      targets: this,
      x: `+=${SHAKE.px}`,
      duration: SHAKE.ms,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.x = this.layout.x // yoyo should end here already; this guarantees it
        this.shaking = false
      },
    })
  }

  // Moves position and rotation from where they are now to the given values. The tween runs on
  // a 0..1 number and everything is blended from it; `arc` adds a hump so the path curves up.
  private glide(x: number, y: number, rotation: number, labelAlpha: number, ms: number, arc: number, onDone: () => void) {
    const from = { x: this.x, y: this.y, rotation: this.rotation, labelAlpha: this.label.alpha }
    this.moving.t = 0
    this.scene.tweens.add({
      targets: this.moving,
      t: 1,
      duration: ms,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = this.moving.t
        this.x = Phaser.Math.Linear(from.x, x, t)
        this.y = Phaser.Math.Linear(from.y, y, t) - Math.sin(Math.PI * t) * arc
        this.rotation = Phaser.Math.Linear(from.rotation, rotation, t)
      },
      onComplete: onDone,
    })
    // The pill fades quickly instead of following t: gone at the start of a flight out, and
    // back only at the end of the flight home
    const fadeMs = Math.min(ms, LABEL_FADE_MS)
    this.scene.tweens.add({
      targets: this.label,
      alpha: labelAlpha,
      duration: fadeMs,
      delay: labelAlpha === 1 ? ms - fadeMs : 0,
    })
  }
}
