import { useEffect, useState } from 'react'
import AuthenticatedImage from '../components/AuthenticatedImage'
import { NativeDarkCloudText, NativeUiControlPanelArt } from './native-ui/react.ts'

interface DarkCloudMediaProps {
  alt: string
  className?: string
  eager?: boolean
  fit?: 'contain' | 'cover'
  src: string | null
}

export default function DarkCloudMedia({
  alt,
  className = '',
  eager = false,
  fit = 'cover',
  src,
}: DarkCloudMediaProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <span className={`dark-cloud-media ${className}`.trim()}>
      <NativeUiControlPanelArt />
      {src && !failed ? (
        <AuthenticatedImage
          alt={alt}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          onLoadError={() => setFailed(true)}
          src={src}
          style={{ objectFit: fit }}
        />
      ) : (
        <span
          className="dark-cloud-media-placeholder"
          role="img"
          aria-label={`No image available for ${alt}`}
        >
          <NativeDarkCloudText align="center" font="medium" scale={0.85} text={'NO\nIMAGE'} tint={0xa99a70} />
        </span>
      )}
    </span>
  )
}
