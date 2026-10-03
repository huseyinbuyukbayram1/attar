import Phaser from 'phaser'
import { CUSTOMERS_PER_DAY, GameState, MAX_SMELLS, TOTAL_DAYS } from '../game/gameState'
import type { TimeOfDay } from '../game/gameState'
import { hintFor, mixScent, scoreMix } from '../game/scoring'
import type { Stars } from '../game/scoring'
import { Button } from './ui/Button'
import { addIngredientShelf } from './ui/IngredientShelf'
import { Vial } from './ui/Vial'

const FADE_MS = 1500
const FONT = 'Georgia, serif'

// Layout numbers for the 1280x720 screen (the ingredient row and vial have their own files)
const CUSTOMER = { x: 640, y: 280, width: 160, height: 230 }
const SPEECH = { x: 640, y: 95, width: 640, height: 80 }
const REACTION_Y = 425
const BUTTON_Y = 500
const BUTTON_HEIGHT = 44
const UNDO = { x: 620, width: 90 }
const CLEAR = { x: 720, width: 90 }
const SMELL = { x: 850, width: 120 }
const DELIVER = { x: 1010, width: 160 } // "Next customer" takes its place after delivering

// What the customer says after the final delivery, by star count
const REACTIONS: Record<Stars, string> = {
  3: 'It is exactly what I remembered. Thank you!',
  2: 'Very close. I like it.',
  1: 'Hmm. Not quite what I had in mind.',
  0: 'This is not what I asked for.',
}

// The main shop view and the coordinator of the game flow: it owns the GameState,
// draws it, and turns button clicks into state changes. The rules live in src/game/.
export class ShopScene extends Phaser.Scene {
  private state!: GameState
  // Phaser reuses this scene object on restart, so this is reset in create(), not here
  private delivered = false

  private evening!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private dayText!: Phaser.GameObjects.Text
  private customerLabel!: Phaser.GameObjects.Text
  private speechText!: Phaser.GameObjects.Text
  private reactionText!: Phaser.GameObjects.Text
  private vial!: Vial
  private undoButton!: Button
  private clearButton!: Button
  private smellButton!: Button
  private deliverButton!: Button
  private nextButton!: Button

  constructor() {
    super('ShopScene')
  }

  create() {
    this.state = new GameState()
    this.delivered = false

    this.addBackground('shop_morning', 0x5b3a29)
    // Evening sits on top, invisible; fading its alpha reveals it over the morning one
    this.evening = this.addBackground('shop_evening', 0x2a2040).setAlpha(0)

    this.add.text(16, 12, 'Attar', {
      fontFamily: FONT,
      fontSize: '32px',
      color: '#f3e2b3',
    })
    this.dayText = this.add
      .text(this.scale.width - 16, 16, '', { fontFamily: FONT, fontSize: '20px', color: '#f3e2b3' })
      .setOrigin(1, 0)

    this.addCustomer()
    this.vial = new Vial(this)
    addIngredientShelf(this, (id) => this.pickIngredient(id))
    this.addButtons()

    this.startCustomer()
  }

  // The state decides the time of day; this only plays the visual fade
  setTimeOfDay(time: TimeOfDay) {
    this.tweens.add({
      targets: this.evening,
      alpha: time === 'evening' ? 1 : 0,
      duration: FADE_MS,
    })
  }

  // Placeholder customer, speech box and the line under the customer for reactions
  private addCustomer() {
    this.add
      .rectangle(CUSTOMER.x, CUSTOMER.y, CUSTOMER.width, CUSTOMER.height, 0x3b2a22)
      .setStrokeStyle(2, 0xf3e2b3)
    this.customerLabel = this.add
      .text(CUSTOMER.x, CUSTOMER.y, '', { fontFamily: FONT, fontSize: '22px', color: '#f3e2b3' })
      .setOrigin(0.5)

    this.add
      .rectangle(SPEECH.x, SPEECH.y, SPEECH.width, SPEECH.height, 0xf3e2b3)
      .setStrokeStyle(2, 0x3b2a22)
    this.speechText = this.add
      .text(SPEECH.x, SPEECH.y, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#3b2a22',
        align: 'center',
        wordWrap: { width: SPEECH.width - 40 },
      })
      .setOrigin(0.5)

