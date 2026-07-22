# Machines-only filter for gym workouts — design

**Date:** 2026-07-22
**Status:** Approved approach (Option A: `machinesOnly` boolean, threaded end-to-end)

## Problem

When building a workout at the gym, the planner picks from every gym exercise. There is no
way to say "I want to work on machines today". Every curated `Exercise` already carries
`equipment: Equipment[]` (including `'machine'` and `'cable'`), but no code path filters on it.

## Decision summary

- A **checkbox** in the planner, visible only when location is `gym`: "Machines & cables only".
- Checked → the candidate pool is **hard-filtered** to exercises whose equipment includes
  `machine` or `cable`.
- **Per-slot fallback:** a slot with zero machine/cable candidates (core and conditioning have
  none today) falls back to the full gym pool for that slot only.
- The session **remembers** it was built machines-only; the swap sheet filters alternatives the
  same way. Fallback-filled slots still show all gym alternatives (a machine/cable-empty
  category stays machine/cable-empty when swapping).

## Data model

### Shared types (`shared/types.ts`)

- `SuggestRequest` gains `machinesOnly?: boolean` (omitted/false = current behaviour; only
  meaningful when `location === 'gym'`).
- `Session` gains `machinesOnly: boolean` (default `false`), mirroring how `location` is
  persisted today.

No new union types. The filter is expressed internally as a constant allowlist
`MACHINE_EQUIPMENT: readonly Equipment[] = ['machine', 'cable']` in `shared/planning.ts`, so a
future generic equipment picker (Option B) only has to swap the constant for a parameter.

## Rules layer (`shared/planning.ts`)

Single choke point shared by both engines.

- `filterPool(all, location, hard, machinesOnly)` — new fourth parameter. When `true`, after
  the existing location/difficulty filtering, keep only exercises where
  `e.equipment.some((eq) => MACHINE_EQUIPMENT.includes(eq))`.
- `pickExercises` receives **two pools**: the constrained pool and the unconstrained fallback
  pool (identical objects when `machinesOnly` is false, so the non-machine path is unchanged).
  For each slot: match against the constrained pool first; if the slot has zero candidates,
  match against the fallback pool. Fallback is per slot, never per exercise — a slot that has
  at least one machine/cable candidate uses only those.
- Hard-recovery difficulty filtering applies to both pools (existing behaviour), so the
  combined filter can never resurrect excluded heavy compounds.

## Engines

- `src/lib/engine.ts` (`suggestSession`, `alternativesFor`) and `server/engine.ts` (mirror):
  thread `machinesOnly` from the request into `filterPool`/`pickExercises`, and persist it on
  the created session.
- `alternativesFor`: when the session has `machinesOnly` set **and** the exercise being swapped
  is itself a machine/cable exercise, filter alternatives to the machine/cable pool. When the
  exercise was a fallback fill (not machine/cable), show the full gym pool.

## Server (`server/index.ts`, `server/db.ts`)

- `POST /api/suggest`: accept and validate `machinesOnly` (must be a boolean when present;
  ignored when `location !== 'gym'`).
- `sessions` table: new column `machines_only INTEGER NOT NULL DEFAULT 0`. Schema uses
  `CREATE TABLE IF NOT EXISTS`, so add a guarded `ALTER TABLE` migration step (check
  `pragma table_info`) next to schema init. Row mapping in `db.ts` maps it to
  `Session.machinesOnly`.
- `GET /api/session-exercises/:id/alternatives`: reads the flag from the session row (no API
  shape change).

## UI

- **Planner** (`src/screens/today/Planner.tsx`): a checkbox row "Machines & cables only"
  rendered directly under the existing home/gym segmented control, only when `gym` is
  selected. Switching to `home` hides it and resets it to unchecked. Native
  `<input type="checkbox">` inside a `<label>` (screen-reader friendly), styled with Tailwind
  to match existing planner chips.
- **SwapSheet** (`src/components/SwapSheet.tsx`): no new UI. Alternatives arrive pre-filtered
  from `alternativesFor`. The existing "No alternatives fit this slot with your equipment"
  empty-state copy finally becomes literally true.

## Error handling & edge cases

- `machinesOnly` with `location: 'home'` → ignored server-side and unreachable from the UI.
- Constrained pool empty for **every** slot (won't happen with current catalog, 16
  machine/cable exercises) → every slot falls back; workout still complete.
- Hard-recovery day + machines-only → both filters compose; fallback path covers emptiness.
- Existing sessions without the column read as `machinesOnly: false` via the SQLite default.

## Testing

No test runner is configured in this repo today. Verification is manual via `npm run dev`:

1. Gym + checkbox on → generated session contains only machine/cable exercises in push/pull/legs
   slots; core/conditioning slots filled from fallback.
2. Swap a machine exercise → only machine/cable alternatives listed. Swap a fallback core
   exercise → full gym list.
3. Home selected → checkbox hidden, flag not sent.
4. Regenerate with checkbox off → behaviour identical to before the change.

## Out of scope (YAGNI)

- Generic equipment multi-select (Option B) — plumbing is compatible, not built.
- Machine variants for core/conditioning categories (catalog content, not code).
- Persisting the checkbox as a user preference in `Settings`.
