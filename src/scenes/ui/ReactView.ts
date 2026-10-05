import Phaser from 'phaser'
import { PlateButton } from './PlateButton'

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
  private adjustButton: PlateButton
  private deliverButton: PlateButton
  private nextButton: PlateButton

  constructor(scene: Phaser.Scene, callbacks: Callbacks) {
    this.root = scene.add.container(0, 0)
    const h = BUTTON_HEIGHT
    this.adjustButton = new PlateButton(scene, ADJUST.x, BUTTON_Y, { label: 'Adjust', width: ADJUST.width, height: h, onClick: callbacks.onAdjust })
    this.deliverButton = new PlateButton(scene, DELIVER.x, BUTTON_Y, { label: 'Deliver', width: DELIVER.width, height: h, onClick: callbacks.onDeliver })
    this.nextButton = new PlateButton(scene, NEXT.x, BUTTON_Y, { label: 'Next customer', width: NEXT.width, height: h, onClick: callbacks.onNext })
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
