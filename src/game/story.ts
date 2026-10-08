// All the story text of the game, in one place. Plain TypeScript, no Phaser.
// {debt} is replaced by the debt of the chosen difficulty and {earned} by the money earned, both
// written in words ("22 gold coins").
import { goldCoins } from './economy'

// The story before the first customer, one page at a time
export const INTRO_PAGES: string[] = [
  'For forty years, Rıza Efendi mixed perfumes in this narrow shop behind the Spice Bazaar. Sailors, brides and old pashas all came through his door, each asking for something they could not name. People said he could bottle a memory, and he never once argued with them.',
  'He was your grandfather. When you were small, you sat on this very counter while he held a bottle under your nose — rose, then oud, then amber, one drop at a time. "Don\'t look at the bottles," he would say. "Close your eyes and remember."',
  'Last week, he passed away in his sleep. He left you the shop, his old orange cat Misk, and a worn leather notebook. Inside, in his careful hand, is every scent he ever knew.',
  'He also left a debt. The shop owes {debt}, and the lender will come back in five days. Sell enough perfume by then and the door stays open. Fail, and his shop becomes someone else\'s.',
  "The customers still come. They don't ask for a perfume by name — they ask for a feeling, a place, a moment they lost. Open the notebook, listen carefully, and keep your grandfather's door open.",
]

export const WIN_PAGE =
  "On the fifth evening, you count the coins twice: {earned}. The debt is paid. Misk stretches on the step, as if he knew all along. Tomorrow the door opens again, and this time it's your shop."

// The great win (the money reaches the difficulty's greatWin amount) is its own single page
export const GREAT_WIN_PAGE =
  "On the fifth evening, you count the coins twice: {earned}. The debt is paid. Word has spread down the street: Rıza Efendi's grandchild has the gift. By morning, there is a line outside the door."

export const LOSE_PAGE =
  "On the fifth evening, you count the coins twice: {earned}. It isn't enough. The lender is kind, but a debt is a debt. You lock the door, keep the notebook, and carry Misk home. You know the scents now. Maybe one day, the door will open again."

// The practice customer of the tutorial (Sabiha, the neighbour)
export const PRACTICE_INTRO = 'Before you open, let me be your first customer. Your grandfather always made me something for my morning coffee.'
export const PRACTICE_GOODBYE = "No, no, keep it. Go on, open your shop!"
export const DAY_ONE_CARD = 'The shop is open — Day 1' // the title card after the practice

// Puts the debt and the money into a story text
export function fillStory(text: string, debt: number, earned = 0): string {
  return text.replace('{debt}', goldCoins(debt)).replace('{earned}', goldCoins(earned))
}
