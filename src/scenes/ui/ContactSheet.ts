// TEMP: remove before release. A dev-only contact sheet: all ten customers as miniatures of
// the real scene, so portraits can be compared at a glance (see ShopScene's dev keys).
import Phaser from 'phaser'
import { ORDERS } from '../../data/customers'
import { addCounterCrop } from './counterCrop'
import { TINTED_COPY } from './EveningOverlay'
import { portraitPlacement } from './portraitPlacement'
import { addPanel, FONT, TEXT_COLOR } from './theme'

const CELL = { width: 320, height: 180 } // 4 columns x 3 rows = 1280x540 at the top
const COLUMNS = 4
const SCALE = CELL.width / 1280 // each cell is the real scene at this scale (0.25)
// Canvas y (in 1280x720 space) of the eye line: 38 percent down the displayed asphalt
// portrait (feet at 640, height 440: 640 - 440 * 0.62). Every cell gets a line here.
const EYE_GUIDE_Y = 367
const EYE_GUIDE_COLOR = 0xff4040
const LEGEND = { y: 630, width: 420, height: 36, text: 'G close - E toggles evening' }
const DEPTH = 2000 // above everything, including the phase fade
const BACKGROUND_COLOR = 0x1a1210

type Options = {
  backgroundKey: string
  counterTopY: number // same value the real scene uses
  eveningCustomerTint: number
}

export class ContactSheet {
  isOpen = false
  private root: Phaser.GameObjects.Container
  private portraits: Phaser.GameObjects.Image[] = []
  private eveningOnly: Phaser.GameObjects.Image[] = [] // tinted copies, shown only in evening mode
  private eveningTint: number
  private evening = false

  constructor(scene: Phaser.Scene, options: Options) {
    this.eveningTint = options.eveningCustomerTint
    const { width, height } = scene.scale
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setVisible(false)

    // Full-canvas backdrop; interactive so clicks don't reach the game underneath
    this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, BACKGROUND_COLOR).setInteractive())

    ORDERS.forEach((order, i) => {
      const cellX = (i % COLUMNS) * CELL.width
      const cellY = Math.floor(i / COLUMNS) * CELL.height
      const area = { centerX: cellX + CELL.width / 2, centerY: cellY + CELL.height / 2, width: CELL.width, height: CELL.height }

      // Back to front, like the real scene: background, portrait, counter crop
      if (scene.textures.exists(options.backgroundKey)) {
        this.root.add(scene.add.image(area.centerX, area.centerY, options.backgroundKey).setDisplaySize(CELL.width, CELL.height))
        this.addEveningOnly(
          scene.add
            .image(area.centerX, area.centerY, options.backgroundKey)
            .setDisplaySize(CELL.width, CELL.height)
            .setTint(TINTED_COPY.tint)
            .setAlpha(TINTED_COPY.alpha),
        )
      }

      const key = `customer_${order.id}`
      if (scene.textures.exists(key)) {
        const place = portraitPlacement(order.id) // the same function the real scene uses
        const portrait = scene.add
          .image(cellX + place.x * SCALE, cellY + place.y * SCALE, key)
          .setOrigin(0.5, 1)
        portrait.setScale((place.height * SCALE) / portrait.height)
        this.root.add(portrait)
        this.portraits.push(portrait)
      }

      const counter = addCounterCrop(scene, options.backgroundKey, options.counterTopY, area)
      if (counter) this.root.add(counter)
      const eveningCounter = addCounterCrop(scene, options.backgroundKey, options.counterTopY, area)
      if (eveningCounter) this.addEveningOnly(eveningCounter.setTint(TINTED_COPY.tint).setAlpha(TINTED_COPY.alpha))

      // Thin guide at the same eye height in every cell, plus the cell border and label
      this.root.add(scene.add.rectangle(area.centerX, cellY + EYE_GUIDE_Y * SCALE, CELL.width, 1, EYE_GUIDE_COLOR))
      this.root.add(scene.add.rectangle(area.centerX, area.centerY, CELL.width, CELL.height).setStrokeStyle(1, 0xf6e7c1, 0.5))
      this.root.add(
        scene.add.text(cellX + 6, cellY + 6, `${order.id} - ${order.customerName}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: TEXT_COLOR,
          backgroundColor: '#f6e7c1',
          padding: { x: 4, y: 2 },
        }),
      )
    })

    const legendText = scene.add
      .text(width / 2, LEGEND.y, LEGEND.text, { fontFamily: FONT, fontSize: '20px', color: TEXT_COLOR })
      .setOrigin(0.5)
    this.root.add([addPanel(scene, width / 2, LEGEND.y, LEGEND.width, LEGEND.height, LEGEND.height / 2), legendText])
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.root.setVisible(this.isOpen)
  }

  // Evening mode: the warm tint on the backgrounds, counter crops and portraits.
  // The glows and the violet layer are left out; the tint is enough to compare portraits.
  toggleEvening() {
    if (!this.isOpen) return
    this.evening = !this.evening
    this.eveningOnly.forEach((image) => image.setVisible(this.evening))
    this.portraits.forEach((portrait) => (this.evening ? portrait.setTint(this.eveningTint) : portrait.clearTint()))
  }

  private addEveningOnly(image: Phaser.GameObjects.Image) {
    image.setVisible(false)
    this.root.add(image)
    this.eveningOnly.push(image)
  }
}
