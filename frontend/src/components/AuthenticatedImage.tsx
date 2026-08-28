import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { getToken } from '../lib/api'

export default function AuthenticatedImage({
  onLoadError,
  src,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> & {
  onLoadError?: () => void
  src: string
}) {
  const [resolved, setResolved] = useState<string>()
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    setResolved(undefined)
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    void fetch(src, { headers, signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Image request failed (${response.status})`)
      return response.blob()
    }).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      setResolved(objectUrl)
    }).catch(() => {
      if (!controller.signal.aborted) onLoadErrorRef.current?.()
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  return <img {...props} src={resolved} onError={() => onLoadErrorRef.current?.()} />
}
