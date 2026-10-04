// Sound: a map from game events to files in public/assets/audio/, and a small manager.
// The only Phaser use is the TYPE of the scene (erased at build time), so this file stays
// plain TypeScript like the rest of src/game/.
import type Phaser from 'phaser'
import type { TimeOfDay } from './gameState'

export type SoundEvent = 'ambienceMorning' | 'ambienceEvening' | 'bottle' | 'pour' | 'mix' | 'smell' | 'deliver' | 'click'

// Event -> file name inside public/assets/audio/. null = there is no matching file, so the
// event is silent. public/assets/audio/ was empty when this was written, so everything is null:
// drop files in there and write their names here (nothing else needs to change).
export const SOUND_FILES: Record<SoundEvent, string | null> = {
  ambienceMorning: null,
  ambienceEvening: null,
  bottle: null,
  pour: null,
  mix: null,
  smell: null,
  deliver: null,
  click: null,
}

const AUDIO_FOLDER = 'assets/audio/'
// Ambience is kept low so it never covers the effects
const VOLUME: Record<SoundEvent, number> = {
  ambienceMorning: 0.15,
  ambienceEvening: 0.15,
  bottle: 0.5,
  pour: 0.5,
  mix: 0.5,
  smell: 0.5,
  deliver: 0.6,
  click: 0.4,
}
const AMBIENCE_FADE_MS = 1500 // same as the morning/evening crossfade of the picture
const MUTE_KEY = 'keydown-M'

const EVENTS = Object.keys(SOUND_FILES) as SoundEvent[]
const keyOf = (event: SoundEvent) => `sound_${event}`

// Called from BootScene.preload: loads only the events that have a file
export function loadSounds(scene: Phaser.Scene) {
  for (const event of EVENTS) {
    const file = SOUND_FILES[event]
    if (file) scene.load.audio(keyOf(event), AUDIO_FOLDER + file)
  }
}

// Plays effects and the two looping ambiences. A file that is missing or failed to load is
// skipped quietly, so the game never crashes over sound.
export class SoundManager {
  private scene: Phaser.Scene
  private ambience: Partial<Record<'ambienceMorning' | 'ambienceEvening', Phaser.Sound.BaseSound>> = {}
  private time: TimeOfDay = 'morning'
  private destroyed = false
  private toggleMute = () => {
    this.scene.sound.mute = !this.scene.sound.mute
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    scene.input.keyboard?.on(MUTE_KEY, this.toggleMute)
  }

  // Browsers only allow sound after a click. Phaser reports when that has happened ('unlocked');
  // if it already has, the ambience starts straight away.
  startAmbience(time: TimeOfDay) {
    this.time = time
    const begin = () => {
      if (this.destroyed) return
      for (const event of ['ambienceMorning', 'ambienceEvening'] as const) {
        if (!this.scene.cache.audio.exists(keyOf(event))) continue
        const sound = this.scene.sound.add(keyOf(event), { loop: true, volume: 0 })
        sound.play()
        this.ambience[event] = sound
      }
      this.setTime(this.time, true)
    }
    if (this.scene.sound.locked) this.scene.sound.once('unlocked', begin)
    else begin()
  }

  // Crossfades the two ambiences (or jumps, while a card hides the change)
  setTime(time: TimeOfDay, instant = false) {
    this.time = time
    const levels = {
      ambienceMorning: time === 'morning' ? VOLUME.ambienceMorning : 0,
      ambienceEvening: time === 'evening' ? VOLUME.ambienceEvening : 0,
    }
    for (const event of ['ambienceMorning', 'ambienceEvening'] as const) {
      const sound = this.ambience[event] as (Phaser.Sound.BaseSound & { volume: number }) | undefined
      if (!sound) continue
      this.scene.tweens.killTweensOf(sound)
      if (instant) sound.volume = levels[event]
      else this.scene.tweens.add({ targets: sound, volume: levels[event], duration: AMBIENCE_FADE_MS })
    }
  }

  play(event: SoundEvent) {
    const key = keyOf(event)
    if (!this.scene.cache.audio.exists(key)) return
    this.scene.sound.play(key, { volume: VOLUME[event] })
  }

  // Called when the scene shuts down: stop the loops and the key listener
  destroy() {
    this.destroyed = true
    this.scene.input.keyboard?.off(MUTE_KEY, this.toggleMute)
    Object.values(this.ambience).forEach((sound) => sound?.destroy())
    this.ambience = {}
  }
}
