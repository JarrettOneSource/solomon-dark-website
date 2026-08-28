import { useEffect, useState } from 'react'
import AuthenticatedImage from '../components/AuthenticatedImage'

interface DarkCloudMediaProps {
  alt: string
  className?: string
  eager?: boolean
  src: string | null
}

export default function DarkCloudMedia({
  alt,
  className = '',
  eager = false,
  src,
}: DarkCloudMediaProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <span className={`dark-cloud-media ${className}`.trim()}>
      {src && !failed ? (
        <AuthenticatedImage
          alt={alt}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          onLoadError={() => setFailed(true)}
          src={src}
        />
      ) : (
        <span
          className="dark-cloud-media-placeholder"
          role="img"
          aria-label={`No image available for ${alt}`}
        >
          <span aria-hidden>NO IMAGE</span>
        </span>
      )}
    </span>
  )
}
