// All the story text of the game, in one place. Plain TypeScript, no Phaser.
// {debt} is replaced by the debt of the chosen difficulty and {earned} by the money earned, both
// written like the money display ("$2,200").
import { formatMoney } from './economy'

// The story before the first customer, one page at a time
export const INTRO_PAGES: string[] = [
  'For forty years, Rıza Efendi mixed perfumes in this little shop behind the Spice Bazaar. People said he could bottle a memory.',
  'He was your grandfather. When you were small, you sat on this counter while he let you smell rose, oud and amber, one drop at a time.',
  'Last week, he passed away. He left you the shop, his old cat Misk, and the notebook where he wrote down every scent he ever knew.',
  'He also left a debt. The shop owes {debt}, and the lender will come in five days.',
  "The customers still come. They don't ask for a perfume by name. They ask for a feeling, a place, a memory.",
  "Open the notebook. Listen to them. Let them smell. And keep your grandfather's door open.",
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
  return text.replace('{debt}', formatMoney(debt)).replace('{earned}', formatMoney(earned))
}
