// Display colors live apart from ingredients.ts: that file is pure scent data,
// colors are only a looks decision (and will go away when real art arrives)
export const INGREDIENT_COLORS: Record<string, number> = {
  rose: 0xd9577a,
  jasmine: 0xf5ecd0,
  bergamot: 0xc8d63f,
  neroli: 0xf2a63b,
  cedar: 0x7a5230,
  oud: 0x4a2c1c,
  vanilla: 0xf0dca0,
  amber: 0xc9852b,
  saffron: 0xd9421f,
  seaSalt: 0x8fc4d6,
}

// Used if an ingredient is ever added without a color, so it still shows up
export const FALLBACK_COLOR = 0x888888
