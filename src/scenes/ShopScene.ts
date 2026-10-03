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
const PORTRAIT = { x: 640, y: 640, height: 480 } // y = bottom edge; the counter overlay hides the part below COUNTER_TOP_Y
const COUNTER_TOP_Y = 563 // in canvas pixels: everything from here down is drawn in front of the customer
const CUSTOMER = { y: 280, width: 160, height: 230 } // placeholder box, used when there is no portrait
const ENTER_MS = 400
const LEAVE_MS = 250
const SLIDE_PX = 60
const SPEECH = { x: 640, y: 95, width: 640, height: 80 }
const REACTION_Y = 425
const BUTTON_Y = 500
const BUTTON_HEIGHT = 44
const CLEAR = { x: 640, width: 90 }
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

  // Everything that fades in for the evening: the background and its counter overlay
  private eveningLayers: Phaser.GameObjects.GameObject[] = []
  // Holds the portrait and the placeholder so one tween can move/fade the whole customer
  private customerArt!: Phaser.GameObjects.Container
  private portrait?: Phaser.GameObjects.Image
  private placeholder: Phaser.GameObjects.GameObject[] = []
  private nameText!: Phaser.GameObjects.Text
  private dayText!: Phaser.GameObjects.Text
  private speechText!: Phaser.GameObjects.Text
  private reactionText!: Phaser.GameObjects.Text
  private vial!: Vial
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

    // Draw order is creation order, back to front:
    // backgrounds, customer, counter overlays, then all UI
    this.addBackground('shop_morning', 0x5b3a29)
    // Evening sits on top, invisible; fading its alpha reveals it over the morning one
    this.eveningLayers = [this.addBackground('shop_evening', 0x2a2040).setAlpha(0)]

    this.addCustomerArt()

    // Copies of the backgrounds showing only the counter, drawn over the customer so
    // they appear to stand behind it. The evening copy fades with the evening background.
    this.addCounterOverlay('shop_morning')
    const eveningCounter = this.addCounterOverlay('shop_evening')
    if (eveningCounter) this.eveningLayers.push(eveningCounter.setAlpha(0))

    this.add.text(16, 12, 'Attar', {
      fontFamily: FONT,
      fontSize: '32px',
      color: '#f3e2b3',
    })
    this.dayText = this.add
      .text(this.scale.width - 16, 16, '', { fontFamily: FONT, fontSize: '20px', color: '#f3e2b3' })
      .setOrigin(1, 0)

    this.addSpeechAndReaction()
    this.vial = new Vial(this, (index) => this.emptySlot(index))
    addIngredientShelf(this, (id) => this.pickIngredient(id))
    this.addButtons()

    this.startCustomer()
  }

  // The state decides the time of day; this only plays the visual fade
  setTimeOfDay(time: TimeOfDay) {
    this.tweens.killTweensOf(this.eveningLayers) // a new fade replaces one still running
    this.tweens.add({
      targets: this.eveningLayers,
      alpha: time === 'evening' ? 1 : 0,
      duration: FADE_MS,
    })
  }

  // The customer container starts empty; startCustomer fills it with a portrait or placeholder
  private addCustomerArt() {
    this.customerArt = this.add.container(PORTRAIT.x, 0)
  }

  // Speech box, the customer's name beside it, and the line under the customer for reactions
  private addSpeechAndReaction() {
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
    // Always shown, so the name is visible whether or not a portrait exists
    this.nameText = this.add
      .text(SPEECH.x - SPEECH.width / 2, SPEECH.y - SPEECH.height / 2 - 4, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#f3e2b3',
        stroke: '#1a1210',
        strokeThickness: 4,
      })
      .setOrigin(0, 1)

    this.reactionText = this.add
      .text(SPEECH.x, REACTION_Y, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#f3e2b3',
        align: 'center',
        backgroundColor: '#00000088',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
  }

  // Shows this order's portrait if its texture loaded, otherwise the labelled rectangle.
  // Rebuilt for every customer: simpler than swapping textures and re-scaling.
  private showCustomerArt() {
    const { order } = this.state
    this.portrait?.destroy()
    this.portrait = undefined
    this.placeholder.forEach((object) => object.destroy())
    this.placeholder = []

    const key = `customer_${order.id}`
    if (this.textures.exists(key)) {
      // Origin at bottom-center so PORTRAIT.y is where the feet are; scale from the wanted height
      const portrait = this.add.image(0, PORTRAIT.y, key).setOrigin(0.5, 1)
      portrait.setScale(PORTRAIT.height / portrait.height)
      this.customerArt.add(portrait)
      this.portrait = portrait
      return
    }
    const box = this.add
      .rectangle(0, CUSTOMER.y, CUSTOMER.width, CUSTOMER.height, 0x3b2a22)
      .setStrokeStyle(2, 0xf3e2b3)
    const label = this.add
      .text(0, CUSTOMER.y, order.customerName, { fontFamily: FONT, fontSize: '22px', color: '#f3e2b3' })
      .setOrigin(0.5)
    this.customerArt.add([box, label])
    this.placeholder = [box, label]
  }

  private addButtons() {
    const h = BUTTON_HEIGHT
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
    this.nameText.setText(state.order.customerName)
    this.showCustomerArt()
    // Entrance: slide in from the side while fading in
    this.tweens.killTweensOf(this.customerArt)
    this.customerArt.setAlpha(0).setX(PORTRAIT.x + SLIDE_PX)
    this.tweens.add({
      targets: this.customerArt,
      alpha: 1,
      x: PORTRAIT.x,
      duration: ENTER_MS,
      ease: 'Sine.easeOut',
    })
    this.speechText.setText(state.order.orderText)
    this.reactionText.setText('')
    this.nextButton.setText(state.isLastOrder ? 'See results' : 'Next customer')
    this.refresh()
  }

  // One place that decides what is enabled/visible, called after every change
  private refresh() {
    const { state } = this
    this.vial.setSlots(state.slots)
    this.clearButton.setEnabled(!this.delivered && state.drops.length > 0)
    this.smellButton.setText(`Smell (${state.smellsUsed}/${MAX_SMELLS})`)
    this.smellButton.setEnabled(!this.delivered && state.canSmell())
    this.deliverButton.setVisible(!this.delivered)
    this.deliverButton.setEnabled(state.canDeliver())
    this.nextButton.setVisible(this.delivered)
  }

  private pickIngredient(id: string) {
    if (this.delivered) return
    if (this.state.addDrop(id)) this.refresh()
    else this.vial.shake() // all slots full: tiny shake instead of silently ignoring the click
  }

  private emptySlot(index: number) {
    if (this.delivered) return
    this.state.removeSlot(index)
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
    // Hide the button right away so a double click can't advance twice during the fade
    this.nextButton.setVisible(false)
    this.tweens.add({
      targets: this.customerArt,
      alpha: 0,
      duration: LEAVE_MS,
      onComplete: () => {
        if (this.state.isLastOrder) {
          this.scene.start('EndScene', { totalStars: this.state.totalStars })
          return
        }
        this.state.nextCustomer()
        this.startCustomer()
      },
    })
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

  // A copy of a background cropped to the counter part. It uses the same position and
  // display size as the full background, so the two line up exactly. Skipped if the texture is missing.
  private addCounterOverlay(key: string) {
    if (!this.textures.exists(key)) return undefined
    const { width, height } = this.scale
    const image = this.add.image(width / 2, height / 2, key).setDisplaySize(width, height)
    // setCrop works in texture pixels, so convert the canvas Y into the texture's scale
    const cropY = (COUNTER_TOP_Y / height) * image.height
    image.setCrop(0, cropY, image.width, image.height - cropY)
    return image
  }
}
