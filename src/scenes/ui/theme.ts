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
