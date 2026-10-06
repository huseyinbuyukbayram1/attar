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

// The look of small labels (the bottle names, the title screen's cat tip): an apothecary label drawn
// with shapes, too small for the plate's ornaments. Parchment (the plate's middle color), a thin
// copper border inside a fine dark ink outline.
export const LABEL_LOOK = { fill: 0xf2e8d8, copper: 0xb0643c, copperWidth: 1.5, ink: 0x3b2412, inkWidth: 1, radius: 5 }

// Draws such a label centered on (x, y)
export function addLabelPlate(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
  const { fill, copper, copperWidth, ink, inkWidth, radius } = LABEL_LOOK
  const g = scene.add.graphics()
  const left = x - width / 2
  const top = y - height / 2
  const inset = inkWidth + copperWidth / 2
  g.fillStyle(fill, 1)
  g.fillRoundedRect(left, top, width, height, radius)
  g.lineStyle(copperWidth, copper, 1) // the copper border, just inside the outline
  g.strokeRoundedRect(left + inset, top + inset, width - 2 * inset, height - 2 * inset, radius - 1)
  g.lineStyle(inkWidth, ink, 1) // the fine ink outline
  g.strokeRoundedRect(left, top, width, height, radius)
  return g
}
