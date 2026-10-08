import Phaser from 'phaser'
import { FONT } from './theme'

// ---- The result line under a delivery's stars and reaction: tuning constants ----
const COIN_KEY = 'coin'
const LOOK = { color: '#9a5a32', iconHeightShare: 1, iconGap: 2, suffixGap: 5, groupGap: 18 } // copper, like the customer's name
const FALLBACK_COLOR = 0xe0b040 // a plain gold circle if coin.png is missing

export type ResultData = { groups: { amount: number; suffix?: string }[] } | { note: string }

// The small line that tells what a delivery paid: "+2 [coin]", "+2 [coin]   +1 [coin] tip", "+1 [coin] (haggled)", or an
// italic note ("No sale"). Each group is the number with a "+" glued to it, the coin picture right after it, and an optional
// italic word. The line is centred on its position. It is smaller than the dialogue and copper, so it reads as a result, not as speech.
export class ResultLine extends Phaser.GameObjects.Container {
  private fontSize: number
  readonly lineHeight: number
  private pieces: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene, x: number, y: number, fontSize: number) {
    super(scene, x, y)
    this.fontSize = fontSize
    this.lineHeight = Math.ceil(fontSize * 1.25)
    scene.add.existing(this)
  }

  // Shows new content (called again and again while the numbers count up, so it is kept light)
  setLine(data: ResultData) {
    this.pieces.forEach((piece) => piece.destroy())
    this.pieces = []
    const text = (str: string, italic: boolean) => {
      const made = this.scene.add
        .text(0, 0, str, { fontFamily: FONT, fontSize: `${this.fontSize}px`, fontStyle: italic ? 'italic' : 'normal', color: LOOK.color })
        .setOrigin(0, 0.5)
        .setResolution(2)
      this.pieces.push(made)
      return made
    }
    // Everything is laid out left to right from x 0, then the whole line is shifted to be centred
    const placed: { object: Phaser.GameObjects.GameObject & { x: number }; width: number }[] = []
    const put = (object: Phaser.GameObjects.GameObject & { x: number }, width: number, gapBefore: number) => {
      const x = placed.length === 0 ? 0 : placed[placed.length - 1].object.x + placed[placed.length - 1].width + gapBefore
      object.x = x
      placed.push({ object, width })
    }
    if ('note' in data) {
      const note = text(data.note, true)
      put(note, note.width, 0)
    } else {
      data.groups.forEach((group, i) => {
        const number = text(`+${group.amount}`, false)
        put(number, number.width, i === 0 ? 0 : LOOK.groupGap)
        const icon = this.makeIcon()
        put(icon.object, icon.width, LOOK.iconGap)
        if (group.suffix) {
          const suffix = text(group.suffix, true)
          put(suffix, suffix.width, LOOK.suffixGap)
        }
      })
    }
    const last = placed[placed.length - 1]
    const total = last.object.x + last.width
    placed.forEach((one) => (one.object.x -= total / 2))
    this.add(this.pieces)
  }

  private makeIcon(): { object: Phaser.GameObjects.Image | Phaser.GameObjects.Arc; width: number } {
    const height = this.fontSize * LOOK.iconHeightShare
    let object: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    let width: number
    if (this.scene.textures.exists(COIN_KEY)) {
      const image = this.scene.add.image(0, 0, COIN_KEY).setOrigin(0, 0.5)
      image.setScale(height / image.height)
      object = image
      width = image.displayWidth
    } else {
      object = this.scene.add.circle(0, 0, height / 2, FALLBACK_COLOR).setOrigin(0, 0.5)
      width = height
    }
    this.pieces.push(object)
    return { object, width }
  }
}
