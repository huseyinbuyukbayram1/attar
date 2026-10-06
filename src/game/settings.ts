// Player settings (volumes and mute), kept in one place and saved in localStorage. Plain TypeScript,
// no Phaser. Storage can be unavailable (private windows, blocked site data): every read and write
// is wrapped, and the game then simply uses the defaults for this session.

export type Settings = {
  master: number // 0..1
  music: number // 0..1: music and ambience
  effects: number // 0..1: bottle, pour, mix, smell, deliver, click, sign fall
  muted: boolean
}

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.6, effects: 0.8, muted: false }
const STORAGE_KEY = 'attar_settings'

let current: Settings = { ...DEFAULT_SETTINGS }
const listeners = new Set<() => void>()

const clamp01 = (value: unknown, fallback: number) => (typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback)

// Reads the saved settings (call once, before any sound plays). Anything missing or wrong falls back
// to the default for that setting.
export function loadSettings() {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY)
    if (!text) return
    const saved = JSON.parse(text) as Partial<Settings>
    current = {
      master: clamp01(saved.master, DEFAULT_SETTINGS.master),
      music: clamp01(saved.music, DEFAULT_SETTINGS.music),
      effects: clamp01(saved.effects, DEFAULT_SETTINGS.effects),
      muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULT_SETTINGS.muted,
    }
  } catch {
    current = { ...DEFAULT_SETTINGS }
  }
}

export function getSettings(): Readonly<Settings> {
  return current
}

// Changes some settings, saves them and tells everyone who listens (the sounds that are playing,
// the settings panel)
export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // not saved; the settings still work until the page is closed
  }
  listeners.forEach((listener) => listener())
}

// While the game is paused the music and the ambience are turned down: this factor (1 = normal) is
// multiplied into their volume. It is not saved.
let musicDuck = 1
export const getMusicDuck = () => musicDuck
export function setMusicDuck(factor: number) {
  musicDuck = factor
  listeners.forEach((listener) => listener())
}

// Calls `listener` whenever the settings change. Returns the function that stops it.
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
