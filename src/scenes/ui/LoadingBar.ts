import Phaser from 'phaser'
import { FONT, LOGO_FONT, LOGO_LETTER_SPACING } from './theme'

// The loading screen: "Loading…" and a bar with a copper fill on a dark track, with the percentage below it.
// Drawn with shapes and text only, because it must work before any picture has loaded.
const BACKGROUND = 0x1a1210 // the same dark brown as the page, so there is no flash
const BAR = { width: 420, height: 18, track: 0x2e211a, edge: 0x8a5a3c, fill: 0xc07a42 }
const TEXT_COLOR = '#f3e2b3'

export class LoadingBar {
  private fill: Phaser.GameObjects.Rectangle
  private percent: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale
    const y = height / 2
    scene.add.rectangle(width / 2, height / 2, width, height, BACKGROUND)
    scene.add
      .text(width / 2, y - 44, 'Loading…', { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontSize: '40px', color: TEXT_COLOR })
      .setOrigin(0.5)
    scene.add.rectangle(width / 2, y, BAR.width + 6, BAR.height + 6, BAR.track).setStrokeStyle(2, BAR.edge)
    this.fill = scene.add.rectangle(width / 2 - BAR.width / 2, y, 0, BAR.height, BAR.fill).setOrigin(0, 0.5)
    this.percent = scene.add.text(width / 2, y + 38, '0%', { fontFamily: FONT, fontSize: '22px', color: TEXT_COLOR }).setOrigin(0.5)
  }

  // value from 0 to 1
  set(value: number) {
    const clamped = Phaser.Math.Clamp(value, 0, 1)
    this.fill.width = BAR.width * clamped
    this.percent.setText(`${Math.round(clamped * 100)}%`)
  }
}
