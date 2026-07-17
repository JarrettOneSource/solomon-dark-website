// The console grimoire. The mod loader exposes a Lua `sd.*` API in-game, so
// the site exposes one to anybody who opens the inspector. Every spell routes
// through the bus; the return strings are the console's reply.

import { castSpell, onSpell } from './bus'
import type { SpellKind } from './bus'
import { playSound } from './sounds'
import { TRACKS, currentTrack, isHumming, requestTrack } from './jukebox'

export const ATTUNEMENT_KEY = 'sdr:attunement'

/** Trail palettes per skill element: [main rgb, spark rgb]. */
export const ELEMENT_PALETTES: Record<string, [[number, number, number], [number, number, number]]> = {
  arcane: [[65, 227, 255], [240, 212, 145]],
  fire: [[255, 122, 40], [255, 214, 96]],
  water: [[70, 150, 255], [180, 235, 255]],
  earth: [[140, 200, 90], [200, 170, 110]],
  air: [[225, 240, 255], [160, 220, 255]],
  mind: [[196, 120, 255], [255, 170, 235]],
  body: [[255, 84, 84], [255, 180, 140]],
  ether: [[255, 120, 215], [255, 200, 240]],
}

const SUMMONS = ['imp', 'spider', 'wisp', 'flame'] as const
const CASTS = {
  fireball: 'fireball',
  wisp: 'etherWisp',
  orb: 'cyanOrb',
  bolt: 'purpleBolt',
  lance: 'frostLance',
} as const satisfies Record<string, SpellKind>

const CAST_REPLIES: Record<SpellKind, string> = {
  fireball: 'Fireball away. Mind the thatch.',
  etherWisp: 'An ether wisp departs for fieldwork. Its supervisor was not consulted.',
  cyanOrb: 'A cyan orb has been released. The risk assessment remains theoretical.',
  purpleBolt: 'The purple bolt is away. Tenure remains unlikely.',
  frostLance: 'A frost lance crosses the grounds. Heating will invoice your department.',
}

const BANNER = String.raw`
      ___
     /   \      SOLOMON DARK REVIVED
    | () () |     the grimoire is open
     \  ^  /
      |||||    Type sd.help() — quietly.
      |||||    The Librarian is easily startled.
`

