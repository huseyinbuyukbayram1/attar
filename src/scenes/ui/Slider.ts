import Phaser from 'phaser'

// Look of the slider (px and colors). The track is ink, the fill is copper, the knob is brass.
const TRACK = { height: 8, color: 0x3b2412, alpha: 0.45, fill: 0xb0643c, radius: 4 }
const KNOB = { radius: 11, color: 0xc9a24a, outline: 0x3b2412, outlineWidth: 2, shine: 0xf0d98a, shineRadius: 4 }
const HIT_HEIGHT = 32 // the clickable band around the track

export type SliderOptions = {
  width: number // length of the track
  value: number // 0..1
  onChange: (value: number) => void // while it is dragged or clicked
  onRelease?: (value: number) => void // when the mouse is let go
}

// A horizontal slider, drawn with shapes. Its origin is the left end of the track. Click anywhere on
// the track to jump there, or drag the knob. It is a Container, so it works inside scaled panels.
export class Slider extends Phaser.GameObjects.Container {
  private graphics: Phaser.GameObjects.Graphics
  private trackWidth: number
  private amount: number
  private dragging = false
  private onChange: (value: number) => void
  private onRelease?: (value: number) => void

  constructor(scene: Phaser.Scene, x: number, y: number, options: SliderOptions) {
    super(scene, x, y)
    scene.add.existing(this)
    this.trackWidth = options.width
    this.amount = Phaser.Math.Clamp(options.value, 0, 1)
    this.onChange = options.onChange
    this.onRelease = options.onRelease

    this.graphics = scene.add.graphics()
    const hit = scene.add
      .zone(options.width / 2, 0, options.width + KNOB.radius * 2, HIT_HEIGHT)
      .setInteractive({ useHandCursor: true })
    this.add([this.graphics, hit])
    this.draw()

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true
      this.followPointer(pointer)
    })
    // Moving and letting go are watched on the whole scene, so a drag can leave the slider
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (this.dragging) this.followPointer(pointer)
    }
    const onUp = () => {
      if (!this.dragging) return
      this.dragging = false
      this.onRelease?.(this.amount)
    }
    scene.input.on('pointermove', onMove)
    scene.input.on('pointerup', onUp)
    scene.input.on('pointerupoutside', onUp)
    this.once('destroy', () => {
      scene.input.off('pointermove', onMove)
      scene.input.off('pointerup', onUp)
      scene.input.off('pointerupoutside', onUp)
    })
  }

  get value(): number {
    return this.amount
  }

  // Sets the value from outside (no callbacks)
  setValue(value: number) {
    this.amount = Phaser.Math.Clamp(value, 0, 1)
    this.draw()
  }

  // The pointer's place on the track; getLocalPoint takes the scale of the parents into account
  private followPointer(pointer: Phaser.Input.Pointer) {
    const local = this.getLocalPoint(pointer.x, pointer.y)
    this.amount = Phaser.Math.Clamp(local.x / this.trackWidth, 0, 1)
    this.draw()
    this.onChange(this.amount)
  }

  private draw() {
    const g = this.graphics
    const filled = this.trackWidth * this.amount
    g.clear()
    g.fillStyle(TRACK.color, TRACK.alpha)
    g.fillRoundedRect(0, -TRACK.height / 2, this.trackWidth, TRACK.height, TRACK.radius)
    if (filled > 0) {
      g.fillStyle(TRACK.fill, 1)
      g.fillRoundedRect(0, -TRACK.height / 2, filled, TRACK.height, TRACK.radius)
    }
    g.fillStyle(KNOB.color, 1)
    g.fillCircle(filled, 0, KNOB.radius)
    g.lineStyle(KNOB.outlineWidth, KNOB.outline, 1)
    g.strokeCircle(filled, 0, KNOB.radius)
    g.fillStyle(KNOB.shine, 0.8) // a small highlight, so it looks like brass
    g.fillCircle(filled - 3, -3, KNOB.shineRadius)
  }
}
