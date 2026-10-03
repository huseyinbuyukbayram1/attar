import Phaser from 'phaser'

// A copy of a full-screen background cropped to the counter part (from topY down). It uses
// the same position and display size as the background, so the two line up exactly.
// Returns undefined if the texture is missing.
export function addCounterCrop(scene: Phaser.Scene, key: string, topY: number) {
  if (!scene.textures.exists(key)) return undefined
  const { width, height } = scene.scale
  const image = scene.add.image(width / 2, height / 2, key).setDisplaySize(width, height)
  // setCrop works in texture pixels, so convert the canvas Y into the texture's scale
  const cropY = (topY / height) * image.height
  image.setCrop(0, cropY, image.width, image.height - cropY)
  return image
}
