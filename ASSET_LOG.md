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
| public/assets/props/notebook_open.png (raw: assets_raw/notebook_open_raw.png, cutout: assets_raw/notebook_open.png) | DreamLayer CLI: `dreamlayer generate`, 16:9 2560x1440, then background cutout, then `sips` crop to 2190x1400 at offset 190,20, then resized to 1100 px wide (1100x703, transparent). Used as the page of the ingredient notebook panel (Tab). Prompt: "An open antique leather-bound notebook lying flat, seen from directly above, both pages fully visible and centered. Two blank aged parchment pages with soft cream tones, a few faint ink stains near the outer edges, worn dark brown leather cover visible around the pages, a thin ribbon bookmark. Stylized ink and watercolor illustration, warm Ottoman-era apothecary mood, matching a hand-painted game art style. Plain flat light background around the notebook. No text, no writing, no letters, no drawings on the pages, no props, no hands." | not recorded |
| public/assets/title/title_exterior.jpg (raw: assets_raw/title_exterior_v1.png, v2) | DreamLayer CLI: `dreamlayer generate --aspect 16:9` (1920x1080 after processing). Used as the title screen background. Prompt: "Exterior of a small old perfume and spice shop (attar) on a narrow cobblestone street in old Istanbul, at golden evening light. The shop front is centred: a dark wooden door frame, and above the half-open plank wooden door a semicircular arched transom filled with a carved wooden lattice screen (kafes pattern of crossing diagonal slats). Next to the door, a glowing arched display window full of colourful glass perfume bottles. A warm brass lantern beside the door. Above the door, an empty wrought-iron sign bracket sticking out from the wall with nothing hanging from it. Soft dusty pink and teal plaster walls with watercolor washes, two potted plants, a sleeping cat on the step, a faint mosque silhouette far in the background sky. The upper part of the image is calm open sky, and the lower third is a simple uncluttered cobblestone street. Stylized ink and watercolor illustration, warm Ottoman-era mood, matching a hand-painted game art style. No text, no letters, no signs with writing, no people." | not recorded |
| public/assets/title/title_sign.png | Hanging wooden sign for the title screen (700x570, transparent). Generation details were not recorded in this log. | not recorded |
| public/assets/characters/customer_practice.png (raw: assets_raw/customer_practice_raw.png, cutout: assets_raw/customer_practice.png, crop: assets_raw/customer_practice_crop.png) | Sabiha, the neighbour and practice customer of the tutorial. DreamLayer CLI: `dreamlayer generate --aspect 16:9`, then background cutout, then crop 1420x1440 at offset 600,0, then resized to 640 px high (631x640, transparent). Wider than the other customers, so she has her own entry in src/data/customerLayout.ts. Prompt and command: not recorded in this log. | not recorded |
| assets_raw/player_ref_raw.png | The approved reference of the player character. DreamLayer CLI: `dreamlayer generate --aspect 16:9`. All the expressions below are edits of this picture, which is our showcase of DreamLayer's reference-based character consistency. Prompt and command: not recorded in this log. | not recorded |
| public/assets/characters/player_happy.png (raw: assets_raw/player_happy_raw.png, cutout: assets_raw/player_happy.png, crop: assets_raw/player_happy_crop.png) | The player, happy. DreamLayer CLI: `dreamlayer edit` from the reference, 3 attempts: the first changed the hair, the second added cheek marks, the third kept the identity. Then DreamLayer background cutout, crop 1400x1440 at offset 580,0, resized to 640 px high (622x640, transparent). Prompts: not recorded. | not recorded |
| public/assets/characters/player_sad.png (raw: assets_raw/player_sad_raw.png, cutout: assets_raw/player_sad.png, crop: assets_raw/player_sad_crop.png) | The player, sad. DreamLayer CLI: `dreamlayer edit` from the reference, 3 attempts: the first changed the hair and face, the second came back pixelated and square, the third worked. Then DreamLayer background cutout, crop 1400x1440 at offset 580,0, resized to 640 px high (622x640, transparent). Prompts: not recorded. | not recorded |
| public/assets/characters/player_neutral.png (cutout: assets_raw/player_neutral.png, crop: assets_raw/player_neutral_crop.png) | The player, neutral: the approved reference itself (player_ref_raw.png), cut out with DreamLayer background cutout, cropped 1400x1440 at offset 580,0 and resized to 640 px high (622x640, transparent). | not recorded |
| public/assets/story/ending_greatwin.jpg (raw: assets_raw/ending_greatwin_raw.png; earlier tries: ending_greatwin_v2_raw.png, v3, v4; old version: assets_raw/ending_greatwin_v1_backup.jpg) | The great win ending picture, replaced by a new composition. DreamLayer CLI: `dreamlayer generate --aspect 16:9`, from scratch, after two failed `dreamlayer edit` attempts on the old picture that kept the historical costumes. 1920x1080. The blank hanging sign gets "Attar" drawn on it in code (EndingScene.ts, GREAT_SIGN). Prompt: not recorded in this log. | not recorded |
| public/assets/story/ending_win.jpg (raw: assets_raw/ending_win_v2_raw.png, crop: assets_raw/ending_win_v2_crop.png; old version: assets_raw/ending_win_v1_backup.jpg) | The win ending picture, replaced: our own shop interior in the evening, with gold coins, a pouch, the notebook, an amber bottle and the orange cat on the counter. DreamLayer CLI: `dreamlayer edit` of public/assets/backgrounds/shop_morning.jpg, turned to evening and with the new objects added. The edit came back as a 2048x2048 square, so it was cropped to 2048x1152 at y=700 and resized to 1920x1080. The lantern's shape changed in the edit. Prompt: not recorded in this log. | not recorded |
| public/assets/props/gift_bottle.png (raw: assets_raw/gift_bottle_raw.png, cutout: assets_raw/gift_bottle.png, crop: assets_raw/gift_bottle_crop.png) | The gift bottle of the delivery animation (165x220, transparent, round glass body, gold collar, cork in the neck). DreamLayer CLI: `dreamlayer generate --aspect 16:9`, then background cutout, then `sips` crop and resize. Prompt and command: not recorded in this log. | not recorded |
| public/assets/props/cashbox.png and public/assets/props/coin.png (sheet: assets_raw/sheet_delivery_raw.png, cutout: assets_raw/sheet_delivery.png, crops: assets_raw/cashbox_crop.png, assets_raw/coin_crop.png) | The open wooden cash box (240x223) and a gold coin (64x44), both transparent, made on one sheet. DreamLayer CLI: `dreamlayer generate --aspect 16:9`, then background cutout, then `sips` crop and resize. Prompt and command: not recorded in this log. | not recorded |

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
- [ ] Replace the realistic customer portraits (Leyla, Mr. Orhan, Selim) with stylized versions.
- [ ] Idea: finishing step on delivery, a short skippable 3 s animation (oil or alcohol poured into the flask, shake, pour into the round bottle, cork, "For <name>" label). Zero credits, only if time remains.

