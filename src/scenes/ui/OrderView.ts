import Phaser from 'phaser'
import { PlateButton } from './PlateButton'

// Bottom-right corner of the counter's front face (y 649..720, below the seam with the counter top):
// right-aligned with a 32 px margin, 24 px above the bottom edge of the screen
const BUTTON_SIZE = { width: 220, height: 44 }
const BUTTON = { x: 1280 - 32 - BUTTON_SIZE.width / 2, y: 720 - 24 - BUTTON_SIZE.height / 2, ...BUTTON_SIZE }

// Phase ORDER: the customer has said what they want; the only thing to do is start mixing
export class OrderView {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene, onMakePerfume: () => void) {
    this.scene = scene
    this.root = scene.add.container(0, 0)
    this.root.add(new PlateButton(scene, BUTTON.x, BUTTON.y, { label: 'Make perfume', width: BUTTON.width, height: BUTTON.height, onClick: onMakePerfume }))
  }

  setAlpha(alpha: number) {
    this.root.setAlpha(alpha)
  }

  // The button appears after the customer's words, so it fades in last
  fadeIn(ms: number, onDone: () => void) {
    this.root.setAlpha(0)
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: ms, onComplete: onDone })
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }
}
