import { Link } from 'react-router-dom'

import Reveal from '../fx/Reveal'
import { art } from '../lib/assets'

export default function SearchParties() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <Reveal>
        <img src={art.skullGold} alt="" className="mx-auto h-14 opacity-70" />
        <div className="kicker mb-2 mt-6">Party discovery lives in the game</div>
        <h1 className="h-display text-3xl">Join Your Party</h1>
        <p className="text-fell mx-auto mt-4 max-w-xl text-bone-dim">
          Open Play, choose Join Party, then enter a Party ID or browse public and
          invite-only groups. A modded College shows its content before you join and
          can sync the host's mods in one step.
        </p>
        <Link to="/game" className="btn btn-gold mt-8">Open Join Party</Link>
      </Reveal>
    </div>
  )
}
