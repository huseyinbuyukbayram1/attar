import Phaser from 'phaser'

const ALPHA_MIN = 40 // a pixel with more alpha than this counts as visible glass

// What part of a picture is really visible, in pixels of the picture itself:
// gapBelow = empty rows under the glass, width = width of the glass, mouthX / mouthY = the top
// of the picture's visible part: its topmost row, and the horizontal center of the top few rows
export type GlassBox = { gapBelow: number; width: number; mouthX: number; mouthY: number }
const MOUTH_ROWS = 6 // how many rows from the top are averaged for the mouth's x

// Measured once per texture; the pixels never change
const cache = new Map<string, GlassBox>()

// The pictures have transparent padding. Placing the sprite by its bottom edge would put the
// padding on the counter and make the glass float, so this finds where the glass really ends.
export function measureGlass(scene: Phaser.Scene, key: string): GlassBox {
  const known = cache.get(key)
  if (known) return known

  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  let box: GlassBox = { gapBelow: 0, width: source.width, mouthX: source.width / 2, mouthY: 0 } // fallback: whole picture
  if (context) {
    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let lowestRow = -1
    let topRow = -1
    const rowCenters: number[] = [] // centers of the first MOUTH_ROWS visible rows
    let leftCol = canvas.width
    let rightCol = -1
    for (let y = 0; y < canvas.height; y++) {
      let rowLeft = canvas.width
      let rowRight = -1
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > ALPHA_MIN) {
          rowLeft = Math.min(rowLeft, x)
          rowRight = Math.max(rowRight, x)
        }
      }
      if (rowRight < 0) continue // empty row
      lowestRow = y
      if (topRow < 0) topRow = y
      leftCol = Math.min(leftCol, rowLeft)
      rightCol = Math.max(rightCol, rowRight)
      if (rowCenters.length < MOUTH_ROWS) rowCenters.push((rowLeft + rowRight) / 2)
    }
    if (lowestRow >= 0) {
      const mouthX = rowCenters.reduce((sum, c) => sum + c, 0) / rowCenters.length
      box = { gapBelow: canvas.height - 1 - lowestRow, width: rightCol - leftCol + 1, mouthX, mouthY: topRow }
    }
  }
  cache.set(key, box)
  return box
}
