import { Link } from 'react-router-dom'

import Reveal from '../fx/Reveal'
import { art } from '../lib/assets'

export default function SearchParties() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <Reveal>
        <img src={art.skullGold} alt="" className="mx-auto h-14 opacity-70" />
        <h1 className="h-display mt-6 text-3xl">Join a Party</h1>
        <p className="text-fell mx-auto mt-4 max-w-xl text-bone-dim">
          In the game, choose Join Party to browse groups or enter a Party ID.
          You can review any required mods before joining.
        </p>
        <Link to="/game" className="btn btn-gold mt-8">Play</Link>
      </Reveal>
    </div>
  )
}
