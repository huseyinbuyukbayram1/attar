import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES } from '../../data/ingredients'
import type { Axis, Ingredient } from '../../data/ingredients'
import { addPanel, BORDER, FONT, TEXT_COLOR } from './theme'

// Bottle shape, relative to the bottle's center
const BODY = { width: 64, height: 70, radius: 16 }
const NECK = { width: 22, height: 18 }
const CORK = { width: 18, height: 8, color: 0xb88a5a }
const NAME_PILL = { width: 104, height: 28, gap: 22 } // gap below the bottom of the body
const TOOLTIP_GAP = 20 // space between the cork and the tooltip
const HIT_WIDTH = 84 // clickable area: this wide, from the cork down to the bottom of the body

// The two strongest axes tell the player what an ingredient smells like
function strongestAxes(ingredient: Ingredient): Axis[] {
  return AXES.filter((axis) => ingredient.scent[axis] > 0)
    .sort((a, b) => ingredient.scent[b] - ingredient.scent[a])
    .slice(0, 2)
}

// A placeholder ingredient bottle: colored body and neck, a name below, and the
// scent axes as a tooltip only while the mouse hovers (so the screen stays calm).
export class Bottle extends Phaser.GameObjects.Container {
  private tooltip: Phaser.GameObjects.Container

  // onPick gets the point where a drop should start flying from (the bottle's mouth)
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ingredient: Ingredient,
    onPick: (fromX: number, fromY: number) => void,
  ) {
    super(scene, x, y)
    scene.add.existing(this)
    const color = INGREDIENT_COLORS[ingredient.id] ?? FALLBACK_COLOR
    const corkTop = -BODY.height / 2 - NECK.height - CORK.height

    const shape = scene.add.graphics()
    shape.fillStyle(color, 1)
    shape.fillRoundedRect(-NECK.width / 2, -BODY.height / 2 - NECK.height, NECK.width, NECK.height + 6, 4)
    shape.fillRoundedRect(-BODY.width / 2, -BODY.height / 2, BODY.width, BODY.height, BODY.radius)
    shape.lineStyle(2, BORDER, 1)
    shape.strokeRoundedRect(-BODY.width / 2, -BODY.height / 2, BODY.width, BODY.height, BODY.radius)
    shape.fillStyle(CORK.color, 1)
    shape.fillRoundedRect(-CORK.width / 2, corkTop, CORK.width, CORK.height, 3)
    shape.fillStyle(0xffffff, 0.3) // glass highlight
    shape.fillRoundedRect(-BODY.width / 2 + 8, -BODY.height / 2 + 8, 8, BODY.height - 24, 4)

    const nameY = BODY.height / 2 + NAME_PILL.gap
    const name = scene.add
      .text(0, nameY, ingredient.name, { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR })
      .setOrigin(0.5)

    this.tooltip = this.buildTooltip(scene, strongestAxes(ingredient).join(', '), corkTop - TOOLTIP_GAP)

    const hitHeight = BODY.height / 2 - corkTop
    const hit = scene.add
      .zone(0, (corkTop + BODY.height / 2) / 2, HIT_WIDTH, hitHeight)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => onPick(this.x, this.y + corkTop))
    hit.on('pointerover', () => {
      // Move this bottle in front of its neighbours so the tooltip is never covered
      this.parentContainer?.bringToTop(this)
      this.tooltip.setVisible(true)
    })
    hit.on('pointerout', () => this.tooltip.setVisible(false))

    this.add([shape, addPanel(scene, 0, nameY, NAME_PILL.width, NAME_PILL.height, 12), name, this.tooltip, hit])
  }

  private buildTooltip(scene: Phaser.Scene, text: string, y: number): Phaser.GameObjects.Container {
    const label = scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR })
      .setOrigin(0.5)
    const tooltip = scene.add.container(0, y, [addPanel(scene, 0, 0, label.width + 28, 30, 15), label])
    return tooltip.setVisible(false)
  }
}
