import { loader } from '../lib/assets'
import './native-loader.css'

interface NativeLoaderProps {
  progress: number
}

export default function NativeLoader({ progress }: NativeLoaderProps) {
  const boundedProgress = Math.max(0, Math.min(1, progress))

  return (
    <div className="native-loader-page" role="status" aria-label={`Loading ${Math.round(boundedProgress * 100)}%`}>
      <section className="native-loader-stage" aria-hidden>
        <div className="native-loader-canvas">
          <img src={loader.logo} alt="" className="native-loader-logo" />
          <img src={loader.url} alt="" className="native-loader-url" />
          <img src={loader.frame} alt="" className="native-loader-frame" />
          <img
            src={loader.fill}
            alt=""
            className="native-loader-fill"
            style={{ clipPath: `inset(0 ${(1 - boundedProgress) * 100}% 0 0)` }}
          />
        </div>
      </section>
    </div>
  )
}
