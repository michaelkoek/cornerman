// Example photos for exercises, sourced from the public-domain free-exercise-db
// (https://github.com/yuhonas/free-exercise-db) and served via jsDelivr.
// data/exercise-images.json maps our exercise ids to image paths in that repo.
import imageMap from '../../data/exercise-images.json'

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

const MAP = imageMap as Record<string, string[]>

/** Absolute image URLs for an exercise — empty when we have no illustration. */
export function exampleImages(exerciseId: string): string[] {
  const paths = MAP[exerciseId]
  return paths ? paths.map((p) => CDN + p) : []
}

/** Fallback: Google Images search for the exercise, opened in a new tab. */
export function exampleSearchUrl(name: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} exercise form`)}`
}
