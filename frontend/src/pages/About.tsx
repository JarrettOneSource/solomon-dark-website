import { Link } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { art } from '../lib/assets'

const HALL_OF_FAME = [
  'Basilo, Lord of Ice',
  'Catsillas',
  'Dovida',
  'Pastartes',
  'Pepperlunatic',
  'S H A D O W',
  'Soggy',
  'viva',
  'Vivian (Vlad)',
  'fnanfne',
  'jonishandsomebutimshysoidontwant',
  'raptisjr',
  'RodentRacer',
  'Snackers',
  'Solobot',
  'solomonest the unorthodox',
  'Spookmiser',
  'Xmathew',
  'et ux.',
]

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <div className="kicker mb-1.5">Dossier · mostly declassified</div>
        <h1 className="h-display text-3xl">The Revival Story</h1>
      </Reveal>

      <Reveal delay={100}>
        <div className="prose-sdr mt-6 text-[15.5px]">
          <blockquote>
            “Have you heard the name Solomon Dark? Yes? Well, our Solomon Dark is
            beginning to make a bit of a mess.” — the Archchancellor
          </blockquote>

          <h2>The game that never shipped</h2>
          <p>
            In April 2010, Raptisoft’s <em>Solomon’s Keep</em> put a wizard college, a
            dread tower, and a necromancer named Solomon Dark into pockets everywhere.{' '}
            <em>Solomon’s Boneyard</em> followed that September — leaner, meaner,
            endless. Then came the promise of a third game: <em>Solomon Dark</em>, the
            big one, where the College finally sends a fourth-circle wizard of its own
            faculty to settle the matter.
          </p>
          <p>
            It never arrived. A year-long patent problem drained the joy out of the
            project, and in February 2015 Raptisoft declared it dead. On Halloween
            2016 the unfinished Windows build was briefly released — fans mirrored
            it, and a community archive now preserves builds 0.71.0, 0.72.0, and
            0.72.5 while the tower on Mount Awful stands dark.
          </p>

          <h2>The resurrection</h2>
          <p>
            Solomon Dark Revived is a community project that raises the beta from the
            dead, properly: a mod launcher, an embedded Lua runtime with the{' '}
            <span className="font-mono text-sm">sd.*</span> API for community mods,
            and — the headline act — <strong>Steam multiplayer</strong>, rebuilt into
            a game that never had it.
          </p>
          <ul>
            <li><strong>Classes in Session</strong> — a live master list of multiplayer matches.</li>
            <li><strong>The Library</strong> — community mods, uploaded and versioned.</li>
            <li><strong>The Annals</strong> — SDR accounts with cloud saves synced from the loader.</li>
            <li>
              <strong>Steam P2P</strong> — host and invite friends directly, with no
              website or account in the loop. The fray is built to outlive its caretakers.
            </li>
          </ul>

          <h2>Credits &amp; thanks</h2>
          <ul>
            <li><strong>Raptisoft</strong> — for the games. This is a love letter, not a heist.</li>
            <li><strong>The preservation community</strong> — for keeping the builds alive.</li>
            <li><strong>The SDR modding project</strong> — loader, launcher, Lua runtime, multiplayer.</li>
          </ul>
          <p>
            Sources:{' '}
            <a href="https://github.com/JayMcArthur/Raptisoft-Solomon" target="_blank" rel="noreferrer">
              the preservation archive
            </a>
            . The loader’s own code goes public when the seal breaks.
          </p>

          <div className="panel panel-ornate my-10 p-6 sm:p-8">
            <div className="kicker mb-1.5">The revival’s Hall of Fame</div>
            <div className="h-display text-lg">The Most Dedicated Students</div>
            <p className="text-fell mt-2 text-sm text-bone-dim">
              Beta testers, bug reporters, and the students who kept attending a
              cancelled class. The Annals remember.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {HALL_OF_FAME.map((name) => (
                <span
                  key={name}
                  className="slab rounded px-3 py-1.5 font-display text-[12px] font-bold tracking-wider text-bone transition-colors hover:text-gold-bright"
                >
                  {name}
                </span>
              ))}
            </div>
            <a
              href="https://discord.gg/HGHxZgyM2p"
              target="_blank"
              rel="noreferrer"
              className="btn btn-gold mt-6 !text-[#1c1508]"
            >
              Join the College Discord ↗
            </a>
          </div>

          <h2>The fine print</h2>
          <p>
            Solomon Dark Revived is a fan preservation project and is not affiliated
            with or endorsed by Raptisoft. All original game content remains ©
            Raptisoft. If you are Raptisoft and would like anything changed, removed,
            or personally apologized for, we will comply with unseemly haste.
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded border border-gold/15 bg-[#0b0910] p-6">
          <div>
            <div className="h-display text-base">Ready to dig?</div>
            <p className="text-fell mt-1 text-sm text-bone-dim">The dead are waiting. They’re patient like that.</p>
          </div>
          <div className="flex flex-none gap-3">
            <span
              aria-disabled="true"
              title="Not yet released — the seal holds."
              className="btn btn-gold cursor-not-allowed select-none opacity-45"
            >
              Download
            </span>
            <Link to="/mods?type=boneyard" className="btn btn-stone">
              Boneyards
            </Link>
          </div>
        </div>
      </Reveal>

      <img src={art.gateIron} alt="" className="mx-auto mt-16 h-40 opacity-25" />
    </div>
  )
}
