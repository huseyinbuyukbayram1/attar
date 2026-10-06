import Phaser from 'phaser'

// A small round portrait of a customer, cut out of the big customer picture (customer_<id>.png).
// It is made once per customer as a texture with a circular shape: Phaser's geometry masks only work
// in the Canvas renderer, a canvas texture works everywhere.
const TEXTURE_PX = 176 // size of the made texture (a sharp copy for an ~80 px portrait)
const BACKGROUND = '#ecdfc4' // behind the person (the pictures have transparent backgrounds)
const DEFAULT_FOCUS = { x: 0.5, y: 0.3, zoom: 0.6 }

// Where the face is in each picture, and how much is shown: x and y are the center of the cut as a share
// of the picture's width and height, zoom is the width of the (square) cut as a share of the picture's width.
// Each row was checked on all ten faces: the whole head, from the top of the hair (or hat, turban, bun) to
// the chin, is inside the circle. Change a row if a face is off.
const FOCUS: Record<string, { x: number; y: number; zoom: number }> = {
  asphalt: { x: 0.54, y: 0.285, zoom: 0.6 },
  wardrobe: { x: 0.5, y: 0.33, zoom: 0.74 },
  spring: { x: 0.5, y: 0.235, zoom: 0.58 },
  kitchen: { x: 0.48, y: 0.285, zoom: 0.6 },
  harbour: { x: 0.5, y: 0.35, zoom: 0.64 },
  wedding: { x: 0.54, y: 0.25, zoom: 0.84 },
  market: { x: 0.5, y: 0.3, zoom: 0.58 },
  lobby: { x: 0.46, y: 0.26, zoom: 0.92 },
  school: { x: 0.42, y: 0.27, zoom: 0.78 },
  master: { x: 0.54, y: 0.3, zoom: 0.7 },
  practice: { x: 0.48, y: 0.27, zoom: 0.58 },
}

// The texture key of the round portrait of the customer `id`, made on first use; undefined if the
// customer's picture is not loaded
export function ensureCustomerPortrait(scene: Phaser.Scene, id: string): string | undefined {
  const source = `customer_${id}`
  const key = `portrait_${id}`
  if (scene.textures.exists(key)) return key
  if (!scene.textures.exists(source)) return undefined
  const picture = scene.textures.get(source).getSourceImage() as HTMLImageElement
  const texture = scene.textures.createCanvas(key, TEXTURE_PX, TEXTURE_PX)
  const context = texture?.getContext()
  if (!texture || !context) return undefined
  const focus = { ...DEFAULT_FOCUS, ...FOCUS[id] }
  const side = picture.width * focus.zoom // the square cut out of the picture
  context.beginPath()
  context.arc(TEXTURE_PX / 2, TEXTURE_PX / 2, TEXTURE_PX / 2, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX)
  context.drawImage(picture, focus.x * picture.width - side / 2, focus.y * picture.height - side / 2, side, side, 0, 0, TEXTURE_PX, TEXTURE_PX)
  texture.refresh()
  return key
}
