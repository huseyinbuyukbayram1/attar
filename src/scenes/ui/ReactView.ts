import Phaser from 'phaser'
import { PlateButton } from './PlateButton'

// Bottom-right corner of the counter's front face (it is y 649..720, below the seam with the counter top):
// right-aligned with a 32 px margin and 24 px above the bottom edge of the screen. "Deliver" is the
// main button, "Adjust" is directly to its left, bottoms on the same line.
// The dropper-bottle tray on the right is above the seam, so it stays clear.
const RIGHT_EDGE = 1280 - 32
const BOTTOM_EDGE = 720 - 24
const GAP = 14
// Adjust and Deliver are the same size; Deliver is the main button, so its plate is golden and its label bold
const BUTTON = { width: 180, height: 44, fontSize: 22 }
const MAIN = { accent: 0xffe2a8, boldLabel: true } // the main button's look: a warm golden plate
const NEXT = { width: 220, height: 44, fontSize: 22 } // "Next customer" takes the place of "Deliver"
const centerX = (width: number, rightEdge: number) => rightEdge - width / 2
const centerY = (height: number) => BOTTOM_EDGE - height / 2

type Callbacks = { onAdjust: () => void; onDeliver: () => void; onNext: () => void }

// Phase REACT: the customer has smelled the mix. Two modes share this view:
// "choices" (Adjust / Deliver) and, after delivering, "next" (Next customer).
export class ReactView {
  private root: Phaser.GameObjects.Container
  private adjustButton: PlateButton
  private deliverButton: PlateButton
  private nextButton: PlateButton

  constructor(scene: Phaser.Scene, callbacks: Callbacks) {
    this.root = scene.add.container(0, 0)
    this.deliverButton = new PlateButton(scene, centerX(BUTTON.width, RIGHT_EDGE), centerY(BUTTON.height), { label: 'Deliver', ...BUTTON, ...MAIN, onClick: callbacks.onDeliver })
    this.adjustButton = new PlateButton(scene, centerX(BUTTON.width, RIGHT_EDGE - BUTTON.width - GAP), centerY(BUTTON.height), { label: 'Adjust', ...BUTTON, onClick: callbacks.onAdjust })
    this.nextButton = new PlateButton(scene, centerX(NEXT.width, RIGHT_EDGE), centerY(NEXT.height), { label: 'Next customer', ...NEXT, ...MAIN, onClick: callbacks.onNext })
    this.root.add([this.adjustButton, this.deliverButton, this.nextButton])
  }

  adjustBounds(): Phaser.Geom.Rectangle {
    return this.adjustButton.bounds()
  }

  deliverBounds(): Phaser.Geom.Rectangle {
    return this.deliverButton.bounds()
  }

  // Adjusting is unlimited (only smelling is limited), so both buttons are always there
  showChoices() {
    this.adjustButton.setVisible(true)
    this.deliverButton.setVisible(true)
    this.nextButton.setVisible(false)
  }

  // `label` is what the button says; the practice customer's "Open the shop" is one of them
  showNext(label: string) {
    this.adjustButton.setVisible(false)
    this.deliverButton.setVisible(false)
    this.nextButton.setLabel(label)
    this.nextButton.setVisible(true)
  }

  hideButtons() {
    this.adjustButton.setVisible(false)
    this.deliverButton.setVisible(false)
    this.nextButton.setVisible(false)
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }
}
