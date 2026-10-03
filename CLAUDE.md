# Attar: perfume shop game (DreamLayer Game Jam entry)

## What this is
A small browser game. The player runs a tiny old-Istanbul attar (perfume) shop.
Customers describe a memory or feeling; the player mixes up to 6 drops from 10
ingredients, lets the customer smell it, adjusts once, and delivers.
5 days, 2 customers per day (morning/evening). Jam deadline: Oct 12, 2026 07:30.

## Stack
Vite + TypeScript (strict) + Phaser 3. Runs fully in the browser, no backend.

## Rules
- Owner is new to game development and must explain this code in an interview.
  Keep code simple and readable, small files, short comments explaining WHY.
  Prefer plain functions and data tables over clever abstractions.
- Game logic (scoring) lives in src/game/, pure TypeScript with no Phaser imports.
- Data (ingredients, customers, dialogue) lives in src/data/ as typed arrays.
- Scenes live in src/scenes/. Game resolution 1280x720, scaled to fit.
- Use placeholder rectangles/circles when real art is missing. Load real art
  from public/assets/ by file name, so swapping art needs no code changes.
- NEVER put API keys in code or commit them. The game must never call the
  DreamLayer API; images are generated offline with the dreamlayer CLI and
  saved into public/assets/.
- Game text is in English.
- Must work as an HTML5 build uploaded to itch.io (npm run build -> dist/).
- Keep scope small. A polished small game beats a big unfinished one.

## Asset log
Record every DreamLayer generation in ASSET_LOG.md: file, prompt, command,
credits left. This feeds the devlog.
See ASSET_LOG.md for asset rules, the generation log and the improvement list.
Keep DEVLOG.md updated; it is public-facing: never include API keys, emails or anything about hiring.
