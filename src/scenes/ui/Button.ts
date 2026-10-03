import Phaser from 'phaser'

const FILL = 0x5b3a29
const STROKE = 0xf3e2b3
const DISABLED_ALPHA = 0.35

// A placeholder button: a rectangle with a label. One class so every button looks
// and behaves the same, and the scene only deals with setEnabled/setVisible.
export class Button {
  private box: Phaser.GameObjects.Rectangle
  private label: Phaser.GameObjects.Text
  private enabled = true

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void,
  ) {
    this.box = scene.add.rectangle(x, y, width, height, FILL).setStrokeStyle(2, STROKE)
    this.label = scene.add
      .text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f3e2b3' })
      .setOrigin(0.5)
    this.box.setInteractive({ useHandCursor: true })
    // Checked on click so a disabled button simply does nothing
    this.box.on('pointerdown', () => {
      if (this.enabled) onClick()
    })
  }

  setText(text: string) {
    this.label.setText(text)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    const alpha = enabled ? 1 : DISABLED_ALPHA
    this.box.setAlpha(alpha)
    this.label.setAlpha(alpha)
  }

  // Hidden objects don't receive clicks in Phaser, so this also switches input off
  setVisible(visible: boolean) {
    this.box.setVisible(visible)
    this.label.setVisible(visible)
  }
}
