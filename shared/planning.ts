// Pure workout-planning rules shared by both engines (src/lib/engine.ts and
// server/engine.ts): slot layout per duration, muscle-focus presets, and
// exercise selection. No data access — engines feed in history-derived inputs.
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  FocusTarget,
  Location,
  Muscle,
  SuggestRequest,
  WorkoutSplit,
} from './types';
import { allMuscles } from './muscles';

// The "machines & cables only" gym filter. A future generic equipment picker
// only has to turn this constant into a parameter.
const MACHINE_EQUIPMENT: readonly Equipment[] = ['machine', 'cable'];

/** True when the exercise can be done on a machine or cable station. */
export function isMachineExercise(e: Exercise): boolean {
  return e.equipment.some((eq) => MACHINE_EQUIPMENT.includes(eq));
}

export interface Slot {
  category?: ExerciseCategory;
  /** When set, candidates match on muscle overlap instead of category. */
  muscles?: Muscle[];
  /** Fills the slot when the muscle filter runs dry (small home pools). */
  fallbackCategories?: ExerciseCategory[];
  count: number;
}

interface FocusPreset {
  muscles?: Muscle[];
  category?: ExerciseCategory;
  fallbackCategories?: ExerciseCategory[];
}

const FOCUS_PRESETS: Record<FocusTarget, FocusPreset> = {
  chest: { muscles: ['chest'], fallbackCategories: ['push'] },
  back: { muscles: ['back', 'lats'], fallbackCategories: ['pull'] },
  shoulders: { muscles: ['shoulders'], fallbackCategories: ['push'] },
  arms: { muscles: ['biceps', 'triceps'], fallbackCategories: ['push', 'pull'] },
  legs: { category: 'legs' },
  core: { category: 'core' },
  stamina: { category: 'conditioning' },
};

function splitSlots(minutes: SuggestRequest['minutes'], split: WorkoutSplit): Slot[] {
  if (minutes === 20) {
    return [{ category: split, count: 3 }];
  }
  if (minutes === 45) {
    return [
      { category: split, count: 4 },
      { category: 'core', count: 1 },
    ];
  }
  // 60 minutes: deep split focus + core + conditioning finisher (7 exercises)
  return [
    { category: split, count: 5 },
    { category: 'core', count: 1 },
    { category: 'conditioning', count: 1 },
  ];
}

function focusSlots(minutes: SuggestRequest['minutes'], focus: FocusTarget): Slot[] {
  const preset = FOCUS_PRESETS[focus];
  const main = (count: number): Slot => ({ ...preset, count });
  // A core day finishes with conditioning instead of doubling up on core.
  const accessory: Slot = { category: focus === 'core' ? 'conditioning' : 'core', count: 1 };

  if (minutes === 20) {
    return [main(3)];
  }
  if (minutes === 45) {
    return [main(4), accessory];
  }
  if (focus === 'stamina') {
    return [main(5), { category: 'core', count: 2 }];
  }
  return [main(5), accessory, { category: 'conditioning', count: 1 }];
}

// Where to fill from when a muscle's pool runs dry (small home pools).
const MUSCLE_FALLBACK: Record<Muscle, ExerciseCategory[]> = {
  chest: ['push'],
  shoulders: ['push'],
  triceps: ['push'],
  biceps: ['pull'],
  forearms: ['pull'],
  back: ['pull'],
  lats: ['pull'],
  'lower-back': ['core', 'legs'],
  abs: ['core'],
  obliques: ['core'],
  quads: ['legs'],
  hamstrings: ['legs'],
  glutes: ['legs'],
  calves: ['legs'],
  'full-body': ['conditioning'],
};

/** Total exercises a session length holds (matches split/focus layouts). */
export function exerciseBudget(minutes: SuggestRequest['minutes']): number {
  if (minutes === 20) {
    return 3;
  }
  return minutes === 45 ? 5 : 7;
}

/**
 * Custom body-map selection: one slot per picked muscle, the exercise budget
 * split round-robin in selection order (first picks absorb the remainder).
 * With more muscles than budget, later picks are dropped — compounds picked
 * for earlier slots usually still touch them.
 */
function muscleSlots(minutes: SuggestRequest['minutes'], muscles: Muscle[]): Slot[] {
  const budget = exerciseBudget(minutes);
  const targets = muscles.slice(0, budget);
  const base = Math.floor(budget / targets.length);
  const remainder = budget % targets.length;
  return targets.map((muscle, i) => ({
    muscles: [muscle],
    fallbackCategories: MUSCLE_FALLBACK[muscle],
    count: base + (i < remainder ? 1 : 0),
  }));
}

