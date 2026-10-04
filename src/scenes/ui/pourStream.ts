import Phaser from 'phaser'

const STREAM = { width: 6, ms: 400, extendShare: 0.3, retractShare: 0.3 } // shares of ms spent growing / shrinking
const DROPLETS = { count: 4, radius: 2.5, fallMs: 200 }

// Time after the start when the stream first touches the flask (used to time the slot pop)
export const STREAM_REACH_MS = STREAM.ms * STREAM.extendShare

// A thin stream of liquid falling from (x, top) to (x, bottom), with a few droplets along it.
// The stream grows from the bottle mouth downwards, stays for a moment, then its top end follows
// down so it looks like the pouring stops. Everything is added to `parent` and removed at the end.
export function playPourStream(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  top: number,
  bottom: number,
  color: number,
  onDone: () => void,
) {
  const stream = scene.add.graphics()
  parent.add(stream)

  const progress = { t: 0 }
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: STREAM.ms,
    onUpdate: () => {
      // head = lower end, tail = upper end; both move from 0 to 1 of the way down
      const head = Math.min(1, progress.t / STREAM.extendShare)
      const tail = Math.max(0, (progress.t - (1 - STREAM.retractShare)) / STREAM.retractShare)
      const y0 = top + (bottom - top) * tail
      const length = (bottom - top) * (head - tail)
      stream.clear()
      if (length < STREAM.width) return // too short to draw a rounded bar
      stream.fillStyle(color, 1)
      stream.fillRoundedRect(x - STREAM.width / 2, y0, STREAM.width, length, STREAM.width / 2)
    },
    onComplete: () => {
      stream.destroy()
      onDone()
    },
  })

  // Droplets start one after another and fall along the stream, a little off to each side
  for (let i = 0; i < DROPLETS.count; i++) {
    const drop = scene.add.circle(x + Phaser.Math.Between(-3, 3), top, DROPLETS.radius, color)
    parent.add(drop)
    scene.tweens.add({
      targets: drop,
      y: bottom,
      alpha: 0.4,
      delay: (i * STREAM.ms * 0.6) / DROPLETS.count,
      duration: DROPLETS.fallMs,
      onComplete: () => drop.destroy(),
    })
  }
}
