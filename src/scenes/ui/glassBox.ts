import Phaser from 'phaser'

const ALPHA_MIN = 40 // a pixel with more alpha than this counts as visible glass

// What part of a picture is really visible, in pixels of the picture itself:
// gapBelow = empty rows under the glass, width = width of the glass
export type GlassBox = { gapBelow: number; width: number }

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
  let box: GlassBox = { gapBelow: 0, width: source.width } // fallback: treat the whole picture as glass
  if (context) {
    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let lowestRow = -1
    let leftCol = canvas.width
    let rightCol = -1
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > ALPHA_MIN) {
          lowestRow = y
          leftCol = Math.min(leftCol, x)
          rightCol = Math.max(rightCol, x)
        }
      }
    }
    if (lowestRow >= 0) box = { gapBelow: canvas.height - 1 - lowestRow, width: rightCol - leftCol + 1 }
  }
  cache.set(key, box)
  return box
}