    this.reactionText = this.add
      .text(CUSTOMER.x, REACTION_Y, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#f3e2b3',
        align: 'center',
        backgroundColor: '#00000088',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
  }

  private addButtons() {
    const h = BUTTON_HEIGHT
    this.undoButton = new Button(this, UNDO.x, BUTTON_Y, UNDO.width, h, 'Undo', () => {
      this.state.undo()
      this.refresh()
    })
    this.clearButton = new Button(this, CLEAR.x, BUTTON_Y, CLEAR.width, h, 'Clear', () => {
      this.state.clear()
      this.refresh()
    })
    this.smellButton = new Button(this, SMELL.x, BUTTON_Y, SMELL.width, h, 'Smell', () => this.smell())
    this.deliverButton = new Button(this, DELIVER.x, BUTTON_Y, DELIVER.width, h, 'Deliver', () => this.deliver())
    this.nextButton = new Button(this, DELIVER.x, BUTTON_Y, DELIVER.width, h, 'Next customer', () => this.next())
  }

  // Sets up the screen for whoever is at the counter now
  private startCustomer() {
    const { state } = this
    this.delivered = false
    this.setTimeOfDay(state.timeOfDay)
    this.dayText.setText(`Day ${state.day}/${TOTAL_DAYS} - Customer ${state.customerOfDay}/${CUSTOMERS_PER_DAY}`)
    this.customerLabel.setText(state.order.customerName)
    this.speechText.setText(state.order.orderText)
    this.reactionText.setText('')
    this.nextButton.setText(state.isLastOrder ? 'See results' : 'Next customer')
    this.refresh()
  }

  // One place that decides what is enabled/visible, called after every change
  private refresh() {
    const { state } = this
    this.vial.setDrops(state.drops)
    this.undoButton.setEnabled(!this.delivered && state.drops.length > 0)
    this.clearButton.setEnabled(!this.delivered && state.drops.length > 0)
    this.smellButton.setText(`Smell (${state.smellsUsed}/${MAX_SMELLS})`)
    this.smellButton.setEnabled(!this.delivered && state.canSmell())
    this.deliverButton.setVisible(!this.delivered)
    this.deliverButton.setEnabled(state.canDeliver())
    this.nextButton.setVisible(this.delivered)
  }

  private pickIngredient(id: string) {
    if (this.delivered) return
    this.state.addDrop(id)
    this.refresh()
  }

  private smell() {
    const { state } = this
    state.useSmell()
    this.reactionText.setText(hintFor(mixScent(state.drops), state.order.target))
    this.refresh()
  }

  private deliver() {
    const { state } = this
    const score = scoreMix(state.drops, state.order)
    state.addStars(score.stars)
    this.delivered = true
    const stars = '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars)
    this.reactionText.setText(`${stars}\n${REACTIONS[score.stars]}`)
    this.refresh()
  }

  private next() {
    if (this.state.isLastOrder) {
      this.scene.start('EndScene', { totalStars: this.state.totalStars })
      return
    }
    this.state.nextCustomer()
    this.startCustomer()
  }

  // Image stretched to fill the canvas; if the texture failed to load, a colored rectangle instead
  private addBackground(key: string, fallbackColor: number) {
    const { width, height } = this.scale
    if (this.textures.exists(key)) {
      return this.add.image(width / 2, height / 2, key).setDisplaySize(width, height)
    }
    console.warn(`Texture "${key}" missing, using a colored rectangle`)
    return this.add.rectangle(width / 2, height / 2, width, height, fallbackColor)
  }
}
