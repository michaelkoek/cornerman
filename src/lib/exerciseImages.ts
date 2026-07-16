// Exercise media URLs.
//
// GIFs/thumbnails come from hasaneyldrm/exercises-dataset (media © Gymvisual,
// attribution required wherever shown), photos from the public-domain
// free-exercise-db — both served via jsDelivr.
// data/exercise-media.json maps dataset ids to media filename stems (eager,
// tiny) so GIF URLs resolve without loading the full library chunk.
// data/exercise-images.json maps our exercise ids to free-exercise-db photos.
import imageMap from '../../data/exercise-images.json'
import mediaMap from '../../data/exercise-media.json'

// Commit SHA of hasaneyldrm/exercises-dataset — printed by `npm run prep:library`.
// Pinned because jsDelivr caches branch refs for ~12h and upstream renames
// would 404 every hotlink; a SHA is immutable and permanently cached.
const DATASET_COMMIT = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const DATASET_CDN = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${DATASET_COMMIT}/`
const PHOTO_CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

export const GYMVISUAL_ATTRIBUTION = '© Gymvisual — gymvisual.com'

const PHOTO_MAP = imageMap as Record<string, string[]>
const MEDIA_MAP = mediaMap as Record<string, string>

/** Animation GIF for a curated exercise linked to the dataset — null when unmapped. */
export function exampleGif(datasetId: string | undefined): string | null {
  if (!datasetId) {
    return null
  }
  const stem = MEDIA_MAP[datasetId]
  return stem ? `${DATASET_CDN}videos/${stem}.gif` : null
}

/** Animation GIF for a library entry (LibraryExercise.media). */
export function libraryGif(media: string): string {
  return `${DATASET_CDN}videos/${media}.gif`
}

/** 180×180 thumbnail for a library entry (LibraryExercise.media). */
export function libraryThumb(media: string): string {
  return `${DATASET_CDN}images/${media}.jpg`
}

/** Absolute photo URLs for an exercise — empty when we have no illustration. */
export function exampleImages(exerciseId: string): string[] {
  const paths = PHOTO_MAP[exerciseId]
  return paths ? paths.map((p) => PHOTO_CDN + p) : []
}

/** Fallback: Google Images search for the exercise, opened in a new tab. */
export function exampleSearchUrl(name: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} exercise form`)}`
}
