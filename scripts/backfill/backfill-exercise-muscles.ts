// Backfills typed muscle metadata onto data/exercises.json.
//
// For entries linked to the library (datasetId): primaryMuscles from the
// dataset `target`, secondaryMuscles from `secondary_muscles`, both bridged
// through shared/muscles.ts. Unlinked entries and corrections come from the
// OVERRIDES table. force defaults from category, mechanics from secondary
// count — overrides win. Idempotent: re-run after adding catalog entries.
//
// Usage: npm run backfill:muscles

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Exercise, Force, LibraryExercise, Muscle } from '../../shared/types'
import { MUSCLES } from '../../shared/types'
import { LIBRARY_SECONDARY_TO_MUSCLE, LIBRARY_TARGET_TO_MUSCLE } from '../../shared/muscles'
import { OVERRIDES } from './overrides'

const ROOT = resolve(import.meta.dirname, '../..')
const CURATED_PATH = resolve(ROOT, 'data/exercises.json')
const LIBRARY_PATH = resolve(ROOT, 'data/exercise-library.json')

// Input may be the legacy shape (muscleGroups) or the new one — both tolerated
// so the script stays idempotent across the migration.
type CuratedInput = Omit<Exercise, 'primaryMuscles' | 'secondaryMuscles'> &
  Partial<Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>> & { muscleGroups?: string[] }

interface Derived {
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  source: 'dataset' | 'override' | 'kept'
}

function fromLibrary(lib: LibraryExercise, errors: string[], id: string): Derived | null {
  const primary = LIBRARY_TARGET_TO_MUSCLE[lib.target]
  if (primary === undefined) {
    errors.push(`${id}: library target "${lib.target}" missing from LIBRARY_TARGET_TO_MUSCLE`)
    return null
  }
  const secondary: Muscle[] = []
  for (const raw of lib.secondaryMuscles) {
    const mapped = LIBRARY_SECONDARY_TO_MUSCLE[raw]
    if (mapped === undefined) {
      errors.push(`${id}: secondary "${raw}" missing from LIBRARY_SECONDARY_TO_MUSCLE`)
      continue
    }
    if (mapped !== null && mapped !== primary && !secondary.includes(mapped)) {
      secondary.push(mapped)
    }
  }
  return {
    primaryMuscles: primary === null ? [] : [primary],
    secondaryMuscles: secondary,
    source: 'dataset',
  }
}

const PULL_LEGS = /deadlift|leg curl|hamstring|pull-through|good morning|nordic/

function deriveForce(e: CuratedInput): Force | undefined {
  const key = `${e.id} ${e.name}`.toLowerCase()
  if (e.category === 'push') {
    return 'push'
  }
  if (e.category === 'pull') {
    return 'pull'
  }
  if (e.category === 'legs') {
    return PULL_LEGS.test(key) ? 'pull' : 'push'
  }
  return undefined
}

function validate(e: Exercise, errors: string[]): void {
  if (e.primaryMuscles.length === 0) {
    errors.push(`${e.id}: empty primaryMuscles`)
  }
  for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
    if (!(MUSCLES as readonly string[]).includes(m)) {
      errors.push(`${e.id}: "${m}" is not a canonical muscle`)
    }
  }
  const overlap = e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m))
  if (overlap.length > 0) {
    errors.push(`${e.id}: primary/secondary overlap: ${overlap.join(', ')}`)
  }
}

function main(): void {
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as CuratedInput[]
  const library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8')) as LibraryExercise[]
  const libById = new Map(library.map((l) => [l.id, l]))

  const errors: string[] = []
  const report: string[] = []

  const out = curated.map((e): Exercise => {
    const override = OVERRIDES[e.id]
    const lib = e.datasetId ? libById.get(e.datasetId) : undefined
    if (e.datasetId && !lib) {
      errors.push(`${e.id}: datasetId ${e.datasetId} not in exercise-library.json`)
    }

    let derived: Derived | null = lib ? fromLibrary(lib, errors, e.id) : null
    if (!derived && e.primaryMuscles) {
      derived = {
        primaryMuscles: e.primaryMuscles,
        secondaryMuscles: e.secondaryMuscles ?? [],
        source: 'kept',
      }
    }
    if (!derived) {
      derived = { primaryMuscles: [], secondaryMuscles: [], source: 'override' }
    }

    const primaryMuscles = override?.primaryMuscles ?? derived.primaryMuscles
    const secondaryMuscles = (override?.secondaryMuscles ?? derived.secondaryMuscles).filter(
      (m) => !primaryMuscles.includes(m),
    )
    const force = override?.force ?? deriveForce(e)
    const mechanics = override?.mechanics ?? (secondaryMuscles.length >= 2 ? 'compound' : 'isolation')

    const result: Exercise = {
      id: e.id,
      name: e.name,
      category: e.category,
      primaryMuscles,
      secondaryMuscles,
      ...(force ? { force } : {}),
      mechanics,
      equipment: e.equipment,
      location: e.location,
      difficulty: e.difficulty,
      type: e.type,
      repRange: e.repRange,
      cue: e.cue,
      ...(e.datasetId ? { datasetId: e.datasetId } : {}),
    }
    validate(result, errors)
    const src = override ? `${derived.source}+override` : derived.source
    report.push(
      `${e.id} [${src}] P:${primaryMuscles.join(',')} S:${secondaryMuscles.join(',') || '—'} ` +
        `${force ?? '—'}/${mechanics}`,
    )
    return result
  })

  console.log(report.join('\n'))

  const counts: Record<string, number> = {}
  for (const e of out) {
    for (const m of e.primaryMuscles) {
      counts[m] = (counts[m] ?? 0) + 1
    }
  }
  console.log('\nPrimary-muscle catalog counts:')
  for (const m of MUSCLES) {
    console.log(`  ${m}: ${counts[m] ?? 0}`)
  }

  const machineByCategory: Record<string, number> = {}
  for (const e of out) {
    if (e.equipment.some((eq) => eq === 'machine' || eq === 'cable')) {
      machineByCategory[e.category] = (machineByCategory[e.category] ?? 0) + 1
    }
  }
  console.log(`\nMachine/cable per category: ${JSON.stringify(machineByCategory)}`)

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`)
    for (const err of errors) {
      console.error(`  ${err}`)
    }
    process.exitCode = 1
    return
  }

  writeFileSync(CURATED_PATH, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`\nWrote ${out.length} exercises to data/exercises.json`)
}

try {
  main()
} catch (err) {
  console.error('backfill-exercise-muscles failed:', err)
  process.exitCode = 1
}