## Font credits

The title screen logo uses Cinzel Decorative Bold (public/assets/fonts/CinzelDecorative-Bold.ttf), copyright (c) 2012 Natanael Gama, with Reserved Font Name 'Cinzel'. It is licensed under the SIL Open Font License 1.1; the licence text is in public/assets/fonts/OFL.txt. Downloaded from the google/fonts repository on GitHub (ofl/cinzeldecorative).

## Audio credits

All sound effects, ambience loops and music come from Pixabay (pixabay.com), used under the Pixabay Content License (no attribution required).

Compression: the four music files were re-encoded with ffmpeg (the `ffmpeg-static` npm package) to MP3, stereo, 44.1 kHz, at 128 kbps, or 96 kbps where that was still over 3 MB. The originals are kept in assets_raw/audio_original/. Several sound effects were also trimmed or edited (mp3cut.net, Audacity).

| file | event | source (artist, title, Pixabay ID) | note |
| --- | --- | --- | --- |
| ambience_morning.mp3 | ambienceMorning (loop) | freesound_community, "Birds in the Morning", Pixabay, ID 53615 |  |
| ambience_evening.mp3 | ambienceEvening (loop) | see the list "Audio credits (all files)" below; which source became which file was not recorded | Sources used for the evening ambience: "Evening Sound Effect in Village", "Countryside Ambience Night Nearby Road". |
| bottle.mp3 | bottle | freesound_community, "Bottle Clink", Pixabay, ID 101000 |  |
| pour.mp3 | pour | universfield, "Pouring Water into Glass", Pixabay, ID 116975 |  |
| mix.mp3 | mix | see the list "Audio credits (all files)" below; which source became which file was not recorded | Possibly "Glitter Sparkle". |
| smell.mp3 | smell | freesound_community, "Sniffing", Pixabay, ID 40300 |  |
| deliver.mp3 | deliver | see the list "Audio credits (all files)" below; which source became which file was not recorded | Possibly "Register Cha-Ching". |
| click.mp3 | click | vadim_makes_sound, "Soft App Button Tap Sound 5", Pixabay, ID 547873 |  |
| sign_fall.mp3 | signFall (title screen: the sign falls) | alexzavesa, "Boards Fall 2", Pixabay, ID 468368 |  |
| coin.mp3 | sfx_coin (a coin lands in the cash box) | freesound_gamestudio, "Drop Coin", Pixabay, ID 384921 |  |
| footsteps.mp3 | sfx_footsteps (the walk between the counter and the customer; only its first 1.5 s are played) | freesound_community, "Footsteps on Wooden Flooring", Pixabay, ID 6878 |  |
| title_music.mp3 | music_title (title screen, loops) | djovan, "Sahara Sunset - Oriental Relax Ambiance (Desert Flute)", Pixabay, ID not recorded | Re-encoded: 7.5 MB -> 2.8 MB (MP3 96 kbps stereo, 44.1 kHz). Original: assets_raw/audio_original/title_music.mp3. |
| ending_lose.mp3 | music_ending_lose (ending, loops) | ashot_danielyan, "Sad Duduk - Middle Eastern Ambient Soundtrack", Pixabay, ID not recorded | Re-encoded: 7.6 MB -> 2.8 MB (MP3 96 kbps stereo, 44.1 kHz). Original: assets_raw/audio_original/ending_lose.mp3. |
| ending_win.mp3 | music_ending_win (ending, loops) | 38326398, "Mach Piano", Pixabay, ID 301972 | Re-encoded: 3.1 MB -> 1.5 MB (MP3 128 kbps stereo, 44.1 kHz). Original: assets_raw/audio_original/ending_win.mp3. |
| ending_greatwin.mp3 | music_ending_greatwin (ending, loops) | soundsbyamelia, "Ancient Egyptian Celebration (Oud, Ney)", Pixabay, ID not recorded | Re-encoded: 3.8 MB -> 1.9 MB (MP3 128 kbps stereo, 44.1 kHz). Original: assets_raw/audio_original/ending_greatwin.mp3. |

