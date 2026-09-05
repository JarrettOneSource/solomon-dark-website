import { useEffect, useRef, useState, type TouchEvent } from 'react'

import type { ModDetail } from '../lib/api.ts'
import DarkCloudMedia from './DarkCloudMedia.tsx'
import { NativeDarkCloudText, NativeUiButton } from './native-ui/react.ts'

const SWIPE_THRESHOLD_PX = 40

export default function DarkCloudGallery({ images, name }: { images: ModDetail['screenshots']; name: string }) {
  const swipeStartX = useRef<number | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return
      if (event.key === 'ArrowLeft') showPreviousImage()
      if (event.key === 'ArrowRight') showNextImage()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })

  const selectedImage = images[imageIndex] ?? null

  const showPreviousImage = () => {
    if (images.length < 2) return
    setImageIndex(index => (index + images.length - 1) % images.length)
  }
  const showNextImage = () => {
    if (images.length < 2) return
    setImageIndex(index => (index + 1) % images.length)
  }

  const beginSwipe = (event: TouchEvent<HTMLDivElement>) => {
    swipeStartX.current = event.touches[0]?.clientX ?? null
  }
  const endSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartX.current
    swipeStartX.current = null
    if (start === null) return
    const travel = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(travel) < SWIPE_THRESHOLD_PX) return
    if (travel < 0) showNextImage()
    else showPreviousImage()
  }

  return (
    <section className="dark-cloud-gallery" aria-labelledby="dark-cloud-gallery-title">
      <div className="dark-cloud-section-heading">
        <h3 id="dark-cloud-gallery-title"><NativeDarkCloudText font="medium" scale={1} text="SCREENSHOTS" /></h3>
        <span><NativeDarkCloudText font="medium" scale={0.85} text={images.length === 0 ? 'NO IMAGES' : `${imageIndex + 1} / ${images.length}`} /></span>
      </div>
      <div className="dark-cloud-gallery-box">
        <div className="dark-cloud-gallery-stage" onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
          <DarkCloudMedia
            alt={selectedImage ? `${name} screenshot ${imageIndex + 1}` : name}
            className="dark-cloud-gallery-image"
            eager
            fit="contain"
            src={selectedImage?.url ?? null}
          />
        </div>
        <div className="dark-cloud-gallery-navigation">
          <NativeUiButton height={44} scale={0.55} width={96}
            type="button"
            className="dark-cloud-gallery-previous"
            aria-label="PREVIOUS IMAGE"
            disabled={images.length < 2}
            onClick={showPreviousImage}
          >PREV</NativeUiButton>
          <NativeUiButton height={44} scale={0.55} width={96}
            type="button"
            className="dark-cloud-gallery-next"
            aria-label="NEXT IMAGE"
            disabled={images.length < 2}
            onClick={showNextImage}
          >NEXT</NativeUiButton>
        </div>
        {images.length > 1 ? (
          <div className="dark-cloud-gallery-thumbnails" aria-label="Choose screenshot">
            {images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className={imageIndex === index ? 'selected' : ''}
                aria-label={`Show screenshot ${index + 1}`}
                aria-pressed={imageIndex === index}
                onClick={() => setImageIndex(index)}
              >
                <DarkCloudMedia alt={`${name} screenshot ${index + 1}`} src={image.url} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
