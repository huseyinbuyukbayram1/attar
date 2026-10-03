import Phaser from 'phaser'

// An image stretched over the whole canvas, or undefined if the texture is missing
export function addFullImage(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return undefined
  const { width, height } = scene.scale
  return scene.add.image(width / 2, height / 2, key).setDisplaySize(width, height)
}
