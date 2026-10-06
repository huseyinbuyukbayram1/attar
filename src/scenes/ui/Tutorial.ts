import Phaser from 'phaser'
import { markTutorialDone, markTutorialStarted } from '../../game/tutorial'
import { PlateButton, PlatePanel } from './PlateButton'
import { FONT, TEXT_COLOR } from './theme'

// The interactive tutorial: a practice customer (Sabiha) before Day 1. It only OBSERVES what the player does
// (the scene tells it with notify) and blocks clicks on everything but the highlighted object; it changes
// no game state. The steps are data: STEPS below.

export type TutorialPhase = 'order' | 'mix' | 'react'
export type TutorialEvent =
  | { type: 'makePerfume' }
  | { type: 'notebook'; open: boolean }
  | { type: 'drops'; ids: string[] } // a pour has ended: the flask now holds these drops
  | { type: 'smell' }
  | { type: 'adjust' }
  | { type: 'deliver' }

// Where the things to highlight are on the screen (rectangles in canvas px); the scene knows
export type TutorialTargets = {
  speechBubble: () => Phaser.Geom.Rectangle
  makePerfume: () => Phaser.Geom.Rectangle
  notebook: () => Phaser.Geom.Rectangle
  bottle: (id: string) => Phaser.Geom.Rectangle // one ingredient's bottle
  smellButton: () => Phaser.Geom.Rectangle
  adjustButton: () => Phaser.Geom.Rectangle
  deliverButton: () => Phaser.Geom.Rectangle
}

type TargetName = Exclude<keyof TutorialTargets, 'bottle'>
type Target = { name: TargetName; click?: boolean } | { name: 'bottle'; id: string; click?: boolean }

type Step = {
  phase: TutorialPhase
  text: string
  // What is lit. `click`: the mouse may click it (everything else is blocked); the rest is only to look at.
  targets: Target[]
  bubble?: Side // where the tip would like to be, next to the first target (it moves if that place is taken)
  next?: boolean // a "Next" button ends this step (otherwise the player's action does)
  until?: (event: TutorialEvent) => boolean // the action that ends this step
  notebook?: boolean // the step in which the notebook may be opened (the tutorial waits while it is open)
}
type Side = 'above' | 'below' | 'left' | 'right'

// Sabiha wants Neroli x2 + Vanilla x2. With only one Vanilla the hint says "a touch more sweet" (see PRACTICE_ORDER).
const count = (ids: string[], id: string) => ids.filter((one) => one === id).length

const STEPS: Step[] = [
  {
    phase: 'order',
    text: "Customers don't name a perfume. They describe a feeling. Click Make perfume.",
    targets: [{ name: 'speechBubble' }, { name: 'makePerfume', click: true }],
    bubble: 'above',
    until: (e) => e.type === 'makePerfume',
  },
  {
    phase: 'mix',
    text: "Your grandfather's notebook shows how each ingredient smells. Open it (Tab or click).",
    targets: [{ name: 'notebook', click: true }],
    notebook: true,
    until: (e) => e.type === 'notebook' && !e.open, // when it has been closed again
  },
  {
    phase: 'mix',
    text: 'Sabiha likes it soft. Add two drops of Neroli.',
    targets: [{ name: 'bottle', id: 'neroli', click: true }],
    until: (e) => e.type === 'drops' && count(e.ids, 'neroli') >= 2,
  },
  {
    phase: 'mix',
    text: 'And one drop of Vanilla.',
    targets: [{ name: 'bottle', id: 'vanilla', click: true }],
    until: (e) => e.type === 'drops' && count(e.ids, 'vanilla') >= 1,
  },
  {
    phase: 'mix',
    text: 'Now let her smell it.',
    targets: [{ name: 'smellButton', click: true }],
    until: (e) => e.type === 'smell',
  },
  {
    phase: 'react',
    text: 'Read her hint carefully: it tells you what is missing.',
    targets: [{ name: 'speechBubble' }],
    bubble: 'right',
    next: true,
  },
  {
    phase: 'react',
    text: "Let's fix it. Click Adjust.",
    targets: [{ name: 'adjustButton', click: true }],
    until: (e) => e.type === 'adjust',
  },
  {
    phase: 'mix',
    text: "She wants it sweeter. Vanilla is sweet. Add one more drop.\n\nA drop can't be taken back. If you go wrong, you can always empty the flask.",
    targets: [{ name: 'bottle', id: 'vanilla', click: true }],
    until: (e) => e.type === 'drops' && count(e.ids, 'vanilla') >= 2,
  },
  {
    phase: 'mix',
    text: 'Let her smell it again.',
    targets: [{ name: 'smellButton', click: true }],
    until: (e) => e.type === 'smell',
  },
  {
    phase: 'react',
    text: "Three stars! On a real customer, that's the full price plus a tip. Deliver it.",
    targets: [{ name: 'deliverButton', click: true }],
    until: (e) => e.type === 'deliver',
  },
]

