# Solomon Dark Revived — Design Document

> Working design doc for the SDR website. Dumped from the initial research session
> (game asset dig + series lore research), kept up to date as the site evolves.

## 0. Revision log

**2026-07-16, round 2 (Jarrett's live review):**

- Multiplayer sessions are now **"Classes in Session"** (`/classes`). The word
  *Boneyard* is reserved for the in-game feature (downloadable runs) — on the
  site it's the name of the run a match is playing, shown per row. A future
  "Boneyards" download page is a natural addition when that feature lands.
- Match rows: host player + boneyard + seats. **No addresses.** Connect fires
  `sdr://join/{sessionKey}` (placeholder scheme until the loader registers its
  handler). The loader will publish matches itself; no host-your-own docs on
  the site.
- **SSE everywhere the matches appear** (`/api/matches/events`, EventSource on
  the client) — polling and the "refreshes every 15s" label are gone. The
  in-game multiplayer tab consumes the flat `GET /api/matches/game` list.
- **Mod types removed** (overlay/lua/native/hybrid) — native DLLs won't be
  supported (unpoliceable malice vector), so the taxonomy is pointless. Mods
  install one-click via `sdr://install/{slug}`; manual zip download remains.
- Hero rebuilt to mirror the actual main menu (see imgur ref): cowl on the
  LEFT with the title screen's 3-frame cloth-wave animation + thin slitted
  eyes, moon right, plaque-style CTAs flanked by the gold flourish columns,
  corner "V.0.72.5 BETA" tag. Cowl frames get baked dark interiors + edge
  fades + a black backdrop pool (the sprite is an opaque near-black box).
- Copy: removed "never touches your original files" everywhere, removed
  endpoint dev-speak from the Annals, removed profile tome/save counts.
  Steam P2P is messaged as the site-independent fallback pipeline ("the fray
  outlives its caretakers").
- Timeline fact-checked with sources (docs/timeline-factcheck.md): cancelled
  Feb 2015, one-day Halloween 2016 beta release, community archive est. 2022,
  SDR public workspace 2026.
- Discord permalink in the footer: https://discord.gg/HGHxZgyM2p

**2026-07-16, round 3:**

- Match model v4: **no Version / ModLoaderVersion anywhere** (sessions are
  homogeneous), new required `status` — `"hub"` (pre-game lobby, arcane-cyan
  orb, "In hub") or `"session"` (moss orb, "In session"). Matches that stop
  announcing for 120s are **hard-deleted** — no stale/adjourned state, no
  includeOffline, no "Last seen" column. Table is now Status / Host /
  Boneyard / Wizards / Connect.
- About page gained the **Hall of Fame** panel — beta testers & "most
  dedicated students" name chips + Discord CTA.
- Fact-check tightenings: "patent problem" (source wording), beta "briefly
  released" (exact window unverified).
- Hero eyes REMOVED (they read silly at web scale) — the cowl is a faceless
  void for now. Jarrett will decompile how the game assembles its menu
  composite (layer order/offsets/animation timing) so we can replicate the
  native assembly properly; revisit then. The 404's blinking eyes stay.

**2026-07-16, round 8 (the ambient wave — orchestrated Codex build):**

- Jarrett's direction: he orchestrates nothing, Codex agents implement, I
  art-direct and integrate. Three agents ran: extraction (Solomon's 6-pose
  walk from Solomon.bundle — a 15-heading bank, breaking the usual 18;
  spell projectiles: 5-frame ether wisp, 12-frame cyan orb, purple bolt,
  frost lance; verdict that no multi-frame fireball exists in the game),
  ambient-spells (Haunts rework), and the Solomon cameo.
- **Ambient spell casts** replace the predictable fireball: five spells fly
  BOTH directions at random shallow inclines (rotated to face travel),
  varied altitude/speed/scale, gentle drift, one cast every 9–20s, max two
  aloft; ~30% of fireballs and frost lances detonate mid-flight (seeded
  spin/mirror per house policy). The agent's pixel inspection caught that
  the round-3 fireball had flown BACKWARD (tail-first) since it shipped.
- Critter review pass: crawler brightened (1.12 + faint bone glow), tomes
  fly inclined (±15°) with scale variance, a click-race fixed.
- **Solomon scurries across the website**: 18% roll per page visit with an
  8-minute cooldown → 15–75s later he crosses the bottom of the viewport
  in 9–14s (WAAPI, brisk 0.55s stride), pauses mid-way on his stand frame,
  continues; clicking him poofs him in the game's flash with poof.wav.
- Community soundtrack rip (Google Drive) evaluated: its .mo3 is
  SHA256-identical to ours — nothing new. But it corroborated the composer
  credit hiding in our module header: the Solomon Dark score is by
  **Peter "Skaven" Hajba of Future Crew** (2011–13). About-page material.

**2026-07-16, round 7 (Schools of Magic):**

- **The reserved element wordmarks found their purpose**: wizards declare a
  School of Magic in the Annals (fire · air · water · ether · earth — the
  five with click rites). Declaring re-tints the cursor trail AND arms a
  per-school click effect, and the school shows beside the wizard's name
  wherever authors appear (mod cards, tome pages, the Annals header).
- Click rites (fx/SchoolBursts.tsx, sprites via tools/extract-fx.py, all
  real BadGuys.png art found through the bundle metadata): fire = the game's
  4-frame fireball burst over its 8-frame concussion flash; air = a branched
  lightning bolt striking at a random bearing and distance; water = a frost
  ring expanding around the 10-frame ice-crystal shatter; ether = a purple
  orb departing decisively off screen; earth = a momentary pile of rubble
  (rotated boulder sprites). Undeclared guests can still join via
  sd.attune('<school>') — profile school wins when signed in.
- Backend REVISION 7: User.School (nullable, five canonical values),
  `PUT /api/auth/school`, school in user + mod author DTOs. Seeds: Sirmin
  declares fire, Griselda water.
- Volumes tuned per Jarrett: music low (0.09), UI ticks medium (hover 0.09,
  click 0.16). Bug fixed along the way: Tailwind preflight's
  `img { max-width: 100% }` collapsed effect sprites inside zero-width
  positioning wrappers to nothing — every burst img now carries max-w-none.
- A **"mouse effects" toggle** sits under the school picker in the Annals:
  one checkbox gating the wand trail and the click rites together,
  per-device (`sdr:no-mouse-fx`), applied live without a reload. Ether's
  trail is **pink** (rgb 255,120,215) to match its orb, per Jarrett.

**2026-07-16, round 6 (tome types, and the music opens the show):**

- **Mod types return — as content, not code.** Every tome is now `lua` (a
  script for the sd.* grimoire) or `boneyard` (a downloadable run for the
  game's Boneyard shelf). Backend spec REVISION 6: `Mod.Type` replaces tags,
  strict lowercase validation on create/patch, `type=` filter on the list
  endpoint, seeds retyped + three Boneyard runs added (Mount Awful — Endless,
  The Grimwood Gauntlet, The Old Cemetery — After Dark). The Library gained a
  shelf control (All Tomes / Lua / Boneyards), cards and details wear type
  badges (arcane for Lua, necro for Boneyard), and the upload form asks "What
  kind of tome is this?".
- **Schools-of-magic tagging is fully retired** (upload picker, card chips,
  detail row, ElementTag, backend TagsCsv — all gone). The element wordmark
  art stays extracted; Jarrett has a plan for those sprites.
- **Music now opens with the site.** Audible autoplay is browser-forbidden
  before a gesture, so the jukebox starts the track *muted at page load* and
  unmutes with a fade on the first click/keypress — walking in mid-song. With
  enough visit history Chrome allows it audibly from the first note.
- Mobile pass: match list renders as stacked cards below `md` (Connect was
  hiding off-canvas in the table's scroll area), the hero moon tucks smaller
  into the corner (it collided with the kicker), everything else verified
  overflow-free at 390px.
- The Boneyards gravestone epitaph now reads "now accepting residents."

**2026-07-16, round 5 (the jukebox):**

- Background music + UI sound, from the game itself. The whole score lives in
  one MO3 module (`music/music.mo3`, Impulse Tracker inside — hence the
  game's `bass.dll`) addressed by `music.txt` as the "Raptisoft Magic
  Jukebox": songs are order-list offsets, combat "tracks" are channel-mute
  layers. libopenmpt sees 12 subsongs; Codex built `tools/extract-music.sh`
  (render → silence-trim → loudnorm → mp3) for the ambient five. Curiosity
  for the community: the module contains a **13th, unlisted piece** (subsong
  index 11, order 134, ~31s) that `music.txt` never references — music the
  game can't play.
- `fx/jukebox.ts`: random track per visit, starts on the first user gesture
  (fade-in, loop, vol 0.14), ducks to near-silence while the tab is hidden,
  ♪ toggle in the header governs music + UI ticks together (persisted as
  `sdr:muted`). `sd.jukebox("academy")` requests songs from the console.
  UI ticks: the game's 16ms `click.wav` on hover of any interactive element
  (throttled), `backpack_close` thump on click, `parchment` on route change.
  `selection` (20s stinger) is extracted but kept out of the rotation.

**2026-07-16, round 4 (easter eggs):**

- Cracked the `.bundle` sprite-metadata format beside every atlas: 45-byte
  records (atlas rect, logical cell size, in-cell origin offset) + optional
  8-byte extras. Animation banks store 18 headings per pose consecutively, so
  a fixed-heading cycle is every 18th record — perfectly registered frames for
  free. `tools/extract-anims.py` parses it and emits horizontal frame strips
  (CSS `steps()` playback). First harvest: the boneyard crawler's 12-pose
  crawl and both spinning library tomes (18 frames each).
- Shipped an easter-egg layer across the whole site (see §11, "The secret
  syllabus"). Real game audio (converted to small mono mp3s) plays only from
  explicit user gestures, quietly; every motion egg respects
  prefers-reduced-motion.

## 1. What this site is

**Solomon Dark Revived (SDR)** is the community hub for the revival of Raptisoft's
lost game *Solomon Dark* — the long-awaited third Solomon game that was delayed,
publicly cancelled in 2016, and survived only as beta builds (0.71.0 → 0.72.5).
The modding project resurrects it with multiplayer, Lua modding, and a mod loader.

The site does four jobs:

1. **Tell the revival story** and route people to the download (beta zip) + GitHub.
2. **Server browser** — master list of dedicated/hosted multiplayer sessions.
3. **Mod library** — users upload/browse/download mods (zip, no validation in v1).
4. **SDR accounts** — register/login, upload mods under your name, cloud saves.

Stack: ASP.NET Core (net10) + SQLite/EF Core backend (Codex implements from spec),
Vite + React + TypeScript + Tailwind v4 front end (hand-written). Same
publish-and-restart deployment shape as 2b2m.org.

## 2. The vibe (research findings)

### Series lore we lean on

- Setting: the **Wizarding College**, near the town of **Dead Hawg**, past the
  **Grimwood**, at the peak of **Mount Awful** where Solomon Dark builds his
  Dread Tower. He's a College graduate gone necromancer ("he dressed entirely in
  black, with black eye liner… in retrospect those were probably bad signs, but
  this *is* a Wizarding College. And he did switch over to purple eventually.")
- In *Solomon's Keep* you're a graduating student whose **final exam** is to
  defeat him. *Solomon Dark* (the game) picks up after *Boneyard*: the College
  sends its brightest to "settle it."
- **Tone: gothic on the surface, Discworld underneath.** The games are funny —
  dry academic bureaucracy humor. The ethics textbook's entire content is
  "Don't get caught." Spells are "certified and decertified every few centuries."
  The Archchancellor asks you to "keep any property damage down to an absolute
  minimum." SITE COPY MUST MATCH THIS TONE — spooky visuals, wry words. Never
  grimdark-serious, never Marvel-quippy. Understated, bureaucratic, sardonic.
- The game that never shipped is now the game that came back. "Revived" is
  literal — necromancy joke writes itself and we should make it exactly once,
  prominently: **"A game raised from the dead."**

### In-universe naming glossary (use across the site)

| Site concept        | In-universe name (source)                                    |
|---------------------|--------------------------------------------------------------|
| Match browser       | **Classes in Session** (rev 2 — "Boneyards" turned out to be a distinct in-game feature; a match's *boneyard* is the run it's playing on) |
| Mod library         | **The Library** (College library w/ snarky librarian; books.txt) — mods are "tomes" |
| Account / profile   | **The Annals** — in-game chronicler immortalizes your deeds ("give me your name, speciality, et-cetera") |
| Cloud saves         | **Memoratorium** vibes (hall of portraits of fallen wizards) — save slots displayed like memorial portraits |
| Register            | "**Enroll at the College**" |
| Login               | "Return to your studies" |
| Loading states      | "FETCHING BONEYARDS" gold banner style; summoning-circle spinner |
| 404                 | Gold **GAME OVER** art + Solomon taunt ("Careless fool.") |
| Empty states        | Skull + dry one-liner ("Nothing here. How refreshingly tidy.") |

### Voice examples (copy style guide)

- Hero sub: "The lost Solomon game — raised from the dead. Multiplayer, Lua
  modding, and cloud saves for the beta Raptisoft never got to ship."
- Register page flavor: "The Annals await your name. Penmanship counts."
- Upload mod: "Contribute a tome to the Library. The Librarian assures us
  validation is 'almost completely nearly safe in virtually all circumstances.'"
- Footer: "Solomon Dark Revived is a fan preservation project, not affiliated
  with Raptisoft. Original game © Raptisoft. Please keep property damage down
  to an absolute minimum."

## 3. Visual system

### Palette (pulled from the actual art)

| Token          | Hex        | Source / use                                              |
|----------------|------------|-----------------------------------------------------------|
| `abyss`        | `#08070b`  | Page background — near-black, slight violet cast          |
| `crypt`        | `#121017`  | Panel background (dark leather texture in game UI)        |
| `stone`        | `#3a3d42`  | Carved stone buttons/bars (game's rune buttons)           |
| `gold`         | `#c8a862`  | THE brand color — logo gold, UI text gold ("LEVEL UP")    |
| `gold-bright`  | `#f0d491`  | Gold hover/highlights, headings glow                      |
| `bone`         | `#e6dcc3`  | Body text on dark (parchment/bone)                        |
| `arcane`       | `#41e3ff`  | Cyan summoning circle — links, focus, loaders, accents    |
| `necro`        | `#a43fd4`  | Solomon's robe purple — secondary accent, mod-type badges |
| `blood`        | `#c22b2b`  | Solomon's eyes — errors, offline dots, danger buttons     |
| `moss`         | `#69a153`  | Game health-bar green — success, online dots, player bars |

Rule: gold is chrome (headings, borders, CTAs), arcane cyan is interactive
energy (links, focus rings, particles), necro purple and blood red are garnish.
Dark surfaces always slightly warm/violet, never pure gray.

### Typography

- **Display / headings:** Cinzel (carved Roman caps ≈ the game's gold UI caps,
  "SELECT A SKILL"). Letter-spaced, gold, subtle dark emboss shadow.
- **Body:** Alegreya — warm bookish serif, reads like the in-game dialogue.
- **Flavor text / quotes:** IM Fell English Italic — old-print apothecary feel.
- **Mono (addresses, commands, versions):** JetBrains Mono.
- All self-hosted via @fontsource packages. No CDN fonts.
- The actual game logo is an image asset — use the real logo PNG in the hero,
  don't try to typeset "Solomon Dark" ourselves.

### Texture & surface language

- Panels: near-black leather/parchment (game dialog panels) with 1px gold-dust
  borders (`gold` at ~25% alpha) + corner ornaments on hero panels only.
- Buttons: carved stone slab look (the game's rune-bar buttons) — dark gradient,
  inset top-light bevel, gold serif label; hover = gold edge-glow + slight lift.
  Primary CTA variant: gold-plated ("BUY" stamp energy).
- Dividers: the gold pentagram-scroll flourish from UI.png, used sparingly.
- Scrollbar: thin, gold-on-abyss custom.

## 4. Signature effects (the "rad" list)

1. **Wand cursor trail** — canvas particle system following the pointer: arcane
   cyan motes w/ additive glow, short life, slight upward drift + flicker; every
   ~12th particle is a gold spark. Click = small burst ring ("cast"). Buttons and
   cards emit a gentle spark on hover. `prefers-reduced-motion` → disabled;
   touch devices → disabled. Cheap: one canvas, pooled particles, rAF.
2. **Hero: Solomon overlooking the dashboard** — layered parallax composite
   built from real Title.png pieces:
   - L0 sky: night-cloud strip (Title atlas) drifting on a slow loop
   - L1 moon (Title atlas) w/ soft bloom
   - L2 SOLOMON: hooded-figure frames from Title atlas, scaled large, anchored
     right, dark-veiled at the bottom; **red eyes (Title atlas) composited in,
     pulsing on a slow CSS animation** — he literally watches over the page
   - L3 gravestone row + grass silhouette strip along the hero bottom
   - L4 fog: two translucent fog layers (procedurally generated tiling noise
     PNG) sliding at different speeds
   - Mouse parallax: each layer translates a few px against pointer (desktop
     only), so Solomon subtly *turns his attention* as you move
   - Real SOLOMON DARK gold logo + "REVIVED" set beneath it in Cinzel, with a
     one-time gold shimmer sweep on load
3. **Summoning-circle loader** — the cyan arcane circle from UI.png, spinning
   slowly with a counter-rotating inner ring, used for all async loading.
4. **"FETCHING BONEYARDS" banners** — loading states on the server list use the
   game's actual gold banner styling (and, on the servers page, its literal text).
5. **Level-up stat tiles** — dashboard stats (servers online / wizards online /
   tomes in the library / saves synced) as gold-framed slot tiles (Skills.png
   empty frames) with Cinzel numerals and a small gold-arrow tick animation when
   a number increases.
6. **Scroll-reveal** — sections fade/rise in via IntersectionObserver, with the
   gold flourish divider drawing in. Subtle; 300ms; no bounce.
7. **Red-eyes 404** — pitch black page, two blinking red eyes, gold GAME OVER
   art, line: "Careless fool." + [Return to the College] button.
8. **Konami-ish easter egg (backlog)** — typing "solomon" anywhere summons a
   taunt voice line + eyes flash. (Voice WAVs exist: SAY_ACCEPTYOURFATE,
   SAY_FACETHEWRATH, SAY_CARELESSFOOL…) — v1.1, needs an audio-consent toggle.

## 5. Asset extraction map

Source: `<path-to-preserved-repo>/Solomon Dark/SolomonDarkBeta_0.72.5/images/`
(loose PNG atlases + .bundle binary rect metadata — little-endian float records).
Extract with ImageMagick crops into `frontend/src/assets/game/`.

| Asset                         | Source atlas   | Use                                   |
|-------------------------------|----------------|----------------------------------------|
| SOLOMON DARK gold logo        | Title.png      | Hero, navbar (small), OG image         |
| "RAPTISOFT GAMES PRESENTS"    | Title.png      | Not used on site (trademark-adjacent); keep extracted for reference only |
| Hooded Solomon frames (~6)    | Title.png      | Hero figure (pick best frame), 404     |
| Red glowing eyes              | Title.png      | Hero (pulsing), 404, easter eggs       |
| Moon                          | Title.png      | Hero L1                                |
| Tombstones/obelisk/crosses    | Title.png      | Hero L3, empty states, section décor   |
| Night clouds strip            | Title.png      | Hero L0                                |
| Grass silhouette strip        | Title.png      | Hero bottom edge                       |
| Arcane summoning circle       | UI.png         | Loader, hero accent behind logo        |
| Stone rune buttons (3 sizes)  | UI.png         | Button backgrounds (9-slice-ish)       |
| Gold banner ("FETCHING…")     | UI.png         | Loading banners, toasts                |
| Gold flourish + pentagrams    | UI.png         | Section dividers                       |
| Gold skull / white skull      | UI.png         | Empty states, footer mark, favicon     |
| LEVEL UP wordmark             | UI.png         | Account level-up moments (backlog)     |
| Chain strip                   | UI.png         | Table header décor (maybe)             |
| Skill stamp icons (~40)       | Skills.png     | Mod category icons, feature cards      |
| Element wordmarks (8)         | Skills.png     | Mod tag badges (body/ether/earth/fire/mind/water/air/arcane) |
| Empty slot frames (3)         | Skills.png     | Stat tiles, avatar frames, save slots  |
| GAME OVER wordmark            | GameOver.png   | 404 page                               |
| Wizard hats/NPC sprites       | College.png    | Avatars (backlog), community section   |
| Hooded wizard statue          | UI.png         | Sidebar décor on docs/about            |
| Parchment scrap               | College.png    | Inline "note" callouts                 |

Also: `data/magenames.txt` (200+ mage names) → **"Suggest a name" button on
register** pulls a random authentic mage name. `data/dialogue/*.txt` → copy
inspiration. Voices → easter egg backlog. Music (music.mo3) → NOT used (web
audio autoplay is obnoxious).

Fog: generate two tiling fog PNGs ourselves (ImageMagick plasma/noise + blur)
— nothing suitable in the atlases.

## 6. Pages & layout

Shared shell: sticky top nav — small gold logo left; links: Home, Boneyards
(servers), Library (mods), About; right: Download CTA (gold) + account chip
(login / wizard name). Nav underline = thin gold rule that lights arcane-cyan
on the active route. Footer: skull mark, disclaimer copy, GitHub link,
"a fan preservation project."

### Home (`/`)
1. **Hero** (~92vh): the Solomon parallax composite (see §4.2). Left column:
   logo, "REVIVED" subtitle, two CTAs — [Download the Beta] (gold, primary) +
   [Read the Revival Story] (stone). Under CTAs: version chip `beta 0.72.5 ·
   mod loader v0.1.0-beta.3` in mono.
2. **Live stats strip**: 4 slot-frame tiles (Boneyards open, Wizards online,
   Tomes in the Library, Saves in the vault), polled from `/api/stats`.
3. **"The Revival" section**: 3 feature cards w/ skill-stamp icons —
   Multiplayer ("Bring a study group"), Lua Modding ("The sd.* grimoire"),
   Cloud Saves ("The Annals remember"). Each links deeper.
4. **Live Boneyards preview**: top 5 servers table + [See all Boneyards].
5. **Fresh from the Library**: 4 newest mods as tome cards + [Enter the Library].
6. **The story so far**: short revival timeline (2016 cancellation → beta
   preservation → mod loader → multiplayer beta → you are here), IM Fell
   flavor, links to GitHub/README.
7. Footer.

### Boneyards (`/servers`)
- Header: "SELECT A BONEYARD" in game-style gold caps.
- Toolbar: search, version filter, "only open seats" toggle, auto-refresh
  indicator (15s poll; the refresh tick pulses the summoning circle icon).
- Table rows (stone slabs): status orb (moss/blood), name, host:port + copy
  rune button, players as mini health-bar (moss fill), version chip, mode/notes.
- Loading state: literal "FETCHING BONEYARDS" gold banner.
- Empty: "No boneyards are open. Solomon rests… for now."
- Side panel: **Host your own** — quickstart instructions block (mono),
  heartbeat endpoint documented, link to GitHub docs.

### Library (`/mods`, `/mods/:slug`, `/mods/upload`)
- Index: search + filters (loader type: Overlay/Lua/Native/Hybrid; sort:
  newest/most downloaded). Tome cards: thumbnail (or skull placeholder),
  name, author, one-liner, downloads count w/ tiny download rune, type badge
  (necro purple) + element badge if tagged.
- Detail: title block w/ author + version + updated date; screenshots strip;
  markdown-ish description; changelog list; big gold [Take This Tome] download
  button (BUY-stamp energy); "requires mod loader ≥ X" chip.
- Upload (auth): drag/drop zip (v1: any zip ≤ 100MB, no validation — per
  Jarrett), name, slug (auto), summary, description, type, version, optional
  screenshots (≤5 png/jpg ≤2MB). Librarian flavor text about "cataloguing
  standards" being deferred.

### Enroll / Sign in (`/register`, `/login`)
- Centered dialog panel styled like the game's dark dialog boxes w/ gold
  border. Register: username ("mage name") + **Suggest** button (magenames.txt),
  email, password. Flavor: "The Annals await your name."
- Login: "Return to your studies."

### The Annals (`/account`)
- Profile slab: wizard name, join date, mod count, save count.
- **Cloud saves**: grid of save slots as Memoratorium portrait frames — slot
  name, byte size, updated-at, download / delete. (Game integration uploads via
  API; site is read/manage.) Empty slots show dust + "Unwritten."
- **My tomes**: manage own mods (edit metadata, upload new version, delete).

### 404
- Red eyes + GAME OVER + "Careless fool." + return button.

### About / Revival story (`/about`)
- Longform: what Solomon Dark was, what happened (2016 cancellation), what the
  revival adds, credits (Raptisoft love letter, modding project, JayMcArthur
  preservation repo), legal/disclaimer note, GitHub links, roadmap.

## 7. Backend (Codex implements; summary — full spec in docs/backend-spec.md)

- ASP.NET Core net10 minimal APIs, EF Core + SQLite (`data/sdr.db`),
  `EnsureCreated` (no migrations in v1), file storage on disk under `data/`.
- Auth: SDR accounts — username+email+password (PBKDF2/Identity hasher), JWT
  bearer (7d) for site + future game client. No email verification in v1.
- Entities: User, Mod, ModVersion, Screenshot, GameServer, CloudSave.
- Endpoints: /api/auth/{register,login,me}; /api/mods CRUD + zip upload +
  download (counts); /api/servers + /api/servers/announce heartbeat (servers
  expire from "online" after 120s silence); /api/saves/{slot} get/put/delete
  (8 slots, ≤1MB each in v1); /api/stats.
- Server announce: open (no key) in v1 + per-IP rate limit; revisit later.
- Seed data in dev so the site never demos empty.
- Serves built SPA from wwwroot w/ fallback; /api 404s never fall back to HTML.

## 8. Build order

1. Scaffold repo (backend + frontend + this doc). ✅ (in progress)
2. Backend spec → Codex in background.
3. Asset extraction pass (ImageMagick) while Codex runs.
4. Front end: theme/tokens → shell/nav → Home hero (the centerpiece; iterate
   in browser w/ screenshots) → stats/sections → Boneyards → Library →
   auth/Annals → 404/About → polish pass (motion, a11y, responsive).
5. Review Codex output, integrate, seed, end-to-end in browser.
6. Commit. Deploy story TBD w/ Jarrett (likely this box + systemd + reverse
   proxy like 2b2m).

## 9. Open questions (for Jarrett)

- Domain + hosting (this box next to 2b2m? nginx/caddy in front? TLS?).
- Server announce: HTTP heartbeat OK for the loader, or does the game need a
  UDP query protocol? Any auth for announcing?
- Cloud save size/slot limits (defaulting 8 slots × 1MB).
- Where should the beta zip download live — GitHub Releases link or hosted here?
- Discord/community links for the footer + community section?
- Email verification / password reset — v1 has neither; OK?

## 10. Non-goals for v1

- No mod zip validation/virus scanning (explicitly deferred by Jarrett).
- No email flows, no OAuth, no admin dashboard (manage via DB for now).
- No SEO prerender layer yet (add when deployed, 2b2m-style).
- No in-page game music. We have taste.

## 11. The secret syllabus (easter eggs)

All real game assets and sounds. Rules of the layer: **audio only ever plays
from an explicit user gesture** (click/keypress), at low volume; every motion
egg is disabled under `prefers-reduced-motion`; nothing here blocks or delays
a real interaction. Infrastructure: `fx/bus.ts` (CustomEvent spell bus),
`fx/sounds.ts` (game wavs → ~76KB of mono mp3s), `fx/grimoire.ts`,
`fx/Overlays.tsx` (site-wide, mounted in the Shell).

| Egg | Where | What |
| --- | --- | --- |
| **The console grimoire** | everywhere | Open devtools: an ASCII skull announces `window.sd` — a mock of the loader's Lua API. `sd.help()`, `sd.cast('fireball')`, `sd.summon('imp'\|'spider'\|'wisp'\|'flame')`, `sd.attune('<element>')`, `sd.midnight()`, `sd.gameover()`. Replies are in-universe; wrong inputs get remedial-coursework sass. Modder bait. |
| **Konami code** | everywhere | ↑↑↓↓←→←→BA — levelup sting, the **MIDNIGHT** caption (UI.png, alpha-ized) slams over a darkened page with a wisp surge, and the hero's corner tag reads **V.6.66 BETA · UNHOLY** for the session. |
| **The midnight bell** | everywhere | At local 00:00 the same MIDNIGHT event fires on its own — an homage to Boneyard's real-time midnight tradition. Silent unless the user has already interacted (autoplay rules; the bell is polite). |
| **Attunement** | everywhere | `sd.attune('fire')` re-tints the cursor trail to any of the eight disciplines (persisted in localStorage — your wand remembers). |
| **Boneyard crawler** | dashboard hero | Every minute or three, a skeleton drags itself across the graveyard fog line — the real 12-pose crawl cycle from BadGuys.png, heading-locked via bundle offsets. Click it: `skeleton_die.wav`, and it sinks back into the earth. |
| **Escaped tomes** | The Library | The game's spinning spellbooks (blue/red, 18-frame tumbles) occasionally fly across the stacks behind the shelves. |
| **Gravestone epitaphs** | dashboard hero | Hover any tombstone: a plaque names the resident. Lucritius the Fire Mage, Athicus the Diviner, Magnus the Unprepared (canon names, per the lore audit), "Reserved.", the beta testers ("they knew the risks"), a Boneyards-page tease — and the obelisk: **Solomon Dark, 2015–2016, did not stay buried.** |
| **Blood moon** | dashboard hero | Click the moon three times: it turns red (thunder rolls), the sky bleeds, and the haunt traffic roughly triples. Three more clicks to put it back. |
| **The idle spider** | everywhere | ~70–115s of stillness and a spider abseils from the top of the viewport, sways, gets bored after 45s. Any input sends it scuttling up; clicking it drops it off the page (bonecrack). |
| **Tab necromancy** | everywhere | Background the tab and the title becomes "☠ The class continues without you…" (rotating lines). Focus restores it. |
| **Reserved magenames** | Enroll | Trying to register `solomon`, `raptisoft`, `generic`, `librarian`, `dean`… gets an in-universe refusal ("That name belongs to the Archivist. He is watching this form."). Client-side flavor only. |
| **The TAKE stamp** | tome pages | "Take This Tome" slams the game's actual TAKE / CLICK AGAIN confirmation stamp over the button (+`magicbookget` chime) while the install link fires. |
| **You get nothing** | 404 | Clicking the GAME OVER art plays `YouGetNothing__Stream.wav`. That's it. That's the reward. |

Future material already scouted (not built): Faculty ghost drift-bys, the
pitchfork villager "!" bubble, Demon/Golem boss cameos — all extractable with
`tools/extract-anims.py` once a use earns its keep. (Solomon's walk cycle
became the scurry cameo; the title-menu Solomon now watches the dashboard
from fx/MenuSolomon.tsx, rebuilt from the /root/main-menu-solomon-visual-re
decompile.)
