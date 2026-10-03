import Phaser from 'phaser'
import { Button } from './Button'

const BUTTON_Y = 640
const BUTTON_HEIGHT = 58
const ADJUST = { x: 530, width: 200 }
const DELIVER = { x: 750, width: 200 }
const NEXT = { x: 640, width: 260 }

type Callbacks = { onAdjust: () => void; onDeliver: () => void; onNext: () => void }

// Phase REACT: the customer has smelled the mix. Two modes share this view:
// "choices" (Adjust / Deliver) and, after delivering, "next" (Next customer).
export class ReactView {
  private root: Phaser.GameObjects.Container
  private adjustButton: Button
  private deliverButton: Button
  private nextButton: Button

  constructor(scene: Phaser.Scene, callbacks: Callbacks) {
    this.root = scene.add.container(0, 0)
    const h = BUTTON_HEIGHT
    this.adjustButton = new Button(scene, ADJUST.x, BUTTON_Y, ADJUST.width, h, 'Adjust', callbacks.onAdjust)
    this.deliverButton = new Button(scene, DELIVER.x, BUTTON_Y, DELIVER.width, h, 'Deliver', callbacks.onDeliver)
    this.nextButton = new Button(scene, NEXT.x, BUTTON_Y, NEXT.width, h, 'Next customer', callbacks.onNext)
    this.root.add([this.adjustButton, this.deliverButton, this.nextButton])
  }

  // Adjusting is unlimited (only smelling is limited), so both buttons are always there
  showChoices() {
    this.adjustButton.setVisible(true)
    this.deliverButton.setVisible(true)
    this.nextButton.setVisible(false)
  }

  showNext(isLastCustomer: boolean) {
    this.adjustButton.setVisible(false)
    this.deliverButton.setVisible(false)
    this.nextButton.setLabel(isLastCustomer ? 'See results' : 'Next customer')
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
