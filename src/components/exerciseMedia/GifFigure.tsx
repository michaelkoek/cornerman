/** Animated demo GIF for an exercise (dataset media, © Gymvisual). */
export function GifFigure({
  src,
  alt,
  onError,
}: {
  src: string
  alt: string
  onError: () => void
}) {
  return (
    <figure className="example__gif-frame">
      <img className="example__gif" src={src} alt={alt} loading="lazy" onError={onError} />
    </figure>
  )
}
