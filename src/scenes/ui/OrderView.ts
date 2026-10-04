import Phaser from 'phaser'
import { Button } from './Button'

const BUTTON = { x: 640, y: 640, width: 260, height: 58 }

// Phase ORDER: the customer has said what they want; the only thing to do is start mixing
export class OrderView {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene, onMakePerfume: () => void) {
    this.scene = scene
    this.root = scene.add.container(0, 0)
    this.root.add(new Button(scene, BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height, 'Make perfume', onMakePerfume))
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
