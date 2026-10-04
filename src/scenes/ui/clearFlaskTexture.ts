import Phaser from 'phaser'

const SOURCE_KEY = 'mixing_flask'
export const CLEAR_FLASK_KEY = 'mixing_flask_clear'
const LIGHT = 200 // a pixel counts as "glass interior" when r, g and b are all above this
const GLASS_ALPHA = 40 // the interior's new alpha (0-255): almost see-through

// The flask picture has an opaque cream interior that hides the liquid and everything behind
// it. This makes a copy where those light pixels are nearly transparent; the dark/teal outline
// is kept. Call once after loading. Does nothing if the source texture is missing.
export function makeClearFlaskTexture(scene: Phaser.Scene) {
  if (!scene.textures.exists(SOURCE_KEY) || scene.textures.exists(CLEAR_FLASK_KEY)) return
  const source = scene.textures.get(SOURCE_KEY).getSourceImage() as HTMLImageElement
  const texture = scene.textures.createCanvas(CLEAR_FLASK_KEY, source.width, source.height)
  const context = texture?.getContext()
  if (!texture || !context) return

  context.drawImage(source, 0, 0)
  const image = context.getImageData(0, 0, source.width, source.height)
  const pixels = image.data // r, g, b, a for every pixel, one after the other
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0 && pixels[i] > LIGHT && pixels[i + 1] > LIGHT && pixels[i + 2] > LIGHT) {
      pixels[i + 3] = GLASS_ALPHA
    }
  }
  context.putImageData(image, 0, 0)
  texture.refresh()
}