export function installGrimoire() {
  if ((window as unknown as { sd?: unknown }).sd) return

  let bloodMoon = false
  onSpell((event) => {
    if (event.spell === 'bloodmoon') bloodMoon = event.on
  })

  const sd = {
    help() {
      console.log(
        'CASTS\n' +
          '  %csd.cast("fireball")%c     fireball · wisp · orb · bolt · lance (dashboard)\n\n' +
          'SUMMONS\n' +
          '  %csd.summon("imp")%c        imp · spider · wisp · flame (dashboard)\n\n' +
          'RITES\n' +
          '  %csd.attune("fire")%c       re-tint your wand trail (any of: ' +
          Object.keys(ELEMENT_PALETTES).join(', ') +
          ')\n' +
          '  %csd.midnight()%c           ring the midnight class bell\n' +
          '  %csd.bloodmoon()%c          revise the moon (dashboard)\n' +
          '  %csd.unholy()%c             invoke the forbidden curriculum\n' +
          '  %csd.gameover()%c           you would not be the first\n\n' +
          'VISITATIONS\n' +
          '  %csd.spider()%c             request an arachnid inspection (site-wide)\n' +
          '  %csd.wave(3)%c              call 1–5 crawlers; omit for chance (site-wide)\n' +
          '  %csd.solomon()%c            summon the Headmaster in person (site-wide)\n' +
          '  %csd.tome()%c               loosen one volume from the stacks (Library)\n\n' +
          'THE JUKEBOX\n' +
          '  %csd.jukebox("academy")%c  request a song from the Magic Jukebox\n\n' +
          'The Librarian is watching. Try not to become a footnote.',
        ...Array(24)
          .fill(0)
          .map((_, i) => (i % 2 ? 'color:inherit' : 'color:#41e3ff;font-weight:bold')),
      )
      return 'The full grimoire is in the Library. This is merely the syllabus.'
    },
    cast(what: string = 'fireball') {
      const spell = CASTS[what as keyof typeof CASTS]
      if (!spell) {
        return `You have not studied "${what}". The College suggests remedial coursework.`
      }
      castSpell({ spell: 'cast', what: spell })
      playSound('castFire')
      return CAST_REPLIES[spell]
    },
    summon(what: string = SUMMONS[Math.floor(Math.random() * SUMMONS.length)]) {
      if (!(SUMMONS as readonly string[]).includes(what)) {
        return `Nothing called "${what}" answers. Perhaps it knows better.`
      }
      castSpell({ spell: 'summon', what: what as (typeof SUMMONS)[number] })
      playSound('summon')
      return `${/^[aeiou]/.test(what) ? 'An' : 'A'} ${what} shuffles in from beyond the veil.`
    },
    attune(element: string) {
      if (!ELEMENT_PALETTES[element]) {
        return `"${element}" is not one of the eight disciplines. See sd.help().`
      }
      localStorage.setItem(ATTUNEMENT_KEY, element)
      castSpell({ spell: 'attune', element })
      playSound('attune')
      return `Your wand hums with ${element}.`
    },
    midnight() {
      castSpell({ spell: 'midnight', source: 'console' })
      return 'The bell tolls for you, specifically.'
    },
    bloodmoon() {
      const on = !bloodMoon
      castSpell({ spell: 'bloodmoon', on })
      return on
        ? 'The moon has taken the red chair. The faculty will pretend this was scheduled.'
        : 'The moon resumes its pallor. The minutes will omit the incident.'
    },
    spider() {
      castSpell({ spell: 'spider' })
      return 'A spider descends for office hours. It has tenure.'
    },
    wave(n?: number) {
      const count = n === undefined ? undefined : Math.min(5, Math.max(1, Math.trunc(n)))
      castSpell(count === undefined ? { spell: 'wave' } : { spell: 'wave', count })
      return count === undefined
        ? 'A crawler cohort has been assigned fieldwork. The ethics form was misplaced.'
        : `${count} crawler${count === 1 ? ' has' : 's have'} been assigned fieldwork. The ethics form was misplaced.`
    },
    solomon() {
      castSpell({ spell: 'scurry' })
      return 'Solomon has been called into the corridor. He denies being enrolled.'
    },
    tome() {
      castSpell({ spell: 'tomefly' })
      return 'A tome has left the Library unsupervised. Its citations are impeccable.'
    },
    unholy() {
      document.documentElement.dataset.unholy = '1'
      window.dispatchEvent(new Event('sdr:unholy'))
      playSound('levelup', 0.3)
      castSpell({ spell: 'midnight', source: 'console' })
      return 'The College is now officially unholy. Accreditation remains pending.'
    },
    jukebox(key?: string) {
      if (!key) {
        const now = currentTrack()
        return (
          (now && isHumming()
            ? `Now humming: ${now}. `
            : now
              ? `${now} is on the stand, awaiting your first note. `
              : 'The College is silent. ') +
          `Request one of: ${TRACKS.map((t) => t.key).join(', ')}.`
        )
      }
      const name = requestTrack(key)
      return name
        ? `The College obliges: ${name}.`
        : `No song called "${key}" in the Magic Jukebox. sd.jukebox() lists them.`
    },
    gameover() {
      castSpell({ spell: 'gameover' })
      playSound('skellyScream', 0.2)
      return 'Careless fool.'
    },
  }

  ;(window as unknown as { sd: typeof sd }).sd = sd

  console.log(
    '%c' + BANNER,
    'color:#c8a862;font-family:monospace;text-shadow:0 0 6px rgba(200,168,98,.5)',
  )
}
