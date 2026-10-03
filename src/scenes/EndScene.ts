import Phaser from 'phaser'
import { MAX_STARS } from '../game/gameState'
import { Button } from './ui/Button'

// Best rating first: the first line whose minimum the player reaches is used
const RATINGS = [
  { minStars: 27, word: 'Master perfumer' },
  { minStars: 20, word: 'Skilled attar maker' },
  { minStars: 12, word: 'Promising apprentice' },
  { minStars: 0, word: 'Beginner' },
]

const FONT = 'Georgia, serif'

// Shown after the last customer: total score, a rating word and a restart button
export class EndScene extends Phaser.Scene {
  private totalStars = 0

  constructor() {
    super('EndScene')
  }

  // Phaser hands over whatever ShopScene passed to scene.start
  init(data: { totalStars: number }) {
    this.totalStars = data.totalStars
  }

  create() {
    const { width, height } = this.scale
    const rating = RATINGS.find((r) => this.totalStars >= r.minStars)

    this.add
      .text(width / 2, height / 2 - 120, `${this.totalStars} / ${MAX_STARS} stars`, {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#f3e2b3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 - 40, rating?.word ?? '', {
        fontFamily: FONT,
        fontSize: '36px',
        color: '#c9b98a',
      })
      .setOrigin(0.5)

    // Starting ShopScene again runs its create() with a fresh GameState
    new Button(this, width / 2, height / 2 + 60, 180, 50, 'Play again', () => {
      this.scene.start('ShopScene')
    })
  }
}
