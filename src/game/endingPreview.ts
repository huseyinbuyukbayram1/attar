import type { Difficulty } from './difficulty'

// The sample money of the "View endings" preview in the settings (Extras). Plain TypeScript, no Phaser.
// The numbers come from the difficulty chosen, so the ending text shows believable amounts.
export type PreviewEnding = 'lose' | 'win' | 'great'

export function previewMoney(ending: PreviewEnding, difficulty: Pick<Difficulty, 'debt' | 'greatWin'>): number {
  if (ending === 'lose') return Math.max(0, difficulty.debt - 300) // 300 short of the target
  if (ending === 'win') return difficulty.debt + 100 // paid, a little over
  return difficulty.greatWin + 100
}
