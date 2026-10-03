import Phaser from 'phaser'

type Area = { centerX: number; centerY: number; width: number; height: number }

// A copy of a full-screen background cropped to the counter part (from topY down, topY in
// 1280x720 canvas pixels). By default it covers the whole canvas, the same position and
// display size as the background, so the two line up exactly. Pass an area to draw a
// scaled-down copy instead (the dev contact sheet does). Returns undefined if the texture is missing.
export function addCounterCrop(scene: Phaser.Scene, key: string, topY: number, area?: Area) {
  if (!scene.textures.exists(key)) return undefined
  const { width, height } = scene.scale
  const where = area ?? { centerX: width / 2, centerY: height / 2, width, height }
  const image = scene.add.image(where.centerX, where.centerY, key).setDisplaySize(where.width, where.height)
  // setCrop works in texture pixels, so convert the canvas Y into the texture's scale
  const cropY = (topY / height) * image.height
  image.setCrop(0, cropY, image.width, image.height - cropY)
  return image
}
