// TEMP developer shortcuts: remove before release (see BACKLOG.md, release cleanup).
// One switch for the keys that jump to the endings (1 = lose, 2 = win, 3 = great win), used by the
// story intro and by the shop. The money is made up from the difficulty chosen.
export const DEV_KEYS = true

export type DevEnding = 'lose' | 'win' | 'great'

export function devEndingMoney(ending: DevEnding, debt: number, greatWin: number): number {
  if (ending === 'lose') return Math.max(0, debt - 300) // 300 short
  if (ending === 'win') return Math.min(debt + 100, greatWin - 1) // paid, but below the great win
  return greatWin + 100
}