const FINAL_TOAST = 'Esc pauses the game. Good luck!'

// ---- Look: tuning constants (canvas px) ----
const DEPTH = 850 // above the shop, below the notebook panel (900), the phase fade (1000) and the pause menu
const DIM = { alpha: 0.6 }
const HOLE = { padding: 10, radius: 18, softness: 16 } // the lit area is the object plus `padding`, with a soft edge
const OUTLINE = { color: 0xb0643c, width: 3, alphaFrom: 0.45, alphaTo: 1, pulseMs: 700 }
const BUBBLE = { width: 370, padding: { x: 36, y: 28 }, fontSize: 19, gap: 16, margin: 20, top: 74, // gap: free space around the lit areas; top: the tip stays below the money display
  nextWidth: 110, nextHeight: 38, nextGap: 12, nextFontSize: 20 }
const SKIP = { x: 20, y: 18, fontSize: 16, color: '#f3e6c8', hoverColor: '#ffffff' }
const TOAST = { y: 640, width: 400, height: 46, fontSize: 18, showMs: 3000, fadeMs: 600 }
const DIM_KEY = 'tutorial_dim'

export class Tutorial {
  private scene: Phaser.Scene
  private targets: TutorialTargets
  private index = 0
  private phase: TutorialPhase | undefined // the phase the shop is in now, while it is idle
  private root: Phaser.GameObjects.Container
  private finished = false
  private waitingForNotebook = false // the notebook is open: the tutorial is out of the way
  private onSkip: () => void

  // onSkip: what the scene does when the player skips (it goes on to Day 1)
  constructor(scene: Phaser.Scene, targets: TutorialTargets, onSkip: () => void) {
    this.scene = scene
    this.targets = targets
    this.onSkip = onSkip
    markTutorialStarted()
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setVisible(false)
    scene.events.once('shutdown', () => this.root.destroy())
  }

  // True unless this is the step that asks the player to open the notebook
  blocksNotebook(): boolean {
    return !this.finished && !STEPS[this.index]?.notebook
  }

  // The shop is idle in `phase` (a fade or an entrance has ended): show the step if it belongs to this phase
  sync(phase: TutorialPhase) {
    if (this.finished) return
    this.phase = phase
    this.refresh()
  }

  // The scene is changing (a fade, a sequence): the tutorial gets out of the way
  suspend() {
    this.phase = undefined
    this.hide()
  }

  // The player did something
  notify(event: TutorialEvent) {
    if (this.finished) return
    const step = STEPS[this.index]
    if (step.notebook && event.type === 'notebook') {
      if (event.open) {
        this.waitingForNotebook = true
        this.hide() // the notebook panel is open: the tutorial waits without being seen
        return
      }
      this.waitingForNotebook = false
    }
    if (step.until?.(event)) this.advance()
  }

  // The player gave up: never show it again
  skip() {
    if (this.finished) return
    this.finish()
    this.onSkip()
  }

  private advance() {
    this.index++
    if (this.index >= STEPS.length) {
      this.finish()
      return
    }
    this.refresh()
  }

  private refresh() {
    const step = STEPS[this.index]
    if (this.finished || this.waitingForNotebook || this.phase !== step.phase) {
      this.hide()
      return
    }
    this.render(step)
  }

  private hide() {
    this.root.setVisible(false)
    this.root.removeAll(true)
  }

