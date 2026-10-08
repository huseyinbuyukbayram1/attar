// What the player character says on the REACT screen. All the lines live here, in one place, so they are
// easy to change. Pure TypeScript (no Phaser): the scene only asks "which face and which line?".

export type Expression = 'neutral' | 'happy' | 'sad'

// A category is a situation; each has a face and a few lines to pick from
type Category = { expression: Expression; lines: string[] }

const CATEGORIES = {
  // After a smell, by what the customer's hint said
  hintNearMiss: {
    expression: 'happy',
    lines: ['So close... one more drop.', "Almost there. Don't overthink it.", 'I can smell it. Just a touch more.'],
  },
  hintExact: {
    expression: 'happy',
    lines: ["That's the one.", 'There it is. I can feel it.', 'The notebook was right.'],
  },
  hintOther: {
    expression: 'neutral',
    lines: ['Hmm. Back to the notebook.', 'Noted. Let me fix that.', 'Right. Not quite yet.', 'Let me think about this.'],
  },
  // After delivery, by the number of stars
  stars3: {
    expression: 'happy',
    lines: ['Exactly as I hoped.', 'Grandfather would be proud.', 'That one was perfect.', 'The notebook never lies.'],
  },
  stars2: {
    expression: 'neutral',
    lines: ['Close enough. Next time, closer.', 'Good, but not perfect yet.', "Almost. I'll get it next time."],
  },
  stars1: {
    expression: 'sad',
    lines: ['Not my best work...', 'I should have listened more carefully.', 'Half a coin is still a coin.'],
  },
  stars0: {
    expression: 'sad',
    lines: ["They're right. That wasn't it.", "I'll do better for the next one.", 'Grandfather would have known.'],
  },
  // The practice customer
  practiceDone: { expression: 'happy', lines: ['Thank you, Sabiha Teyze!'] },
} satisfies Record<string, Category>

export type CategoryName = keyof typeof CATEGORIES

// The hint texts come from hintFor() in scoring.ts: "That is exactly it." and "So close! ..." are the
// two special ones. We only read the text here; the hints themselves are not changed.
export function hintCategory(hint: string): CategoryName {
  if (hint.startsWith('That is exactly it')) return 'hintExact'
  if (hint.startsWith('So close')) return 'hintNearMiss'
  return 'hintOther'
}

export function starsCategory(stars: 0 | 1 | 2 | 3): CategoryName {
  return `stars${stars}`
}

// The last line said, whatever the category: some lines are in several categories, and the same
// line must never be said twice in a row
let lastLine: string | undefined

// A random line of the category (never the line said just before, in any category), with the face that goes with it
export function pickReply(name: CategoryName): { expression: Expression; text: string } {
  const { expression, lines } = CATEGORIES[name] as Category
  const choices = lines.length > 1 ? lines.filter((line) => line !== lastLine) : lines
  const text = choices[Math.floor(Math.random() * choices.length)]
  lastLine = text
  return { expression, text }
}
