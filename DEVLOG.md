# Attar devlog

A small browser game about running an old-Istanbul attar (perfume) shop,
made for the DreamLayer Game Jam with Phaser 3 + TypeScript. This is my first game.

## Day 1 (Oct 3)
- Chose the concept: customers describe a memory or feeling, I mix drops from
  10 ingredients, they smell it, I adjust once, then deliver.
- Chose a web stack (Phaser + TypeScript) because I had never made a game and
  needed the fastest path to a playable browser build.
- Generated the shop background in the DreamLayer web app, then made a
  morning/evening pair: the evening version was made with the CLI by editing
  the morning image.
- Set up the project skeleton with Claude Code (BootScene, ShopScene).

## DreamLayer feedback (kept factual, for the team and for other jammers)

### What worked well
- Image-to-image edit kept the composition almost exactly the same between
  morning and evening (lantern, shelves, bottles, scale, window, medallion in
  the same positions). This is perfect for a "same shop, different time" game.
- CLI is simple. `balance` and `capabilities` are free, and one `edit` cost
  exactly 1 credit (100 -> 99).
- Local .jpg input worked directly.
- Clear docs index (llms.txt) made it easy to plan a credit budget.

### Things that surprised me
- Web app: a multi-step edit charges credits per step. A 3-step edit showed
  "2 credits" in total and the third step failed with an out-of-credits
  message, which used up all 3 free app credits.
- Web app credits and API credits are separate. The free "100 API credits"
  cannot be used in the web app, and the app only showed 3 free credits.
- Edit with "do not add, remove or move any objects" still added a hanging rope
  with a tassel and a lit candle, and changed the painting style from soft
  watercolor (morning) to a darker cinematic look (evening).
- My prompt asked for an Istanbul bazaar feel; the first result had a gothic
  pointed window and a European apothecary look. A second edit fixed the window.
- The API console banner says to buy credits before the first call even when
  100 promotional credits are already available.
- The docs index says a new account starts with zero credits and must purchase,
  while the console showed 100 promotional credits.
- CLI `capabilities` warns that the server offers `sprite_sheet` but the
  installed CLI cannot use it, and suggests `npm i -g dreamlayer`. The CLI docs
  say sprite sheets need the beta version, so that suggestion may not fix it.
- Docs mention beta.3 in one place and beta.4 in another.
- `edit` returned a 2048x2048 square image for a 2560x1440 input, even when
  `--aspect 16:9` was passed; the flag was accepted without an error and
  ignored. A second attempt gave the same result.

### Ideas
- Show the estimated credit cost of a multi-step edit before it runs.
- Add a "keep style exactly" option for edits, in addition to keeping composition.
