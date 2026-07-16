// Prepares the bundled exercise library from hasaneyldrm/exercises-dataset.
//
// Fetches the upstream 17 MB dataset (1,324 exercises, 10 languages) and strips
// it down to the English-only fields the app needs:
//   data/exercise-library.json — slim LibraryExercise[] (~1 MB, lazy /exercises chunk)
//   data/exercise-media.json   — { datasetId: mediaStem } (~35 KB, eager import)
//
// Media stays hotlinked from jsDelivr (© Gymvisual — attribution shown in UI).
// After running, update DATASET_COMMIT in src/lib/exerciseImages.ts with the
// printed commit SHA so image URLs are pinned (jsDelivr caches branch refs 12h).
//
// Catalog expansion: to promote a library exercise into the engine catalog,
// append a curated entry to data/exercises.json with its `datasetId` plus
// hand-authored category/difficulty/repRange/cue/equipment/location/type.
// Run with --suggest to fuzzy-match curated names against dataset names.
//
// Usage: npm run prep:library [-- --suggest]

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DATASET_JSON_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'
const COMMIT_API_URL =
  'https://api.github.com/repos/hasaneyldrm/exercises-dataset/commits/main'

const ROOT = resolve(import.meta.dirname, '..')
const LIBRARY_OUT = resolve(ROOT, 'data/exercise-library.json')
const MEDIA_OUT = resolve(ROOT, 'data/exercise-media.json')
const CURATED_PATH = resolve(ROOT, 'data/exercises.json')

interface DatasetEntry {
  id: string
  name: string
  body_part?: string
  target?: string
  secondary_muscles?: string[]
  equipment?: string
  instructions?: Record<string, string>
  instruction_steps?: Record<string, string[]>
  image?: string
  gif_url?: string
}

interface LibraryEntry {
  id: string
  name: string
  bodyPart: string
  target: string
  secondaryMuscles: string[]
  equipment: string
  media: string
  steps: string[]
}

function mediaStem(entry: DatasetEntry): string | null {
  const fromGif = entry.gif_url?.match(/^videos\/(.+)\.gif$/)?.[1] ?? null
  if (fromGif) {
    return fromGif
  }
  return entry.image?.match(/^images\/(.+)\.jpg$/)?.[1] ?? null
}

function englishSteps(entry: DatasetEntry): string[] {
  const steps = entry.instruction_steps?.en
  if (steps && steps.length > 0) {
    return steps.map((s) => s.trim()).filter((s) => s.length > 0)
  }
  const prose = entry.instructions?.en
  if (!prose) {
    return []
  }
  return prose
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function toLibraryEntry(entry: DatasetEntry, warnings: string[]): LibraryEntry | null {
  const media = mediaStem(entry)
  if (!media) {
    warnings.push(`${entry.id} "${entry.name}": no gif_url/image — skipped`)
    return null
  }
  if (!entry.gif_url) {
    warnings.push(`${entry.id} "${entry.name}": missing gif_url (thumb only)`)
  }
  const steps = englishSteps(entry)
  if (steps.length === 0) {
    warnings.push(`${entry.id} "${entry.name}": no English instructions`)
  }
  return {
    id: entry.id,
    name: entry.name,
    bodyPart: entry.body_part ?? '',
    target: entry.target ?? '',
    secondaryMuscles: entry.secondary_muscles ?? [],
    equipment: entry.equipment ?? '',
    media,
    steps,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`)
  }
  return (await res.json()) as T
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' '))
  const tb = new Set(normalize(b).split(' '))
  let hits = 0
  for (const t of ta) {
    if (tb.has(t)) {
      hits += 1
    }
  }
  return hits / Math.max(ta.size, tb.size)
}

function printSuggestions(library: LibraryEntry[]): void {
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as {
    id: string
    name: string
    datasetId?: string
  }[]
  for (const ex of curated) {
    if (ex.datasetId) {
      continue
    }
    const ranked = library
      .map((l) => ({ l, score: tokenScore(ex.name, l.name) }))
      .filter((r) => r.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    const hint = ranked
      .map((r) => `${r.l.id} "${r.l.name}" (${r.score.toFixed(2)})`)
      .join(' | ')
    console.log(`${ex.id}: ${hint || '— no match'}`)
  }
}

async function main(): Promise<void> {
  console.log('Fetching dataset…')
  const [dataset, commit] = await Promise.all([
    fetchJson<DatasetEntry[]>(DATASET_JSON_URL),
    fetchJson<{ sha: string }>(COMMIT_API_URL).catch(() => null),
  ])

  const warnings: string[] = []
  const library = dataset
    .map((entry) => toLibraryEntry(entry, warnings))
    .filter((e): e is LibraryEntry => e !== null)

  const media: Record<string, string> = {}
  for (const entry of library) {
    media[entry.id] = entry.media
  }

  writeFileSync(LIBRARY_OUT, JSON.stringify(library))
  writeFileSync(MEDIA_OUT, JSON.stringify(media))

  const kb = (path: string): string =>
    `${(readFileSync(path).byteLength / 1024).toFixed(0)} KB`
  console.log(`exercise-library.json: ${library.length} entries, ${kb(LIBRARY_OUT)}`)
  console.log(`exercise-media.json: ${kb(MEDIA_OUT)}`)
  if (commit) {
    console.log(`Upstream commit SHA (pin in src/lib/exerciseImages.ts): ${commit.sha}`)
  } else {
    console.warn('Could not resolve upstream commit SHA (GitHub API unreachable).')
  }
  for (const w of warnings) {
    console.warn(`warn: ${w}`)
  }

  if (process.argv.includes('--suggest')) {
    console.log('\nCurated -> dataset suggestions (hand-verify before applying):')
    printSuggestions(library)
  }
}

main().catch((err: unknown) => {
  console.error('prepare-exercise-library failed:', err)
  process.exitCode = 1
})
