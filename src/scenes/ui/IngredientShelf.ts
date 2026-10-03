import Phaser from 'phaser'
import { INGREDIENT_COLORS, FALLBACK_COLOR } from '../../data/ingredientColors'
import { AXES, INGREDIENTS } from '../../data/ingredients'
import type { Axis, Ingredient } from '../../data/ingredients'

// Layout: one row of 10 buttons along the bottom of the 1280x720 screen
const START_X = 100
const SPACING = 120
const CIRCLE_Y = 585
const CIRCLE_RADIUS = 26
const NAME_Y = 626
const AXES_Y = 648

// The two strongest axes tell the player what an ingredient smells like
function strongestAxes(ingredient: Ingredient): Axis[] {
  return AXES.filter((axis) => ingredient.scent[axis] > 0)
    .sort((a, b) => ingredient.scent[b] - ingredient.scent[a])
    .slice(0, 2)
}

export function addIngredientShelf(scene: Phaser.Scene, onPick: (id: string) => void) {
  INGREDIENTS.forEach((ingredient, i) => {
    const x = START_X + i * SPACING
    const color = INGREDIENT_COLORS[ingredient.id] ?? FALLBACK_COLOR

    scene.add
      .circle(x, CIRCLE_Y, CIRCLE_RADIUS, color)
      .setStrokeStyle(2, 0xf3e2b3)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onPick(ingredient.id))

    scene.add
      .text(x, NAME_Y, ingredient.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#f3e2b3',
      })
      .setOrigin(0.5)

    scene.add
      .text(x, AXES_Y, strongestAxes(ingredient).join(', '), {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#c9b98a',
      })
      .setOrigin(0.5)
  })
}
