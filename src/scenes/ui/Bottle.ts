import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES } from '../../data/ingredients'
import type { Axis, Ingredient } from '../../data/ingredients'
import { addPanel, FONT, TEXT_COLOR } from './theme'
import type { Tooltip } from './Tooltip'

const HOVER_SCALE = 1.08
const HOVER_LIFT = 8 // pixels the bottle rises on hover
const HOVER_MS = 120
const LABEL = { gap: 14, height: 22, padding: 16, minWidth: 56 } // name pill under the bottle; gap = bottom of bottle to pill center
const TOOLTIP_GAP = 6 // space between the top of a lifted bottle and its tooltip

// Where one bottle stands: x = center, bottom = the line it stands on, height = displayed height
export type BottleLayout = { x: number; bottom: number; height: number }

// The two strongest axes tell the player what an ingredient smells like
function strongestAxes(ingredient: Ingredient): Axis[] {
  return AXES.filter((axis) => ingredient.scent[axis] > 0)
    .sort((a, b) => ingredient.scent[b] - ingredient.scent[a])
    .slice(0, 2)
}

// An ingredient bottle standing on the counter: a sprite tinted with the ingredient color,
// a name pill under it, and a tooltip with the scent axes while the mouse is over it.
export class Bottle extends Phaser.GameObjects.Container {
  // onPick gets the point where a drop should start flying from (the bottle's mouth)
  constructor(
    scene: Phaser.Scene,
    layout: BottleLayout,
    textureKey: string,
    ingredient: Ingredient,
    tooltip: Tooltip,
    onPick: (fromX: number, fromY: number) => void,
  ) {
    super(scene, layout.x, layout.bottom)
    scene.add.existing(this)
    const color = INGREDIENT_COLORS[ingredient.id] ?? FALLBACK_COLOR
    const tooltipText = `${ingredient.name}: ${strongestAxes(ingredient).join(', ')}`

    // The container sits on the counter line; the sprite's origin is its bottom center
    let hitTarget: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    let hover: (lifted: boolean) => void
    if (scene.textures.exists(textureKey)) {
      const sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5, 1).setTint(color)
      const baseScale = layout.height / sprite.height
      sprite.setScale(baseScale)
      hitTarget = sprite
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
      const block = scene.add.rectangle(0, 0, layout.height * 0.6, layout.height, color).setOrigin(0.5, 1)
      hitTarget = block
      hover = (lifted) => {
        scene.tweens.add({ targets: block, y: lifted ? -HOVER_LIFT : 0, duration: HOVER_MS })
      }
      this.add(block)
    }

    const name = scene.add
      .text(0, LABEL.gap, ingredient.name, { fontFamily: FONT, fontSize: '14px', color: TEXT_COLOR })
      .setOrigin(0.5)
    const pillWidth = Math.max(LABEL.minWidth, name.width + LABEL.padding)
    this.add([addPanel(scene, 0, LABEL.gap, pillWidth, LABEL.height, LABEL.height / 2), name])

    hitTarget.setInteractive({ useHandCursor: true })
    hitTarget.on('pointerdown', () => onPick(this.x, this.y - layout.height))
    hitTarget.on('pointerover', () => {
      hover(true)
      tooltip.show(tooltipText, this.x, this.y - layout.height - HOVER_LIFT - TOOLTIP_GAP)
    })
    hitTarget.on('pointerout', () => {
      hover(false)
      tooltip.hide()
    })
  }
}
