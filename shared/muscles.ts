// Bridges the raw exercise-library vocabulary (hasaneyldrm/exercises-dataset)
// to the app's canonical Muscle union. Used by the backfill script, the
// Library muscle filter, and anywhere raw dataset strings must become typed.
import type { Exercise, Muscle } from './types';

// Dataset `target` (primary muscle) -> canonical. null = intentionally dropped.
export const LIBRARY_TARGET_TO_MUSCLE: Record<string, Muscle | null> = {
  abs: 'abs',
  quads: 'quads',
  lats: 'lats',
  calves: 'calves',
  pectorals: 'chest',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  adductors: 'quads',
  triceps: 'triceps',
  'cardiovascular system': 'full-body',
  spine: 'lower-back',
  'upper back': 'back',
  biceps: 'biceps',
  delts: 'shoulders',
  forearms: 'forearms',
  traps: 'back',
  'serratus anterior': 'chest',
  abductors: 'glutes',
  'levator scapulae': 'back',
};

// Dataset `secondaryMuscles` entries -> canonical. null = intentionally dropped
// (stabilizers with no region on the body map and no training-volume meaning).
export const LIBRARY_SECONDARY_TO_MUSCLE: Record<string, Muscle | null> = {
  'hip flexors': 'quads',
  'lower back': 'lower-back',
  obliques: 'obliques',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  biceps: 'biceps',
  rhomboids: 'back',
  'ankle stabilizers': null,
  forearms: 'forearms',
  triceps: 'triceps',
  shoulders: 'shoulders',
  core: 'abs',
  back: 'back',
  quadriceps: 'quads',
  calves: 'calves',
  chest: 'chest',
  'rear deltoids': 'shoulders',
  traps: 'back',
  'upper back': 'back',
  trapezius: 'back',
  ankles: null,
  feet: null,
  deltoids: 'shoulders',
  brachialis: 'forearms',
  groin: 'quads',
  wrists: 'forearms',
  'rotator cuff': 'shoulders',
  'upper chest': 'chest',
  'latissimus dorsi': 'lats',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  abdominals: 'abs',
  'grip muscles': 'forearms',
  'lower abs': 'abs',
  lats: 'lats',
  'inner thighs': 'quads',
  soleus: 'calves',
  sternocleidomastoid: null,
  hands: null,
  shins: 'calves',
};

/** Map a raw dataset muscle string (target or secondary) to the canonical union. */
export function toMuscle(raw: string): Muscle | null {
  return LIBRARY_TARGET_TO_MUSCLE[raw] ?? LIBRARY_SECONDARY_TO_MUSCLE[raw] ?? null;
}

/** All muscles an exercise touches — primary first, deduped. */
export function allMuscles(e: Exercise): Muscle[] {
  return [...new Set([...e.primaryMuscles, ...e.secondaryMuscles])];
}