/** Slot layout for a request: muscles win over focus, focus over split, split over rotation. */
export function buildSlots(
  minutes: SuggestRequest['minutes'],
  split: WorkoutSplit,
  focus: FocusTarget | undefined,
  muscles?: Muscle[],
): Slot[] {
  if (muscles && muscles.length > 0) {
    return muscleSlots(minutes, muscles);
  }
  return focus ? focusSlots(minutes, focus) : splitSlots(minutes, split);
}

function isLegsHeavyCompound(e: Exercise): boolean {
  if (e.category !== 'legs') {
    return false;
  }
  const key = `${e.id} ${e.name}`.toLowerCase();
  return key.includes('deadlift') || key.includes('squat');
}

/** Candidate pool for a session: fits the location; easier work when recovering hard. */
export function filterPool(all: Exercise[], location: Location, hard: boolean): Exercise[] {
  let pool = all.filter((e) => (location === 'gym' ? true : e.location.includes('home')));
  if (hard) {
    pool = pool.filter((e) => e.difficulty !== 3 && !isLegsHeavyCompound(e));
  }
  return pool;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slotMatcher(slot: Slot): (e: Exercise) => boolean {
  const muscles = slot.muscles;
  if (muscles) {
    return (e) => allMuscles(e).some((m) => muscles.includes(m));
  }
  return (e) => e.category === slot.category;
}

function isCompound(e: Exercise): boolean {
  if (e.mechanics) {
    return e.mechanics === 'compound';
  }
  return e.secondaryMuscles.length >= 2;
}

/**
 * Compound first, random tiebreak. Muscle-focused slots put exercises whose
 * primary muscle matches ahead of incidental overlaps (an arms day should
 * reach for curls before bench presses). When recovering hard, bias easier work.
 */
function rankCandidates(candidates: Exercise[], hard: boolean, muscles?: Muscle[]): Exercise[] {
  return shuffle(candidates).sort((a, b) => {
    if (muscles) {
      const primary =
        Number(b.primaryMuscles.some((m) => muscles.includes(m))) -
        Number(a.primaryMuscles.some((m) => muscles.includes(m)));
      if (primary !== 0) {
        return primary;
      }
    }
    const compound = Number(isCompound(b)) - Number(isCompound(a));
    if (compound !== 0) {
      return compound;
    }
    if (hard) {
      return a.difficulty - b.difficulty;
    }
    return 0;
  });
}

/**
 * Build the ordered set of picked exercises for a plan (pure).
 *
 * When `fallbackPool` differs from `pool` (machines-only builds), each slot is
 * filled from the constrained pool first and topped up from the fallback pool,
 * so a slot without machine/cable options still gets exercises.
 */
export function pickExercises(
  slots: Slot[],
  pool: Exercise[],
  hard: boolean,
  used: Set<string>,
  fallbackPool: Exercise[] = pool,
): Exercise[] {
  const picked: Exercise[] = [];
  const pickedIds = new Set<string>();

  const select = (
    source: Exercise[],
    slot: Slot,
    needed: number,
    exclude: Set<string>,
  ): Exercise[] => {
    const matches = slotMatcher(slot);
    let candidates = source.filter((e) => matches(e) && !exclude.has(e.id) && !used.has(e.id));
    // If variety exclusion empties the slot, fall back to allowing recently used exercises.
    if (candidates.length < needed) {
      candidates = source.filter((e) => matches(e) && !exclude.has(e.id));
    }
    return rankCandidates(candidates, hard, slot.muscles).slice(0, needed);
  };

  for (const slot of slots) {
    let chosen = select(pool, slot, slot.count, pickedIds);

    // Constrained pool ran short — top up from the unconstrained pool.
    if (chosen.length < slot.count && fallbackPool !== pool) {
      const exclude = new Set([...pickedIds, ...chosen.map((e) => e.id)]);
      chosen = [...chosen, ...select(fallbackPool, slot, slot.count - chosen.length, exclude)];
    }

    // Still short (thin muscle pool, e.g. chest at home) — fill from the fallback categories.
    const fallbackCategories = slot.fallbackCategories;
    if (chosen.length < slot.count && fallbackCategories) {
      const chosenIds = new Set(chosen.map((e) => e.id));
      const fillers = fallbackPool.filter(
        (e) =>
          fallbackCategories.includes(e.category) &&
          !pickedIds.has(e.id) &&
          !chosenIds.has(e.id),
      );
      chosen = [...chosen, ...rankCandidates(fillers, hard).slice(0, slot.count - chosen.length)];
    }

    for (const e of chosen) {
      picked.push(e);
      pickedIds.add(e.id);
    }
  }
  return picked;
}