## Audio credits (all files)

Every Pixabay source used in the game, all under the Pixabay Content License (no attribution required). Several sounds were trimmed or edited (mp3cut.net, Audacity), and the music was re-encoded for size.

| artist | title | Pixabay ID | used for |
| --- | --- | --- | --- |
| djovan | Sahara Sunset - Oriental Relax Ambiance (Desert Flute) | not recorded | title music |
| 38326398 | Mach Piano | 301972 | ending music (win) |
| ashot_danielyan | Sad Duduk - Middle Eastern Ambient Soundtrack | not recorded | ending music (lose) |
| soundsbyamelia | Ancient Egyptian Celebration (Oud, Ney) | not recorded | ending music (great win) |
| freesound_community | Footsteps on Wooden Flooring | 6878 | footsteps |
| freesound_gamestudio | Drop Coin | 384921 | coin |
| alexzavesa | Boards Fall 2 | 468368 | sign fall |
| freesound_community | Sniffing | 40300 | smell |
| universfield | Pouring Water into Glass | 116975 | pour |
| freesound_community | Bottle Clink | 101000 | bottle |
| vadim_makes_sound | Soft App Button Tap Sound 5 | 547873 | click |
| freesound_community | Birds in the Morning | 53615 | morning ambience |
| scratchonix | Glitter Sparkle | 423283 | mix / deliver sounds (exact file not recorded) |
| dragon-studio | Register Cha-Ching | 376896 | mix / deliver sounds (exact file not recorded) |
| subhamita | Evening Sound Effect in Village | 348670 | evening ambience |
| alex_jauk | Countryside Ambience Night Nearby Road | 234023 | evening ambience |

- [ ] Pour stream must start exactly at the bottle mouth for round and square bottles (droppers are fine): compute the mouth point per texture and rotate it with the tilt.
- [ ] Idea: open the cork or lid of round and square bottles during a pour (separate stopper sprite cropped from the texture, lifts away and returns).
- [ ] Rework how the chosen drops are shown (the six slot circles): current look and position feel poor, decide later.
- [ ] Notebook: replace the code-drawn book on the counter with a generated image and polish the panel.

## Compression (before the jam release)
All pictures and music were compressed with `node scripts/compressAssets.mjs` (sharp for PNG palette ~85 and JPG q80, ffmpeg for music over 1 MB to 96 kbps; the three player portraits and the master portrait were also scaled down because they are shown much smaller than their file). The script always compresses from the untouched originals in `assets_raw/originals_before_compress/` (git-ignored; the originals are also in git history), so it can be run again safely. Assets total 27.2 MB -> 12.7 MB.
