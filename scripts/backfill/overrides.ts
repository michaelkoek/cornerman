// Hand-authored muscle/force/mechanics data for curated exercises the dataset
// doesn't cover (no datasetId), plus corrections where the derived defaults
// are wrong. Merged over derived values by backfill-exercise-muscles.ts.
import type { Force, Mechanics, Muscle } from '../../shared/types'

export interface MuscleOverride {
  primaryMuscles?: Muscle[]
  secondaryMuscles?: Muscle[]
  force?: Force
  mechanics?: Mechanics
}

export const OVERRIDES: Record<string, MuscleOverride> = {
  // --- unlinked exercises (no datasetId) ---
  'dumbbell-floor-press': {
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    force: 'push',
    mechanics: 'compound',
  },
  'pseudo-planche-push-up': {
    primaryMuscles: ['chest', 'shoulders'],
    secondaryMuscles: ['triceps', 'abs'],
    force: 'push',
    mechanics: 'compound',
  },
  'pike-push-up': {
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'chest'],
    force: 'push',
    mechanics: 'compound',
  },
  'negative-pull-up': {
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'back', 'forearms'],
    force: 'pull',
    mechanics: 'compound',
  },
  'dead-hang': {
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['lats', 'shoulders'],
    force: 'static',
    mechanics: 'isolation',
  },
  'face-pull': {
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    force: 'pull',
    mechanics: 'isolation',
  },
  'bodyweight-squat': {
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    force: 'push',
    mechanics: 'compound',
  },
  'box-pistol-squat': {
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings', 'calves'],
    force: 'push',
    mechanics: 'compound',
  },
  'wall-sit': {
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    force: 'static',
    mechanics: 'isolation',
  },
  plank: {
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'lower-back', 'shoulders'],
    force: 'static',
    mechanics: 'compound',
  },
  'hollow-body-hold': {
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'quads'],
    force: 'static',
    mechanics: 'isolation',
  },
  'hanging-knee-raise': {
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'forearms'],
    force: 'pull',
    mechanics: 'compound',
  },
  'plank-walkout': {
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders', 'chest'],
    force: 'push',
    mechanics: 'compound',
  },
  'bird-dog': {
    primaryMuscles: ['lower-back'],
    secondaryMuscles: ['abs', 'glutes'],
    force: 'static',
    mechanics: 'compound',
  },
  'shadowboxing-round': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['shoulders', 'abs'],
    mechanics: 'compound',
  },
  'high-knees': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['quads', 'calves', 'abs'],
    mechanics: 'compound',
  },
  'sprint-intervals': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    mechanics: 'compound',
  },
  'hill-sprints': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    mechanics: 'compound',
  },
  'kettlebell-clean-and-press': {
    primaryMuscles: ['shoulders', 'glutes'],
    secondaryMuscles: ['hamstrings', 'abs', 'forearms'],
    force: 'push',
    mechanics: 'compound',
  },
  'kettlebell-complex': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['shoulders', 'glutes', 'hamstrings', 'abs'],
    mechanics: 'compound',
  },
  'devils-press': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['shoulders', 'chest', 'quads', 'glutes'],
    force: 'push',
    mechanics: 'compound',
  },
  // --- corrections to dataset-derived values ---
  // Dataset files the ski erg under triceps; it's a full-body conditioning pull.
  'ski-erg': {
    primaryMuscles: ['full-body'],
    secondaryMuscles: ['lats', 'triceps', 'abs'],
    force: 'pull',
    mechanics: 'compound',
  },
}
