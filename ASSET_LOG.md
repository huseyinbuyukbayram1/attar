# Asset log

## Rules
1. Keep the file name and the 16:9 aspect ratio of the background stable
   (shop_morning) so improved art can replace the file without any code change.
   The evening look is done in code on top of shop_morning (there is no
   shop_evening image any more).
2. Final art lives in public/assets/. Raw generations and references live in
   assets_raw/ and are never loaded by the game.
3. Every DreamLayer generation is logged below: file, prompt, command, credits left.
4. Ship working, acceptable art first. Improve art only after the game is playable
   end to end and credits remain.
5. API key stays in the DREAMLAYER_API_KEY environment variable. Never in code or git.

## Generation log
| File | Source | Credits left |
|---|---|---|
| assets_raw/shop_morning.jpg | DreamLayer web app: text-to-image, then a multi-step edit (simpler shelves, lattice window). Cost 3 app credits (separate from API credits). | API: 100 |
| assets_raw/shop_evening.png | CLI: `dreamlayer edit assets_raw/shop_morning.jpg` with prompt "Keep this exact shop... change only the time of day to evening: dusk sky in the window, warm lantern and candlelight. Do not add, remove or move any objects. No people, no text." | API: 99 |
| assets_raw/shop_door_morning_v1.png | DreamLayer CLI: `dreamlayer generate`, 16:9. Cost 1 credit. (Prompt not recorded in this log.) | not recorded |
| assets_raw/shop_door_evening_v1.png | DreamLayer CLI: `dreamlayer edit` of the door morning image, with `--aspect 16:9`. Came back 2048x2048 (square). (Prompt not recorded in this log.) | not recorded |
| assets_raw/shop_door_evening_v2.png | DreamLayer CLI: second `dreamlayer edit` attempt, with `--aspect 16:9`. Again 2048x2048 (square). The evening look is done in code instead. (Prompt not recorded in this log.) | API: 94 |

Findings for the devlog:
- Edit kept the composition almost exactly (lantern, shelves, bottles, scale, window, medallion in the same places).
- Despite "do not add objects", it added a hanging rope with a tassel and a lit candle on the counter.
- Painting style shifted from soft watercolor (morning) to a darker cinematic digital look (evening).
- Multi-step edits in the web app charge credits per step.
- One CLI edit costs exactly 1 credit.

## Improvement list (only if credits and time remain)
- [ ] Make shop_evening closer to the soft watercolor style of shop_morning.
- [ ] Remove the hanging rope/tassel and the lit candle from shop_evening.
- [ ] Optional: remove the blue tile medallion from shop_morning (web app edit step failed).
