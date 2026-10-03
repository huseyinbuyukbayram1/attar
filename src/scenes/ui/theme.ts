import Phaser from 'phaser'

// Shared look: warm cream panels with dark brown text, so text is readable on any background
export const FONT = 'Georgia, serif'
export const TEXT_COLOR = '#3b2a20'
export const CREAM = 0xf6e7c1
export const BORDER = 0x8a5a3c

// Draws a rounded panel centered on (x, y) into an existing Graphics (call clear() first
// to redraw). Used directly by things that resize, like the speech box.
export function drawPanel(
  panel: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 14,
  fill = CREAM,
) {
  panel.fillStyle(fill, 1)
  panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  panel.lineStyle(2, BORDER, 1)
  panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius)
}

// Draws a rounded cream panel centered on (x, y). Returns the Graphics so the caller can
// put it into a container.
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 14,
  fill = CREAM,
): Phaser.GameObjects.Graphics {
  const panel = scene.add.graphics()
  drawPanel(panel, x, y, width, height, radius, fill)
  return panel
}

// A cream pill with centered dark text, for small always-on labels. The pill has a fixed
// size so the text can change (e.g. "Day 2/5") without redrawing it.
export function addPillLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fontSize: number,
): Phaser.GameObjects.Text {
  addPanel(scene, x, y, width, height, height / 2)
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${fontSize}px`, color: TEXT_COLOR })
    .setOrigin(0.5)
}
