// Sound: a map from game events to files in public/assets/audio/, and a small manager.
// The only Phaser use is the TYPE of the scene (erased at build time), so this file stays
// plain TypeScript like the rest of src/game/.
import type Phaser from 'phaser'
import type { TimeOfDay } from './gameState'
import { getMusicDuck, getSettings, onSettingsChange, updateSettings } from './settings'

export type SoundEvent = 'ambienceMorning' | 'ambienceEvening' | 'bottle' | 'pour' | 'mix' | 'smell' | 'deliver' | 'click' | 'signFall' | 'coin' | 'footsteps'

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
  footsteps: 'footsteps.mp3', // the walk between the counter and the customer (only its first seconds are played)
  coin: 'coin.mp3', // a coin lands in the cash box. Not there yet? The delivery plays a quiet click instead.
  signFall: 'sign_fall.mp3', // title screen: the sign falls. Not there yet? The loader warns and the sound is skipped.
}

// Music: looped, one file per key. null = there is no file yet, so nothing is loaded or played.
// To add the title music, drop the file into public/assets/audio/ and write its name here.
export type MusicKey = 'music_title' | 'music_ending_lose' | 'music_ending_win' | 'music_ending_greatwin'
export const MUSIC_FILES: Record<MusicKey, string | null> = {
  music_title: 'title_music.mp3',
  music_ending_lose: 'ending_lose.mp3',
  music_ending_win: 'ending_win.mp3',
  music_ending_greatwin: 'ending_greatwin.mp3',
}
const MUSIC_VOLUME: Record<MusicKey, number> = { music_title: 0.25, music_ending_lose: 0.25, music_ending_win: 0.25, music_ending_greatwin: 0.25 }
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
  coin: 0.5,
  footsteps: 0.5,
}
// The pour file is longer than the pour animation, so it is cut short while playing (the file
// itself is not edited): it ends POUR_SOUND_MS after it starts, the last POUR_FADE_MS fading out.
const POUR_SOUND_MS = 550
const POUR_FADE_MS = 150
const SKIP_FADE_MS = 120 // a sound cut short by a click fades out this fast
const AMBIENCE_FADE_MS = 1500 // same as the morning/evening crossfade of the picture
const MUTE_KEY = 'keydown-M'

// Two volume groups, each with its own slider: "music" is the music and both ambiences, "effects" is
// everything else. What is heard = master x group x the sound's own base volume (the tables above).
type Group = 'music' | 'effects'
const groupOf = (event: SoundEvent): Group => (event === 'ambienceMorning' || event === 'ambienceEvening' ? 'music' : 'effects')
function groupGain(group: Group): number {
  const settings = getSettings()
  return settings.master * (group === 'music' ? settings.music * getMusicDuck() : settings.effects)
}
const effectiveVolume = (event: SoundEvent) => VOLUME[event] * groupGain(groupOf(event))

// Mute is a setting too: it is saved, and applied to the whole game's sound
export function applyMute(scene: Phaser.Scene) {
  scene.sound.mute = getSettings().muted
}
export function toggleMute(scene: Phaser.Scene) {
  updateSettings({ muted: !getSettings().muted })
  applyMute(scene)
}

const EVENTS = Object.keys(SOUND_FILES) as SoundEvent[]
// The loaded sound's key: sfx_bottle, sfx_coin, sfx_footsteps ...
const keyOf = (event: SoundEvent) => `sfx_${event}`

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
export function playEffect(scene: Phaser.Scene, event: SoundEvent, seek = 0, volumeScale = 1) {
  startEffect(scene, event, effectiveVolume(event) * volumeScale, seek)
}

// Every effect that is playing, with its event. The pause menu pauses exactly these (music and
// ambience are not in here: they are only turned down). A sound leaves the list when it ends.
type Effect = Phaser.Sound.BaseSound & { volume: number }
const effectSounds = new Map<Effect, SoundEvent>()
let pausedEffects: Effect[] = [] // the ones the pause menu stopped, so that it can resume exactly those

// Starts one effect and keeps track of it. Returns undefined if the file is missing.
function startEffect(scene: Phaser.Scene, event: SoundEvent, volume: number, seek = 0, rate = 1): Effect | undefined {
  const key = keyOf(event)
  if (!scene.cache.audio.exists(key)) return undefined
  const sound = scene.sound.add(key, { volume }) as Effect
  effectSounds.set(sound, event)
  const forget = () => effectSounds.delete(sound)
  sound.once('complete', () => {
    forget()
    sound.destroy()
  })
  sound.once('destroy', forget)
  sound.play({ seek, rate })
  return sound
}

// The pause menu opened: pause every effect that is playing right now. Their volume is not touched.
export function pauseEffects() {
  pausedEffects = [...effectSounds.keys()].filter((sound) => sound.isPlaying)
  pausedEffects.forEach((sound) => sound.pause())
}

// Back to the game: resume exactly the effects that were paused, each at its normal volume
// (master x effects x its own base volume, which also covers sliders moved during the pause)
export function resumeEffects() {
  for (const sound of pausedEffects) {
    const event = effectSounds.get(sound)
    if (event === undefined) continue // it was destroyed meanwhile
    sound.volume = effectiveVolume(event)
    sound.resume()
  }
  pausedEffects = []
}

// Restart or main menu: the paused effects must not come back in the next scene
export function stopPausedEffects() {
  for (const sound of pausedEffects) sound.destroy()
  pausedEffects = []
}

