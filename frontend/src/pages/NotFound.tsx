import { Link } from 'react-router-dom'
import { art } from '../lib/assets'
import { playSound } from '../fx/sounds'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="relative mb-10 flex items-center gap-6">
        <img src={art.eyesLeft} alt="" className="h-8 [animation:eye-pulse_3.2s_ease-in-out_infinite]" />
        <img
          src={art.eyesRight}
          alt=""
          className="h-7 [animation:eye-pulse_3.2s_ease-in-out_infinite]"
          style={{ animationDelay: '-0.4s' }}
        />
      </div>
      <img
        src={art.gameover}
        alt="Game over"
        className="w-64 max-w-full drop-shadow-[0_4px_20px_rgba(0,0,0,.9)]"
        onClick={() => playSound('youGetNothing', 0.3)}
      />
      <p className="text-fell mt-8 text-lg text-bone-dim">
        “I’ve never heard of you, and nobody else will either.”{' '}
        <span className="text-bone-dim/50">— Solomon Dark, re: your URL</span>
      </p>
      <Link to="/" className="btn btn-stone mt-10">
        ← Return to the College
      </Link>
    </div>
  )
}
