// Sound: a map from game events to files in public/assets/audio/, and a small manager.
// The only Phaser use is the TYPE of the scene (erased at build time), so this file stays
// plain TypeScript like the rest of src/game/.
import type Phaser from 'phaser'
import type { TimeOfDay } from './gameState'

export type SoundEvent = 'ambienceMorning' | 'ambienceEvening' | 'bottle' | 'pour' | 'mix' | 'smell' | 'deliver' | 'click' | 'signFall'

// Event -> file name inside public/assets/audio/. null = there is no matching file, so the
// event is silent. Matched by file name; to add a sound, drop the file in the folder and write
// its name here (nothing else needs to change).
export const SOUND_FILES: Record<SoundEvent, string | null> = {
  ambienceMorning: 'ambience_morning.mp3',
  ambienceEvening: 'ambience_evening.mp3',
  bottle: 'bottle.mp3',
  pour: 'pour.mp3',
  mix: 'mix.mp3',
  smell: 'smell.mp3',
  deliver: 'deliver.mp3',
  click: 'click.mp3',
  signFall: 'sign_fall.mp3', // title screen: the sign falls. Not there yet? The loader warns and the sound is skipped.
}

// Music: looped, one file per key. null = there is no file yet, so nothing is loaded or played.
// To add the title music, drop the file into public/assets/audio/ and write its name here.
export type MusicKey = 'music_title'
export const MUSIC_FILES: Record<MusicKey, string | null> = { music_title: null }
const MUSIC_VOLUME: Record<MusicKey, number> = { music_title: 0.25 }
const MUSIC_FADE_MS = 1500

const AUDIO_FOLDER = 'assets/audio/'
// Ambience is kept low so it never covers the effects
const VOLUME: Record<SoundEvent, number> = {
  ambienceMorning: 0.15,
  ambienceEvening: 0.12,
  bottle: 0.5,
  pour: 0.35, // 70 percent of the original 0.5
  mix: 0.5,
  smell: 0.5,
  deliver: 0.8,
  click: 0.4,
  signFall: 0.7,
}
// The pour file is longer than the pour animation, so it is cut short while playing (the file
// itself is not edited): it ends POUR_SOUND_MS after it starts, the last POUR_FADE_MS fading out.
const POUR_SOUND_MS = 550
const POUR_FADE_MS = 150
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
  for (const key of Object.keys(MUSIC_FILES) as MusicKey[]) {
    const file = MUSIC_FILES[key]
    if (file) scene.load.audio(key, AUDIO_FOLDER + file)
  }
}

// Plays one effect from any scene, at its volume from the table above. Skipped quietly if the file is
// missing (the loader has already warned about it). The shop uses SoundManager instead.
// `seek` starts the sound that many seconds into the file.
export function playEffect(scene: Phaser.Scene, event: SoundEvent, seek = 0) {
  const key = keyOf(event)
  if (!scene.cache.audio.exists(key)) return
  scene.sound.play(key, { volume: VOLUME[event], seek })
}

// Starts a music loop with a fade in, and stops it with a fade out when the scene shuts down (or
// when stopMusic is called). Nothing happens if the file is missing. The M key mutes, as in the
// shop. Like the ambience, it waits for the browser to allow sound.
export function playMusic(scene: Phaser.Scene, key: MusicKey): { stop: (fadeMs?: number) => void } | undefined {
  if (!scene.cache.audio.exists(key)) return undefined
  let sound: (Phaser.Sound.BaseSound & { volume: number }) | undefined
  let stopped = false
  const begin = () => {
    if (stopped) return
    sound = scene.sound.add(key, { loop: true, volume: 0 }) as Phaser.Sound.BaseSound & { volume: number }
    sound.play()
    scene.tweens.add({ targets: sound, volume: MUSIC_VOLUME[key], duration: MUSIC_FADE_MS })
  }
  if (scene.sound.locked) scene.sound.once('unlocked', begin)
  else begin()

  const toggleMute = () => {
    scene.sound.mute = !scene.sound.mute
  }
  scene.input.keyboard?.on(MUTE_KEY, toggleMute)

  const stop = (fadeMs = MUSIC_FADE_MS) => {
    if (stopped) return
    stopped = true
    scene.input.keyboard?.off(MUTE_KEY, toggleMute)
    const ending = sound
    if (!ending) return
    scene.tweens.killTweensOf(ending)
    scene.tweens.add({ targets: ending, volume: 0, duration: fadeMs, onComplete: () => ending.destroy() })
  }
  scene.events.once('shutdown', () => stop(0))
  return { stop }
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
    if (event === 'pour') {
      this.playCutShort(key, VOLUME[event])
      return
    }
    this.scene.sound.play(key, { volume: VOLUME[event] })
  }

  // Plays a sound, fades it out at the end of POUR_SOUND_MS and removes it
  private playCutShort(key: string, volume: number) {
    const sound = this.scene.sound.add(key, { volume }) as Phaser.Sound.BaseSound & { volume: number }
    sound.once('complete', () => sound.destroy()) // the file was shorter than the cut: nothing to fade
    sound.play()
    this.scene.time.delayedCall(POUR_SOUND_MS - POUR_FADE_MS, () => {
      if (!sound.isPlaying) return
      this.scene.tweens.add({ targets: sound, volume: 0, duration: POUR_FADE_MS, onComplete: () => sound.destroy() })
    })
  }

  // Called when the scene shuts down: stop the loops and the key listener
  destroy() {
    this.destroyed = true
    this.scene.input.keyboard?.off(MUTE_KEY, this.toggleMute)
    Object.values(this.ambience).forEach((sound) => sound?.destroy())
    this.ambience = {}
  }
}
