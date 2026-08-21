import { Link } from 'react-router-dom'

import Reveal from '../fx/Reveal'
import { art } from '../lib/assets'

export default function SearchParties() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <Reveal>
        <img src={art.skullGold} alt="" className="mx-auto h-14 opacity-70" />
        <div className="kicker mb-2 mt-6">Parties moved into the game</div>
        <h1 className="h-display text-3xl">Enter the Shared Hub</h1>
        <p className="text-fell mx-auto mt-4 max-w-xl text-bone-dim">
          Browser parties now form face to face in the College Courtyard. Enter the
          shared Hub, inspect another wizard, send an invitation, and let the party
          leader choose the Boneyard. Your exact enabled mod set travels with your
          admission and must match the party before launch.
        </p>
        <Link to="/game" className="btn btn-gold mt-8">Play Solomon Dark</Link>
      </Reveal>
    </div>
  )
}