// Starts a music loop with a fade in, and stops it with a fade out when the scene shuts down (or
// when stopMusic is called). Nothing happens if the file is missing. The M key mutes, as in the
// shop. Like the ambience, it waits for the browser to allow sound.
// `ignoreDuck`: the music keeps its volume when everything else is turned down (the ending preview plays over a paused scene)
export function playMusic(scene: Phaser.Scene, key: MusicKey, ignoreDuck = false): { stop: (fadeMs?: number) => void } | undefined {
  if (!scene.cache.audio.exists(key)) return undefined
  let sound: (Phaser.Sound.BaseSound & { volume: number }) | undefined
  let stopped = false
  const volume = () => MUSIC_VOLUME[key] * (ignoreDuck ? getSettings().master * getSettings().music : groupGain('music'))
  const begin = () => {
    if (stopped) return
    sound = scene.sound.add(key, { loop: true, volume: 0 }) as Phaser.Sound.BaseSound & { volume: number }
    sound.play()
    scene.tweens.add({ targets: sound, volume: volume(), duration: MUSIC_FADE_MS })
  }
  if (scene.sound.locked) scene.sound.once('unlocked', begin)
  else begin()

  const onMuteKey = () => toggleMute(scene)
  scene.input.keyboard?.on(MUTE_KEY, onMuteKey)
  // A change of the sliders is heard at once: the fade in is cut short and the volume set
  const stopListening = onSettingsChange(() => {
    if (!sound) return
    scene.tweens.killTweensOf(sound)
    sound.volume = volume()
  })

  const stop = (fadeMs = MUSIC_FADE_MS) => {
    if (stopped) return
    stopped = true
    scene.input.keyboard?.off(MUTE_KEY, onMuteKey)
    stopListening()
    const ending = sound
    if (!ending) return
    scene.tweens.killTweensOf(ending)
    scene.tweens.add({ targets: ending, volume: 0, duration: fadeMs, onComplete: () => ending.destroy() })
    scene.events.once('shutdown', () => ending.destroy()) // the fade stops with the scene, so the sound must not be left playing
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
  private onMuteKey = () => toggleMute(this.scene)
  private stopListening: () => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    scene.input.keyboard?.on(MUTE_KEY, this.onMuteKey)
    // A change of the sliders is heard at once: the ambience takes the new level
    this.stopListening = onSettingsChange(() => this.setTime(this.time, true))
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
      ambienceMorning: time === 'morning' ? effectiveVolume('ambienceMorning') : 0,
      ambienceEvening: time === 'evening' ? effectiveVolume('ambienceEvening') : 0,
    }
    for (const event of ['ambienceMorning', 'ambienceEvening'] as const) {
      const sound = this.ambience[event] as (Phaser.Sound.BaseSound & { volume: number }) | undefined
      if (!sound) continue
      this.scene.tweens.killTweensOf(sound)
      if (instant) sound.volume = levels[event]
      else this.scene.tweens.add({ targets: sound, volume: levels[event], duration: AMBIENCE_FADE_MS })
    }
  }

  // True if the sound's file was loaded
  has(event: SoundEvent): boolean {
    return this.scene.cache.audio.exists(keyOf(event))
  }

  // `volumeScale` makes this one play quieter than its normal volume (1 = normal)
  // `rate` plays it faster or slower (and higher or lower): 1 = normal
  play(event: SoundEvent, volumeScale = 1, rate = 1) {
    const key = keyOf(event)
    if (!this.scene.cache.audio.exists(key)) return
    if (event === 'pour') {
      this.playCutShort(effectiveVolume(event) * volumeScale)
      return
    }
    startEffect(this.scene, event, effectiveVolume(event) * volumeScale, 0, rate)
  }

  // Plays a sound only for `durationMs` (the file may be much longer), fading out over the last `fadeMs`. Returns a
  // function that ends it early with a short fade (for a skipped transition).
  // `seek`: seconds of the file to skip at the start (a file that begins with silence)
  playFor(event: SoundEvent, durationMs: number, fadeMs: number, seek = 0): () => void {
    const sound = startEffect(this.scene, event, effectiveVolume(event), seek)
    if (!sound) return () => {}
    const fadeOut = (ms: number) => {
      if (!sound.isPlaying) return
      this.scene.tweens.killTweensOf(sound)
      this.scene.tweens.add({ targets: sound, volume: 0, duration: ms, onComplete: () => sound.destroy() })
    }
    const timer = this.scene.time.delayedCall(durationMs - fadeMs, () => fadeOut(fadeMs))
    return () => {
      timer.remove()
      fadeOut(SKIP_FADE_MS)
    }
  }

  // Plays a sound, fades it out at the end of POUR_SOUND_MS and removes it
  private playCutShort(volume: number) {
    const sound = startEffect(this.scene, 'pour', volume) // the file may be shorter than the cut: then nothing to fade
    if (!sound) return
    this.scene.time.delayedCall(POUR_SOUND_MS - POUR_FADE_MS, () => {
      if (!sound.isPlaying) return
      this.scene.tweens.add({ targets: sound, volume: 0, duration: POUR_FADE_MS, onComplete: () => sound.destroy() })
    })
  }

  // Called when the scene shuts down: stop the loops and the key listener
  destroy() {
    this.destroyed = true
    this.scene.input.keyboard?.off(MUTE_KEY, this.onMuteKey)
    this.stopListening()
    Object.values(this.ambience).forEach((sound) => sound?.destroy())
    this.ambience = {}
  }
}
