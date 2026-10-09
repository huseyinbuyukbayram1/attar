// The money (gold coins) and difficulty numbers of the game, all in one place. Plain TypeScript, no Phaser.
// The chosen difficulty is remembered in localStorage (every read and write is wrapped: storage can
// be unavailable, then the default is used for this session).

// What a delivery pays. The price is the base; the stars decide how much of it is paid and the tip.
export const BASE_PRICE = 2 // gold coins
export const HAGGLE_SHARE = 0.5 // 1 star: the customer haggles and pays this share of the price
export const TIP = 1 // 3 stars: full price plus this tip

export type DifficultyId = 'easy' | 'normal' | 'hard'
export type Difficulty = {
  id: DifficultyId
  label: string
  debt: number // the target: the gold coins to earn in the five days
  smells: number // how often the customer may smell the mix, per order
  greatWin: number // from this much the ending adds a line about customers lining up
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: { id: 'easy', label: 'Easy', debt: 18, smells: 3, greatWin: 24 },
  normal: { id: 'normal', label: 'Normal', debt: 22, smells: 2, greatWin: 28 },
  hard: { id: 'hard', label: 'Hard', debt: 26, smells: 2, greatWin: 30 },
}
export const DIFFICULTY_IDS: DifficultyId[] = ['easy', 'normal', 'hard']
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal'
const STORAGE_KEY = 'attar_difficulty'

let current: DifficultyId = DEFAULT_DIFFICULTY
let chosenThisSession = false // setDifficulty was called: counts as chosen even when nothing can be saved (private mode)

// Reads the last choice (call once at the start)
export function loadDifficulty() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'easy' || saved === 'normal' || saved === 'hard') current = saved
  } catch {
    current = DEFAULT_DIFFICULTY
  }
}

export function getDifficulty(): Difficulty {
  return DIFFICULTIES[current]
}

// True if the player has picked a difficulty before (it is saved), false on the very first visit
export function hasChosenDifficulty(): boolean {
  if (chosenThisSession) return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

// Remembers the choice; the next game uses it
export function setDifficulty(id: DifficultyId) {
  current = id
  chosenThisSession = true
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // not saved; the choice still counts until the page is closed
  }
}
