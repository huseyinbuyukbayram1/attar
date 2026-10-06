// The money and difficulty numbers of the game, all in one place. Plain TypeScript, no Phaser.
// The chosen difficulty is remembered in localStorage (every read and write is wrapped: storage can
// be unavailable, then the default is used for this session).

// What a delivery pays. The price is the base; the stars decide how much of it is paid and the tip.
export const BASE_PRICE = 200
export const HAGGLE_SHARE = 0.5 // 1 star: the customer haggles and pays this share of the price
export const TIP = 100 // 3 stars: full price plus this tip

export type DifficultyId = 'easy' | 'normal' | 'hard'
export type Difficulty = {
  id: DifficultyId
  label: string
  debt: number // the target: the money to earn in the five days
  smells: number // how often the customer may smell the mix, per order
  greatWin: number // from this much the ending adds a line about customers lining up
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: { id: 'easy', label: 'Easy', debt: 1800, smells: 3, greatWin: 2400 },
  normal: { id: 'normal', label: 'Normal', debt: 2200, smells: 2, greatWin: 2800 },
  hard: { id: 'hard', label: 'Hard', debt: 2600, smells: 2, greatWin: 3000 },
}
export const DIFFICULTY_IDS: DifficultyId[] = ['easy', 'normal', 'hard']
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal'
const STORAGE_KEY = 'attar_difficulty'

let current: DifficultyId = DEFAULT_DIFFICULTY

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

// Remembers the choice; the next game uses it
export function setDifficulty(id: DifficultyId) {
  current = id
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // not saved; the choice still counts until the page is closed
  }
}
