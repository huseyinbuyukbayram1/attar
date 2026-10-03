import Phaser from 'phaser'
import { Button } from './Button'

const BUTTON = { x: 640, y: 640, width: 260, height: 58 }

// Phase ORDER: the customer has said what they want; the only thing to do is start mixing
export class OrderView {
  private root: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene, onMakePerfume: () => void) {
    this.root = scene.add.container(0, 0)
    this.root.add(new Button(scene, BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height, 'Make perfume', onMakePerfume))
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }
}
