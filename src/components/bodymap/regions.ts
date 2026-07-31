// Simplified anatomical geometry for the tap-a-muscle body map.
// Hand-tuned coordinates in a 200x420 viewBox; regions are capsule shapes
// generated per side so hit areas stay generous on a phone.
import type { Muscle } from '../../../shared/types'

export const BODYMAP_VIEWBOX = '0 0 200 420'

export interface IBodyRegion {
  muscle: Muscle
  /** One path per patch (left/right pairs render as one region). */
  paths: string[]
}

export type BodyView = 'front' | 'back'

/** Rounded-rect path — the building block for every muscle patch. */
function capsule(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    'Z',
  ].join(' ')
}

/** A patch plus its horizontal mirror around the figure's center (x=100). */
function mirrored(x: number, y: number, w: number, h: number, r: number): string[] {
  return [capsule(x, y, w, h, r), capsule(200 - x - w, y, w, h, r)]
}

// Body outline drawn behind the regions: head, torso, arms, legs.
export const SILHOUETTE: string[] = [
  'M 100 10 A 16 17 0 1 0 100 44 A 16 17 0 1 0 100 10 Z',
  capsule(91, 42, 18, 14, 4),
  // torso: shoulders to hips
  'M 58 60 Q 100 50 142 60 L 132 170 L 130 212 Q 100 222 70 212 L 68 170 Z',
  // arms
  capsule(42, 62, 18, 90, 9),
  capsule(140, 62, 18, 90, 9),
  capsule(38, 150, 15, 58, 7),
  capsule(147, 150, 15, 58, 7),
  // legs
  capsule(70, 210, 28, 100, 12),
  capsule(102, 210, 28, 100, 12),
  capsule(75, 308, 22, 84, 10),
  capsule(103, 308, 22, 84, 10),
]

export const FRONT_REGIONS: IBodyRegion[] = [
  { muscle: 'shoulders', paths: mirrored(46, 64, 22, 24, 10) },
  { muscle: 'chest', paths: mirrored(70, 84, 29, 32, 9) },
  { muscle: 'biceps', paths: mirrored(44, 92, 15, 52, 7) },
  { muscle: 'forearms', paths: mirrored(39, 150, 14, 54, 7) },
  { muscle: 'abs', paths: [capsule(84, 120, 32, 60, 8)] },
  { muscle: 'obliques', paths: mirrored(69, 120, 13, 54, 6) },
  { muscle: 'quads', paths: mirrored(71, 214, 26, 90, 11) },
  { muscle: 'calves', paths: mirrored(76, 312, 20, 76, 9) },
]

export const BACK_REGIONS: IBodyRegion[] = [
  { muscle: 'shoulders', paths: mirrored(46, 64, 22, 24, 10) },
  { muscle: 'back', paths: [capsule(70, 62, 60, 46, 10)] },
  { muscle: 'triceps', paths: mirrored(44, 92, 15, 52, 7) },
  { muscle: 'lats', paths: mirrored(66, 112, 26, 52, 9) },
  { muscle: 'forearms', paths: mirrored(39, 150, 14, 54, 7) },
  { muscle: 'lower-back', paths: [capsule(84, 168, 32, 40, 8)] },
  { muscle: 'glutes', paths: mirrored(71, 212, 27, 38, 11) },
  { muscle: 'hamstrings', paths: mirrored(72, 254, 25, 52, 10) },
  { muscle: 'calves', paths: mirrored(76, 312, 20, 76, 9) },
]

export const VIEW_REGIONS: Record<BodyView, IBodyRegion[]> = {
  front: FRONT_REGIONS,
  back: BACK_REGIONS,
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  back: 'Upper back',
  lats: 'Lats',
  'lower-back': 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  'full-body': 'Full body',
}
