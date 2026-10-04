import Phaser from 'phaser'

// Light that takes the SHAPE of an opening (a window, a door) instead of a round glow.
// Everything is made once in code from the background picture, so nothing is hand-drawn.

// A rectangle in 1280x720 canvas pixels
export type Rect = { x: number; y: number; width: number; height: number }

const LIGHTNESS_MIN = 0.72 // a pixel counts as "lit glass" when its lightness (max+min)/2 is above this
const BLUR_PX = 3 // softens the edge of the lit shape (in picture pixels)
const BLUR_PAD_PX = 6 // empty border around the texture, so the blur is not cut off

// How far each texture sticks out around its rectangle on screen (canvas pixels)
const screenPad = new Map<string, number>()

// Copies `rect` out of the background picture and keeps only its bright pixels, as white with
// alpha 1 (everything else alpha 0), then blurs the result a little. The dark frame and bars
// are not bright, so they stay empty. Does nothing if the texture exists or the picture is missing.
export function ensureShapedLight(scene: Phaser.Scene, sourceKey: string, outKey: string, rect: Rect) {
  if (scene.textures.exists(outKey) || !scene.textures.exists(sourceKey)) return
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement
  const k = source.width / scene.scale.width // picture pixels per canvas pixel
  const w = Math.round(rect.width * k)
  const h = Math.round(rect.height * k)

  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  const maskContext = mask.getContext('2d')
  if (!maskContext) return
  maskContext.drawImage(source, rect.x * k, rect.y * k, w, h, 0, 0, w, h)
  const image = maskContext.getImageData(0, 0, w, h)
  const pixels = image.data
  for (let i = 0; i < pixels.length; i += 4) {
    const lightness = (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) + Math.min(pixels[i], pixels[i + 1], pixels[i + 2])) / 510
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255
    pixels[i + 3] = lightness > LIGHTNESS_MIN ? 255 : 0
  }
  maskContext.putImageData(image, 0, 0)

  const texture = scene.textures.createCanvas(outKey, w + BLUR_PAD_PX * 2, h + BLUR_PAD_PX * 2)
  const context = texture?.getContext()
  if (!texture || !context) return
  if (typeof context.filter === 'string') {
    context.filter = `blur(${BLUR_PX}px)`
    context.drawImage(mask, BLUR_PAD_PX, BLUR_PAD_PX)
  } else {
    // No canvas filter (older Safari): a few offset copies at low alpha look like a small blur
    context.globalAlpha = 0.2
    for (const [dx, dy] of [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]]) context.drawImage(mask, BLUR_PAD_PX + dx, BLUR_PAD_PX + dy)
  }
  texture.refresh()
  screenPad.set(outKey, BLUR_PAD_PX / k)
}

// The shaped light as two ADD layers on top of `rect`: a sharp one and a bloom (the same texture
// scaled up around its center). Returns [] if the texture could not be made.
export function addShapedLight(
  scene: Phaser.Scene,
  outKey: string,
  rect: Rect,
  color: number,
  sharpAlpha: number,
  bloomScale: number,
  bloomAlpha: number,
): Phaser.GameObjects.Image[] {
  if (!scene.textures.exists(outKey)) return []
  const pad = screenPad.get(outKey) ?? 0
  const make = (scale: number, alpha: number) =>
    scene.add
      .image(rect.x + rect.width / 2, rect.y + rect.height / 2, outKey)
      .setDisplaySize((rect.width + pad * 2) * scale, (rect.height + pad * 2) * scale)
      .setTint(color)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
  return [make(bloomScale, bloomAlpha), make(1, sharpAlpha)] // bloom first, so the sharp layer is on top
}

export type Cut = { x: number; width: number; strength: number } // a darker vertical bar, canvas x

