# Attar

A small puzzle game about an old-Istanbul perfume shop, built with TypeScript and Phaser 3 for the DreamLayer Game Jam.

**Play it in your browser: https://huseyinbuyukbayram.itch.io/attar**

## The story

You take over your grandfather's attar (perfume) shop, and it comes with a debt. You have five days to earn enough gold coins to pay it off.

Each day two customers walk in, one in the morning and one in the evening. They don't ask for a recipe. They describe a memory or a feeling, like "warm asphalt right after the rain". You mix 3 to 6 drops from 10 ingredients, let the customer smell it, adjust once, and deliver. The closer the scent is to what they remember, the more they pay.

- **3 difficulties:** the difficulty sets the debt (the gold coins you must earn in five days) and how many times a customer can smell your mix.
  - Easy: debt 18, 3 smells
  - Normal: debt 22, 2 smells
  - Hard: debt 26, 2 smells
- **3 endings**, decided by the gold coins you have after day five:
  - Lose: you earned less than the debt, and you lose the shop.
  - Win: you paid the debt and keep the shop.
  - Great win: you earned a lot more than the debt (24 on Easy, 28 on Normal, 30 on Hard), and customers line up outside.

## Tech

- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Phaser 3](https://phaser.io/) for the game scenes and rendering
- [Vite](https://vitejs.dev/) for dev server and build
- Runs fully in the browser, no backend

The scoring and money rules are plain TypeScript in `src/game/` with no Phaser imports. Ingredients and customers are typed data tables in `src/data/`. The scenes are in `src/scenes/`.

## Run it locally

You need [Node.js](https://nodejs.org/) and npm.

```bash
# install dependencies
npm install

# start the dev server (Vite prints the local URL)
npm run dev

# type-check and build for production (output goes to dist/)
npm run build

# preview the production build
npm run preview
```

The `dist/` folder is a static HTML5 build, ready to upload to itch.io.

Two helper scripts for balancing the game:

```bash
npm run check-orders   # tries every 3-6 drop recipe and checks that each order can be solved with 3 stars
npm run hint-demo      # prints the customer's hint for deliberately flawed mixes (changes nothing)
```

## Credits

- **Art:** all images were generated with DreamLayer (offline, with its CLI, and saved into `public/assets/`). The game never calls the DreamLayer API. The generation log is in [ASSET_LOG.md](ASSET_LOG.md).
- **Music and sound effects:** [Pixabay](https://pixabay.com/)
- **Font:** Cinzel Decorative, under the SIL Open Font License (see `public/assets/fonts/OFL.txt`)

A devlog of how the game was made is in [DEVLOG.md](DEVLOG.md).
