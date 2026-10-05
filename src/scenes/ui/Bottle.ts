import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES } from '../../data/ingredients'
import type { Axis, Ingredient } from '../../data/ingredients'
import { createShadow, SHADOW } from './counterBand'
import { measureGlass } from './glassBox'
import { multiplyColor } from './liquidColor'
import { FONT, TEXT_COLOR } from './theme'
import type { Tooltip } from './Tooltip'

export const HOVER_SCALE = 1.08
export const HOVER_LIFT = 8 // pixels the bottle rises on hover
const HOVER_MS = 120
// Name pill under the bottle, `belowShadow` px under the shadow (so never over it)
const LABEL = { height: 22, padding: 16, minWidth: 56, belowShadow: 6 }
// The look of the name label: an apothecary label, drawn with shapes (too small for the plate's ornaments).
// Parchment (the plate's middle color), a thin copper border inside a fine dark ink outline.
const LABEL_LOOK = { fill: 0xf2e8d8, copper: 0xb0643c, copperWidth: 1.5, ink: 0x3b2412, inkWidth: 1, radius: 5 }
const EVENING_TINT = 0xffd9b0 // multiplied into the ingredient color in the evening
const POUR_LIFT = 40 // extra height the bottle rises while it travels to the flask
const POUR_ANGLE = Phaser.Math.DegToRad(-70) // negative = tilts to the left, towards the flask
const LABEL_FADE_MS = 120 // the name pill hides while the bottle is tilted
const SHAKE = { px: 4, ms: 50 } // "the flask is full" wiggle
const MOUTH_DROP_PX = 4 // the stream starts this far below the very top of the picture (the stopper / lid)
const SHADOW_FADE_PX = 120 // lifted this high (pour flight), the shadow is at its faintest

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
  // Contact shadow on the counter. Not a child: it stays on the counter while the bottle flies.
  // The owner adds it to the same container, just before the bottle.
  readonly shadow: Phaser.GameObjects.Ellipse
  private hoverFade = { t: 0 } // 0..1, 1 while hovered (the shadow fades)
  // Where the mouth is, in the container's own coordinates, for the sprite as it is right now
  private pouring = false // true from the click until the bottle is home again: hover does nothing
  private resetSprite: () => void = () => {} // stops hover tweens and puts the sprite in its resting pose
  private mouthLocal: (restPose: boolean) => { x: number; y: number } = () => ({ x: 0, y: 0 })

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

    // The container sits on the counter line. The sprite's bottom edge is shifted down by the
    // empty rows under the glass (`rest`), so the visible glass bottom is what touches the line.
    let hitTarget: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    let hover: (lifted: boolean) => void
    let shadowWidth = layout.height * 0.6
    let rest = 0 // sprite y when the bottle is not hovered
    if (scene.textures.exists(textureKey)) {
      const sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5, 1).setTint(this.color)
      const baseScale = layout.height / sprite.height
      const glass = measureGlass(scene, textureKey)
      rest = glass.gapBelow * baseScale
      sprite.setScale(baseScale).setY(rest)
      // The mouth's texture point, turned into container coordinates. Origin is bottom center, so
      // a texture point (tx, ty) is at ((tx - width / 2) * scale, y - (height - ty) * scale).
      // restPose = the bottle as it stands still; otherwise the live scale and y (hover lift).
      this.mouthLocal = (restPose) => {
        const scale = restPose ? baseScale : sprite.scaleX
        const y = restPose ? rest : sprite.y
        return {
          x: (glass.mouthX - sprite.width / 2) * scale,
          y: y - (sprite.height - glass.mouthY) * scale + MOUTH_DROP_PX,
        }
      }
      this.resetSprite = () => {
        scene.tweens.killTweensOf(sprite)
        sprite.setScale(baseScale).setY(rest)
      }
      hitTarget = sprite
      shadowWidth = glass.width * baseScale
      this.applyTint = (tint) => sprite.setTint(tint)
      hover = (lifted) => {
        this.fadeShadowOnHover(lifted)
        scene.tweens.add({
          targets: sprite,
          scale: lifted ? baseScale * HOVER_SCALE : baseScale,
          y: lifted ? rest - HOVER_LIFT : rest,
          duration: HOVER_MS,
        })
      }
      this.add(sprite)
    } else {
      // Missing art: a plain colored block of about the same size, so the game stays playable
      const block = scene.add.rectangle(0, 0, layout.height * 0.6, layout.height, this.color).setOrigin(0.5, 1)
      this.mouthLocal = () => ({ x: 0, y: block.y - layout.height })
      this.resetSprite = () => {
        scene.tweens.killTweensOf(block)
        block.setY(0)
      }
      hitTarget = block
      this.applyTint = (tint) => block.setFillStyle(tint)
      hover = (lifted) => {
        this.fadeShadowOnHover(lifted)
        scene.tweens.add({ targets: block, y: lifted ? -HOVER_LIFT : 0, duration: HOVER_MS })
      }
      this.add(block)
    }

    this.shadow = createShadow(scene, layout.x, layout.bottom, shadowWidth, SHADOW.bottleShare)
    // Just under the bottom of the shadow: its center y is the base minus overlap, plus half its height
    const shadowBottom = -SHADOW.overlap + SHADOW.height / 2
    const labelY = shadowBottom + LABEL.belowShadow + LABEL.height / 2
    const name = scene.add
      .text(0, labelY, ingredient.name, { fontFamily: FONT, fontSize: '14px', color: TEXT_COLOR })
      .setOrigin(0.5)
    const pillWidth = Math.max(LABEL.minWidth, name.width + LABEL.padding)
    // Its own container, so the pill can fade out as one piece while the bottle is tilted
    this.label = scene.add.container(0, 0, [this.drawLabelPlate(0, labelY, pillWidth, LABEL.height), name])
    this.add(this.label)

    hitTarget.setInteractive({ useHandCursor: true })
    hitTarget.on('pointerdown', () => onPick())
    hitTarget.on('pointerover', () => {
      if (this.pouring) return
      hover(true)
      tooltip.show(tooltipText, this.x, layout.tooltipY)
    })
    hitTarget.on('pointerout', () => {
      if (this.pouring) return
      hover(false)
      tooltip.hide()
    })
  }

  private drawLabelPlate(x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
    const { fill, copper, copperWidth, ink, inkWidth, radius } = LABEL_LOOK
    const g = this.scene.add.graphics()
    const left = x - width / 2
    const top = y - height / 2
    g.fillStyle(fill, 1)
    g.fillRoundedRect(left, top, width, height, radius)
    g.lineStyle(copperWidth, copper, 1) // the copper border, just inside the outline
    g.strokeRoundedRect(left + inkWidth + copperWidth / 2, top + inkWidth + copperWidth / 2, width - 2 * (inkWidth + copperWidth / 2), height - 2 * (inkWidth + copperWidth / 2), radius - 1)
    g.lineStyle(inkWidth, ink, 1) // the fine ink outline
    g.strokeRoundedRect(left, top, width, height, radius)
    return g
  }

  // Evening: the ingredient color is multiplied with a warm tint. Morning: the plain color.
  setEvening(evening: boolean) {
    this.applyTint(evening ? multiplyColor(this.color, EVENING_TINT) : this.color)
  }

  // Step 1 of a pour: stop every hover tween and put the bottle in its resting pose (scale 1,
  // base y), so the mouth position that flyToMouth solves for is the one the bottle really has.
  // Hover does nothing until endPour().
  beginPour() {
    this.pouring = true
    this.scene.tweens.killTweensOf([this, this.hoverFade, this.shadow])
    this.resetSprite()
    this.hoverFade.t = 0
    this.updateShadow()
  }

  endPour() {
    this.pouring = false
  }

  // Lifts and tilts the bottle so its mouth ends up exactly at `mouth` (canvas pixels)
  flyToMouth(mouth: { x: number; y: number }, ms: number, onDone: () => void) {
    // Where the mouth is relative to the container when the bottle is tilted; the container
    // must stand that far from the target (the mouth is what has to land on it).
    const offset = this.mouthAt(0, 0, POUR_ANGLE, true)
    this.glide(mouth.x - offset.x, mouth.y - offset.y, POUR_ANGLE, 0, ms, POUR_LIFT, onDone)
  }

  // The mouth point of a bottle standing at (x, y) and turned by `rotation`
  private mouthAt(x: number, y: number, rotation: number, restPose: boolean): { x: number; y: number } {
    const local = this.mouthLocal(restPose)
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    return { x: x + local.x * cos - local.y * sin, y: y + local.x * sin + local.y * cos }
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

  // The shadow stays on the counter under the bottle and gets fainter the higher the bottle is
  private updateShadow() {
    const lift = Math.max(0, this.layout.bottom - this.y)
    const faded = Math.max(this.hoverFade.t, Math.min(1, lift / SHADOW_FADE_PX)) // 0..1
    this.shadow.setX(this.x)
    this.shadow.setAlpha(Phaser.Math.Linear(SHADOW.alpha, SHADOW.liftedAlpha, faded))
  }

  private fadeShadowOnHover(lifted: boolean) {
    this.scene.tweens.add({
      targets: this.hoverFade,
      t: lifted ? 1 : 0,
      duration: HOVER_MS,
      onUpdate: () => this.updateShadow(),
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
        this.updateShadow()
      },
      onComplete: () => {
        this.updateShadow()
        onDone()
      },
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