  // Draws the step: the dark screen with the lit holes, the pulsing outlines, the blockers, the tip and Skip
  private render(step: Step) {
    const { scene } = this
    const { width, height } = scene.scale
    this.root.removeAll(true)
    const holes = step.targets.map((target) => {
      const r = target.name === 'bottle' ? this.targets.bottle(target.id) : this.targets[target.name]()
      return { rect: new Phaser.Geom.Rectangle(r.x - HOLE.padding, r.y - HOLE.padding, r.width + HOLE.padding * 2, r.height + HOLE.padding * 2), click: !!target.click }
    })

    // The dark screen, with a soft hole for each target
    this.paintDim(holes.map((hole) => hole.rect))
    this.root.add(scene.add.image(width / 2, height / 2, DIM_KEY))

    // A gentle pulse of a copper outline around each hole
    const outline = scene.add.graphics()
    outline.lineStyle(OUTLINE.width, OUTLINE.color, 1)
    holes.forEach(({ rect }) => outline.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, HOLE.radius))
    outline.setAlpha(OUTLINE.alphaFrom)
    scene.tweens.add({ targets: outline, alpha: OUTLINE.alphaTo, duration: OUTLINE.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.root.add(outline)

    // Blockers: zones over the whole screen except the holes that may be clicked, so only those objects react
    this.addBlockers(holes.filter((hole) => hole.click).map((hole) => hole.rect))

    this.addBubble(step, holes.map((hole) => hole.rect))
    this.addSkip()
    this.root.setVisible(true)
  }

  // The dark layer is a canvas: black, with soft rounded holes cut out of it (a geometry mask would not work in WebGL)
  private paintDim(holes: Phaser.Geom.Rectangle[]) {
    const { width, height } = this.scene.scale
    const texture = this.scene.textures.exists(DIM_KEY) ? this.scene.textures.get(DIM_KEY) : this.scene.textures.createCanvas(DIM_KEY, width, height)
    const context = (texture as Phaser.Textures.CanvasTexture).getContext()
    if (!context) return
    context.globalCompositeOperation = 'source-over'
    context.shadowBlur = 0
    context.clearRect(0, 0, width, height)
    context.fillStyle = `rgba(0,0,0,${DIM.alpha})`
    context.fillRect(0, 0, width, height)
    context.globalCompositeOperation = 'destination-out' // what is drawn now erases the dark: the hole
    context.shadowColor = 'black'
    context.shadowBlur = HOLE.softness // the shadow erases too, which softens the edge of the hole
    context.fillStyle = 'black'
    for (const r of holes) {
      context.beginPath()
      context.roundRect(r.x, r.y, r.width, r.height, HOLE.radius)
      context.fill()
    }
    context.shadowBlur = 0
    context.globalCompositeOperation = 'source-over'
    ;(texture as Phaser.Textures.CanvasTexture).refresh()
  }

  // The screen is cut into cells by the clickable holes' edges; every cell that is not a hole gets a zone that swallows clicks
  private addBlockers(clickable: Phaser.Geom.Rectangle[]) {
    const { width, height } = this.scene.scale
    const xs = [...new Set([0, width, ...clickable.flatMap((r) => [r.x, r.right])].map((v) => Phaser.Math.Clamp(v, 0, width)))].sort((a, b) => a - b)
    const ys = [...new Set([0, height, ...clickable.flatMap((r) => [r.y, r.bottom])].map((v) => Phaser.Math.Clamp(v, 0, height)))].sort((a, b) => a - b)
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const cell = new Phaser.Geom.Rectangle(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j])
        if (cell.width <= 0 || cell.height <= 0) continue
        if (clickable.some((r) => Phaser.Geom.Rectangle.Contains(r, cell.centerX, cell.centerY))) continue
        this.root.add(this.scene.add.zone(cell.centerX, cell.centerY, cell.width, cell.height).setInteractive())
      }
    }
  }

  // The tip: a plate with the text, next to the first lit area; a "Next" button if no action ends the step
  private addBubble(step: Step, holes: Phaser.Geom.Rectangle[]) {
    const { scene } = this
    const text = scene.add
      .text(0, 0, step.text, { fontFamily: FONT, fontSize: `${BUBBLE.fontSize}px`, color: TEXT_COLOR, wordWrap: { width: BUBBLE.width - BUBBLE.padding.x * 2 }, lineSpacing: 4 })
      .setOrigin(0, 0)
      .setResolution(2)
    const buttonSpace = step.next ? BUBBLE.nextHeight + BUBBLE.nextGap : 0
    const height = text.height + BUBBLE.padding.y * 2 + buttonSpace
    const { x, y } = this.placeBubble(step, holes, height)

    const panel = new PlatePanel(scene, x + BUBBLE.width / 2, y + height / 2, BUBBLE.width, height)
    const swallow = scene.add.zone(x + BUBBLE.width / 2, y + height / 2, BUBBLE.width, height).setInteractive() // a click on the tip does nothing
    text.setPosition(x + BUBBLE.padding.x, y + BUBBLE.padding.y)
    this.root.add([panel, swallow, text])
    if (step.next) {
      const next = new PlateButton(scene, x + BUBBLE.width - BUBBLE.padding.x - BUBBLE.nextWidth / 2, y + height - BUBBLE.padding.y / 2 - BUBBLE.nextHeight / 2 - 4, {
        label: 'Next',
        width: BUBBLE.nextWidth,
        height: BUBBLE.nextHeight,
        fontSize: BUBBLE.nextFontSize,
        onClick: () => this.advance(),
      })
      this.root.add(next)
    }
  }

  // Where the tip goes: the first side (the step's wish, then above, below, right, left) of the first lit area where
  // the whole tip is on the screen and touches no lit area and not the speech bubble. If every side is taken,
  // the free spot nearest to the lit area is searched on a grid.
  private placeBubble(step: Step, holes: Phaser.Geom.Rectangle[], height: number): { x: number; y: number } {
    const { width: screenWidth, height: screenHeight } = this.scene.scale
    const anchor = holes[0]
    const avoid = [...holes] // things the tip must not cover: all the lit areas...
    if (step.phase !== 'mix') avoid.push(this.targets.speechBubble()) // ...and the speech bubble, whenever it is on the screen
    const fits = (x: number, y: number) => {
      const tip = new Phaser.Geom.Rectangle(x, y, BUBBLE.width, height)
      const onScreen = x >= BUBBLE.margin && y >= BUBBLE.top && tip.right <= screenWidth - BUBBLE.margin && tip.bottom <= screenHeight - BUBBLE.margin
      const clear = avoid.every((r) => !Phaser.Geom.Intersects.RectangleToRectangle(tip, new Phaser.Geom.Rectangle(r.x - BUBBLE.gap + 1, r.y - BUBBLE.gap + 1, r.width + BUBBLE.gap * 2 - 2, r.height + BUBBLE.gap * 2 - 2)))
      return onScreen && clear
    }
    const spot = (side: Side) => {
      const centeredX = Phaser.Math.Clamp(anchor.centerX - BUBBLE.width / 2, BUBBLE.margin, screenWidth - BUBBLE.margin - BUBBLE.width)
      const centeredY = Phaser.Math.Clamp(anchor.centerY - height / 2, BUBBLE.top, screenHeight - BUBBLE.margin - height)
      if (side === 'above') return { x: centeredX, y: anchor.y - BUBBLE.gap - height }
      if (side === 'below') return { x: centeredX, y: anchor.bottom + BUBBLE.gap }
      if (side === 'right') return { x: anchor.right + BUBBLE.gap, y: centeredY }
      return { x: anchor.x - BUBBLE.gap - BUBBLE.width, y: centeredY }
    }
    const order: Side[] = [step.bubble ?? 'above', 'above', 'below', 'right', 'left']
    for (const side of order) {
      const place = spot(side)
      if (fits(place.x, place.y)) return place
    }
    // Last resort: the free spot closest to the lit area
    let best = { x: BUBBLE.margin, y: BUBBLE.top }
    let bestDistance = Infinity
    for (let y = BUBBLE.top; y + height <= screenHeight - BUBBLE.margin; y += 10) {
      for (let x = BUBBLE.margin; x + BUBBLE.width <= screenWidth - BUBBLE.margin; x += 10) {
        const distance = Phaser.Math.Distance.Between(x + BUBBLE.width / 2, y + height / 2, anchor.centerX, anchor.centerY)
        if (distance < bestDistance && fits(x, y)) {
          best = { x, y }
          bestDistance = distance
        }
      }
    }
    return best
  }

  // "Skip tutorial", small, in the corner, on every step
  private addSkip() {
    const skip = this.scene.add
      .text(SKIP.x, SKIP.y, 'Skip tutorial', { fontFamily: FONT, fontSize: `${SKIP.fontSize}px`, color: SKIP.color })
      .setOrigin(0, 0)
      .setShadow(1, 2, '#000000', 3, true, true)
      .setInteractive({ useHandCursor: true })
    skip.on('pointerover', () => skip.setColor(SKIP.hoverColor))
    skip.on('pointerout', () => skip.setColor(SKIP.color))
    skip.on('pointerdown', () => this.skip())
    this.root.add(skip)
  }

  // The end: the flag is saved. The toast with the last tip comes later (showToast), over the Day 1 card's end.
  private finish() {
    if (this.finished) return
    this.finished = true
    markTutorialDone()
    this.hide()
  }

  // The last word, a small toast that fades away
  showToast() {
    const { width } = this.scene.scale
    const panel = new PlatePanel(this.scene, 0, 0, TOAST.width, TOAST.height)
    const text = this.scene.add.text(0, 0, FINAL_TOAST, { fontFamily: FONT, fontSize: `${TOAST.fontSize}px`, color: TEXT_COLOR }).setOrigin(0.5).setResolution(2)
    const toast = this.scene.add.container(width / 2, TOAST.y, [panel, text]).setDepth(DEPTH + 1)
    this.scene.tweens.add({ targets: toast, alpha: 0, delay: TOAST.showMs, duration: TOAST.fadeMs, onComplete: () => toast.destroy() })
  }
}