// A polygon (canvas pixels) filled white with a linear alpha gradient from `from` to `to`
// (each a point and an alpha), with optional darker vertical bars cut into it. Used for the
// light shaft of the window and the light spilling on the floor. Returns an ADD image.
export function addGradientShape(
  scene: Phaser.Scene,
  outKey: string,
  points: { x: number; y: number }[],
  from: { x: number; y: number; alpha: number },
  to: { x: number; y: number; alpha: number },
  color: number,
  cuts: Cut[] = [],
): Phaser.GameObjects.Image {
  const minX = Math.floor(Math.min(...points.map((p) => p.x)))
  const minY = Math.floor(Math.min(...points.map((p) => p.y)))
  const width = Math.ceil(Math.max(...points.map((p) => p.x))) - minX
  const height = Math.ceil(Math.max(...points.map((p) => p.y))) - minY

  if (!scene.textures.exists(outKey)) {
    const texture = scene.textures.createCanvas(outKey, width, height)
    const context = texture?.getContext()
    if (texture && context) {
      const gradient = context.createLinearGradient(from.x - minX, from.y - minY, to.x - minX, to.y - minY)
      gradient.addColorStop(0, `rgba(255,255,255,${from.alpha})`)
      gradient.addColorStop(1, `rgba(255,255,255,${to.alpha})`)
      context.beginPath()
      points.forEach((p, i) => (i === 0 ? context.moveTo(p.x - minX, p.y - minY) : context.lineTo(p.x - minX, p.y - minY)))
      context.closePath()
      context.fillStyle = gradient
      context.fill()
      // The bars: erase part of the alpha, so the light looks like it came through panes
      context.globalCompositeOperation = 'destination-out'
      for (const cut of cuts) {
        context.fillStyle = `rgba(0,0,0,${cut.strength})`
        context.fillRect(cut.x - minX, 0, cut.width, height)
      }
      texture.refresh()
    }
  }
  return scene.add.image(minX, minY, outKey).setOrigin(0, 0).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

// A blurred copy of a canvas. With ctx.filter it is a real blur. Without it (older Safari) the
// picture is drawn at 1/6 size and scaled back up with smoothing, twice, which also looks soft.
function blurred(source: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const out = newCanvas(source.width, source.height)
  const context = out.getContext('2d')
  if (!context) return source
  if (typeof context.filter === 'string') {
    context.filter = `blur(${px}px)`
    context.drawImage(source, 0, 0)
    return out
  }
  let current = source
  for (let pass = 0; pass < 2; pass++) {
    const small = newCanvas(source.width / 6, source.height / 6)
    small.getContext('2d')?.drawImage(current, 0, 0, small.width, small.height)
    const big = newCanvas(source.width, source.height)
    big.getContext('2d')?.drawImage(small, 0, 0, big.width, big.height)
    current = big
  }
  return current
}

// A band that darkens the shaft: a line from (x, y) in the direction (dx, dy), `width` px wide
export type Band = { x: number; y: number; dx: number; dy: number; width: number }

const SHAFT_PAD_PX = 60 // transparent border around the shaft, so the blur never meets the texture edge

// A soft light shaft. The polygon is filled with a gradient (alpha `alphaFrom` at `from`, 0 at
// `to`), blurred heavily so no straight edge stays, and then darkened by 30 percent (bandDarken)
// along blurred bands, which read as gentle shadows of the window bars. Returns an ADD image.
export function addSoftShaft(
  scene: Phaser.Scene,
  outKey: string,
  points: { x: number; y: number }[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  bands: Band[],
  look: { color: number; alpha: number; blurPx: number; bandBlurPx: number; bandDarken: number },
): Phaser.GameObjects.Image {
  const minX = Math.floor(Math.min(...points.map((p) => p.x))) - SHAFT_PAD_PX
  const minY = Math.floor(Math.min(...points.map((p) => p.y))) - SHAFT_PAD_PX
  const width = Math.ceil(Math.max(...points.map((p) => p.x))) + SHAFT_PAD_PX - minX
  const height = Math.ceil(Math.max(...points.map((p) => p.y))) + SHAFT_PAD_PX - minY

  if (!scene.textures.exists(outKey)) {
    const shape = newCanvas(width, height)
    const shapeContext = shape.getContext('2d')
    const texture = scene.textures.createCanvas(outKey, width, height)
    const context = texture?.getContext()
    if (shapeContext && texture && context) {
      const gradient = shapeContext.createLinearGradient(from.x - minX, from.y - minY, to.x - minX, to.y - minY)
      gradient.addColorStop(0, 'rgba(255,255,255,1)') // the image alpha sets the final strength
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      shapeContext.beginPath()
      points.forEach((p, i) => (i === 0 ? shapeContext.moveTo(p.x - minX, p.y - minY) : shapeContext.lineTo(p.x - minX, p.y - minY)))
      shapeContext.closePath()
      shapeContext.fillStyle = gradient
      shapeContext.fill()
      const soft = blurred(shape, look.blurPx)

      // The bands, blurred too, are taken off the shaft's alpha (destination-out)
      const bandCanvas = newCanvas(width, height)
      const bandContext = bandCanvas.getContext('2d')
      if (bandContext) {
        bandContext.strokeStyle = `rgba(0,0,0,${look.bandDarken})`
        for (const band of bands) {
          bandContext.lineWidth = band.width
          bandContext.beginPath()
          bandContext.moveTo(band.x - minX, band.y - minY)
          bandContext.lineTo(band.x - minX + band.dx * 1000, band.y - minY + band.dy * 1000)
          bandContext.stroke()
        }
        const softContext = soft.getContext('2d')
        if (softContext) {
          softContext.globalCompositeOperation = 'destination-out'
          softContext.drawImage(blurred(bandCanvas, look.bandBlurPx), 0, 0)
        }
      }
      context.drawImage(soft, 0, 0)
      texture.refresh()
    }
  }
  return scene.add
    .image(minX, minY, outKey)
    .setOrigin(0, 0)
    .setTint(look.color)
    .setAlpha(look.alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
}

const PATCH_PAD_PX = 20

// The lit window panes thrown onto the counter: a stretched, skewed copy of the shaped light
// texture `sourceKey` (made with ensureShapedLight), blurred and fading towards the front (the
// bottom). It is `size` big, centered on `center`; `shearPx` is how far the bottom is pushed to
// the right relative to the top. Returns an ADD image, or undefined if the source is missing.
export function addProjectedPatch(
  scene: Phaser.Scene,
  outKey: string,
  sourceKey: string,
  center: { x: number; y: number },
  size: { width: number; height: number },
  shearPx: number,
  look: { color: number; alpha: number; blurPx: number },
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(sourceKey)) return undefined
  if (!scene.textures.exists(outKey)) {
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement
    const width = size.width + PATCH_PAD_PX * 2
    const height = size.height + PATCH_PAD_PX * 2
    const shape = newCanvas(width, height)
    const shapeContext = shape.getContext('2d')
    const texture = scene.textures.createCanvas(outKey, width, height)
    const context = texture?.getContext()
    if (!shapeContext || !texture || !context) return undefined
    // x' = sx * x + shear * y, y' = sy * y: the tall panes become a wide, low, leaning patch
    const sx = (size.width - shearPx) / source.width
    const sy = size.height / source.height
    shapeContext.setTransform(sx, 0, shearPx / source.height, sy, PATCH_PAD_PX, PATCH_PAD_PX)
    shapeContext.drawImage(source, 0, 0)
    const soft = blurred(shape, look.blurPx)
    const softContext = soft.getContext('2d')
    if (softContext) {
      // Fade towards the front: opaque at the top of the patch, transparent at its bottom
      const fade = softContext.createLinearGradient(0, PATCH_PAD_PX, 0, PATCH_PAD_PX + size.height)
      fade.addColorStop(0, 'rgba(0,0,0,1)')
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      softContext.globalCompositeOperation = 'destination-in'
      softContext.fillStyle = fade
      softContext.fillRect(0, 0, width, height)
    }
    context.drawImage(soft, 0, 0)
    texture.refresh()
  }
  return scene.add
    .image(center.x, center.y, outKey)
    .setTint(look.color)
    .setAlpha(look.alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
}
