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
            Raptisoft released <em>Solomon’s Keep</em> in April 2010 and{' '}
            <em>Solomon’s Boneyard</em> that September. A third game,{' '}
            <em>Solomon Dark</em>, would send a fourth-circle wizard from the
            College to confront Solomon on Mount Awful.
          </p>
          <p>
            In 2015, Raptisoft confirmed it had stopped work on the game after a
            patent dispute. The unfinished Windows beta was briefly released on
            Halloween 2016. Fans saved
            copies, and the preservation archive holds builds 0.71.0, 0.72.0, and
            0.72.5.
          </p>

          <h2>Solomon Darker</h2>
          <p>
            Solomon Darker is a community project rebuilding the game for browsers.
            Play with other wizards, share Lua mods and custom Boneyards through the
            Dark Cloud, and keep your progress with cloud saves.
          </p>

          <h2>Credits &amp; thanks</h2>
          <ul>
            <li><strong>Raptisoft</strong> — for creating the Solomon games.</li>
            <li><strong>The preservation community</strong> — for keeping the builds alive.</li>
            <li><strong>The Solomon Darker project</strong> — for rebuilding the game and its community tools.</li>
          </ul>
          <p>
            Sources:{' '}
            <a href="https://www.raptisoft-forums.com/discussion/2/new-forums" target="_blank" rel="noreferrer">
              Raptisoft’s 2015 update
            </a>,{' '}
            <a href="https://www.raptisoft-forums.com/discussion/230/solomon-dark-beta" target="_blank" rel="noreferrer">
              the beta announcement
            </a>, and{' '}
            <a href="https://github.com/JayMcArthur/Raptisoft-Solomon" target="_blank" rel="noreferrer">
              the preservation archive
            </a>
            .
          </p>

          <div className="panel panel-ornate my-10 p-6 sm:p-8">
            <div className="kicker mb-1.5">The revival’s Hall of Fame</div>
            <div className="h-display text-lg">The Most Dedicated Students</div>
            <p className="text-fell mt-2 text-sm text-bone-dim">
              Thanks to the players who tested builds, reported bugs, and kept
              the community going.
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
              Join the Discord ↗
            </a>
          </div>

          <h2>The fine print</h2>
          <p>
            Solomon Darker is a fan preservation project and is not affiliated
            with or endorsed by Raptisoft. All original game content remains ©
            Raptisoft.
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded border border-gold/15 bg-[#0b0910] p-6">
          <div>
            <div className="h-display text-base">Ready to dig?</div>
          </div>
          <div className="flex flex-none gap-3">
            <Link
              to="/game"
              className="btn btn-gold"
            >
              Play
            </Link>
          </div>
        </div>
      </Reveal>

      <img src={art.gateIron} alt="" className="mx-auto mt-16 h-40 opacity-25" />
    </div>
  )
}
