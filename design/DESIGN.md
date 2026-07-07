# Cornerman — Design System

**Direction: "RINGSIDE"** — the corner of a fight gym at 9pm. Warm off-black like worn canvas, chalk-white type, one dominant corner-red, round-timer monospace digits, and fight-poster condensed headlines. Refined like a Linear-tier product, but it smells faintly of tape and liniment. Dark theme is the only theme.

This is a single-user PWA used one-handed, mid-workout, with sweaty thumbs. Every interactive target is ≥ 44px (most are 56px). Contrast is high, motion is short and physical, numbers are always monospace.

---

## 1. Aesthetic Direction

**Concept: the corner between rounds.** A cornerman doesn't decorate — he tells you exactly what to do in 60 seconds. The UI mirrors that: one dominant red, huge condensed headlines like a fight card poster, stopwatch digits, and generous dark negative space. No glassmorphism, no gradient meshes, no neon glow. Depth comes from layered warm blacks and hairline borders, not shadows-on-shadows.

- **Tone:** industrial/utilitarian × refined coaching. Confident, terse, physical.
- **Base:** warm charcoal blacks (never `#000000`) — canvas and leather, not OLED void.
- **Accent discipline:** one dominant accent (Corner Red). Sport colors appear only as *coding* — a corner bracket, a chart line, a chip — never as large fills.
- **Texture:** a single fixed 3%-opacity noise overlay on the app root (`pointer-events: none`), nothing else.
- **Density:** VISUAL_DENSITY ≈ 4–5. Cards only where elevation means something (the hero, the timer). Lists use hairline dividers (`border-top`), not boxes.

### The signature element: **The Corner Cut**

Every key surface carries the mark of the ring corner: the **top-left corner of hero-level cards is clipped at 45°** (a 14px chamfer via `clip-path`), and a **2px corner bracket** in the active sport's color sits inside that cut (an L-shape, 18×18px). It appears on the Today hero card, the rest timer sheet, and the active tab indicator (a tiny 8×8 bracket instead of a dot). Nothing else in fitness-app land looks like this; it is cheap to render (pure CSS) and it literally puts the app "in your corner."

Implementation (exact):

```css
clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
/* bracket: 18×18px, border-top + border-left, 2px, sport color,
   positioned absolute top:8px left:8px, no border-radius */
```

---

## 2. Typography

Three families, all Google Fonts, all verified rendering well at small sizes on mobile:

| Role | Family | Why |
|---|---|---|
| Display | **Big Shoulders** (condensed, variable `opsz`/`wght`) | Chicago athletic heritage; fight-poster energy without Bebas cliché. Used for workout names, screen titles, big stats labels. Always uppercase. |
| Body/UI | **Archivo** (variable 100–900) | Grotesk built for both display and 13px legibility; neutral enough to let Big Shoulders lead. |
| Data | **Spline Sans Mono** | Every number in the app — reps, kg, timers, streaks. Tabular, humanist mono; reads like a round clock, not a code editor. `font-variant-numeric: tabular-nums` everywhere. |

```css
@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@10..72,100..900&family=Archivo:ital,wght@0,100..900;1,100..900&family=Spline+Sans+Mono:ital,wght@0,300..700;1,300..700&display=swap');
```

### Type scale (mobile-first, rem @ 16px root)

| Token | Size / line-height | Family, weight, treatment | Use |
|---|---|---|---|
| `--type-display-xl` | 2.75rem / 0.95 (44px) | Big Shoulders 800, uppercase, `letter-spacing: 0.01em` | Hero workout name |
| `--type-display-l` | 2rem / 1.0 (32px) | Big Shoulders 700, uppercase | Screen titles (Log, Progress) |
| `--type-display-m` | 1.375rem / 1.05 (22px) | Big Shoulders 700, uppercase | Section headers, exercise group names |
| `--type-title` | 1.0625rem / 1.3 (17px) | Archivo 650 | Card titles, exercise names |
| `--type-body` | 0.9375rem / 1.5 (15px) | Archivo 450 | Default copy, coach notes |
| `--type-caption` | 0.8125rem / 1.4 (13px) | Archivo 500 | Secondary meta, helper text |
| `--type-eyebrow` | 0.6875rem / 1.2 (11px) | Archivo 700, uppercase, `letter-spacing: 0.14em` | Labels above cards ("TODAY · THU 6 JUL"), sport tags |
| `--type-data-xl` | 4.5rem / 1.0 (72px) | Spline Sans Mono 500, tabular | Rest timer countdown |
| `--type-data-l` | 2rem / 1.0 (32px) | Spline Sans Mono 500, tabular | Set weight/reps in steppers, streak count |
| `--type-data-m` | 1.0625rem / 1.2 (17px) | Spline Sans Mono 500, tabular | Inline numbers, chart axis values |
| `--type-data-s` | 0.75rem / 1.2 (12px) | Spline Sans Mono 400, tabular | Chart ticks, timestamps |

Rules: headlines never exceed `display-xl` (hierarchy via weight/color, not scale). Body text max-width `62ch`. No serif anywhere. No italic except Archivo italic for coach quips ("Hands up. 3 rounds left.").

---

## 3. Color

All values exact. Base neutrals are **warm** (brown-black undertone, hue ≈ 30°) — never mix in cool grays. Max saturation on any accent < 80%.

### Background & surface layers

```css
--bg-0:        #0C0A08;  /* app root — deepest canvas black */
--bg-1:        #131009;  /* page background wash, chart plot area */
--surface-1:   #1B1712;  /* cards, sheets, list groupings */
--surface-2:   #241F18;  /* raised: steppers, chips resting, tab bar */
--surface-3:   #2E2820;  /* pressed/hover states, input fills */
--hairline:    rgba(244, 238, 228, 0.08);  /* 1px borders, dividers */
--hairline-strong: rgba(244, 238, 228, 0.16); /* focused/active borders */
```

### Text hierarchy (chalk on canvas)

```css
--text-primary:   #F4EEE4;  /* chalk white, warm */
--text-secondary: rgba(244, 238, 228, 0.64);
--text-tertiary:  rgba(244, 238, 228, 0.42);
--text-disabled:  rgba(244, 238, 228, 0.26);
--text-on-accent: #16100C;  /* dark text on red/amber fills */
```

### Dominant accent — Corner Red

```css
--accent:        #E2483D;  /* corner red — primary actions, active states */
--accent-hover:  #EC5A4F;
--accent-press:  #C93A30;
--accent-dim:    rgba(226, 72, 61, 0.14);  /* tinted fills behind red content */
--accent-line:   rgba(226, 72, 61, 0.40);  /* focus rings, progress tracks */
```

Red is for: primary CTA (Start workout, Finish set), the active corner bracket, streak ring fill, active tab bracket, destructive-confirm. It never fills more than ~8% of any screen.

### Sport coding (brackets, chart lines, chips, tags — never large fills)

```css
--sport-kickboxing:    #E2483D;  /* the brand red — Michael's primary sport owns the accent */
--sport-boxing:        #4E8FD0;  /* blue corner */
--sport-running:       #E0A33C;  /* road amber */
--sport-calisthenics:  #58B384;  /* park green */
--sport-weightlifting: #C9647F;  /* deep rose — iron & chalk */
--sport-conditioning:  #46B3AB;  /* teal — engine work */
```

Each also ships a `-dim` at 14% alpha for chip backgrounds (defined in tokens.css).

### Semantic

```css
--positive: #58B384;   /* PR hit, target met (shares calisthenics green — intentional) */
--warning:  #E0A33C;
--danger:   #E2483D;   /* shares accent; destructive is confirmed by copy, not a new color */
```

Contrast check: `--text-primary` on `--surface-1` ≈ 13.9:1; `--accent` on `--bg-0` ≈ 5.0:1; `--text-on-accent` on `--accent` ≈ 5.2:1. All pass WCAG AA for their sizes.

---

## 4. Spacing, Radius, Shadow, Layers

### Spacing (4px base)

```css
--space-1: 0.25rem;  /*  4px — icon gaps        */
--space-2: 0.5rem;   /*  8px — intra-component  */
--space-3: 0.75rem;  /* 12px — chip padding     */
--space-4: 1rem;     /* 16px — screen gutter    */
--space-5: 1.25rem;  /* 20px — card padding     */
--space-6: 1.5rem;   /* 24px — between cards    */
--space-8: 2rem;     /* 32px — section breaks   */
--space-10: 2.5rem;  /* 40px — hero breathing   */
--space-12: 3rem;    /* 48px — top-of-screen    */
```

Screen gutter is always `--space-4` (16px). Bottom content padding: `calc(72px + env(safe-area-inset-bottom) + 16px)` to clear the tab bar.

### Radius

```css
--radius-s:    10px;   /* steppers, small buttons, inputs */
--radius-m:    16px;   /* list groups, chips containers */
--radius-l:    20px;   /* cards, sheets */
--radius-full: 999px;  /* pills, chips, tab indicator, rings */
--corner-cut:  14px;   /* the signature chamfer */
```

The corner-cut card combines `--radius-l` on three corners with the 14px chamfer top-left (see §1).

### Shadows — tinted to the canvas hue, used only on true elevation (timer sheet, hero)

```css
--shadow-card:  0 1px 0 rgba(244,238,228,0.04) inset, 0 8px 24px -12px rgba(5,3,1,0.8);
--shadow-sheet: 0 1px 0 rgba(244,238,228,0.06) inset, 0 -12px 40px -8px rgba(5,3,1,0.9);
--shadow-none:  none;  /* default: hairlines do the work */
```

### Z layers

```css
--z-tabbar: 100; --z-sheet: 200; --z-toast: 300;
```

---

## 5. Component Patterns

### 5.1 Today hero card (planned workout)

The first thing seen every day. Full-gutter width, corner-cut signature, sport-coded bracket.

- **Container:** `--surface-1`, corner-cut clip-path, other corners `--radius-l`, padding `--space-5` (20px), 1px `--hairline` border, `--shadow-card`. 18×18 sport bracket at top: 8px / left: 8px.
- **Eyebrow row:** `--type-eyebrow` in `--text-tertiary`: `TODAY · THU 6 JUL` left, sport tag chip right (sport `-dim` bg, sport color text, `--radius-full`, 6px 10px padding).
- **Workout name:** `--type-display-xl`, Big Shoulders 800 uppercase, `--text-primary`, margin-top `--space-3`. E.g. `HEAVY BAG + CORE`.
- **Meta line:** `--type-data-m` mono, `--text-secondary`: `45 MIN · 6 EXERCISES · RD 3/5 THIS WEEK`, margin-top `--space-2`.
- **CTA:** full-width, height **56px**, `--accent` fill, `--text-on-accent`, `--radius-s`, Big Shoulders 700 uppercase 17px letter-spacing 0.06em: `START SESSION`. Active state: `scale(0.97)` + `--accent-press`. This is the only red fill on the screen.
- **Rest-day variant:** same card, bracket in `--text-tertiary`, name `RECOVERY`, CTA becomes ghost (transparent, `--hairline-strong` border): `LOG SOMETHING ANYWAY`.

### 5.2 Time-picker chips (20 / 45 / 60 min)

Sits under the hero when re-planning ("How long do you have?").

- Horizontal row, `gap: --space-2`, each chip `flex: 1`.
- **Size:** height **52px** (thumb-first; exceeds 44px minimum). `--radius-full`.
- **Resting:** `--surface-2` fill, 1px `--hairline` border, label `--type-data-l` mono 20px `--text-secondary` (`20`), unit `--type-eyebrow` (`MIN`) below it in `--text-tertiary`, stacked and centered.
- **Selected:** `--accent-dim` fill, `--accent-line` border, number in `--accent`, unit in `--text-secondary`. Transition 200ms `var(--ease-out)`.
- Exactly one selectable; tap feedback `scale(0.97)`.

### 5.3 Exercise row with set logging (steppers)

The workhorse. Rows in a list group (`--surface-1`, `--radius-m`) divided by `--hairline` top borders — no per-row cards.

- **Collapsed row:** min-height **64px**, padding `--space-4` horizontal. Left: exercise name `--type-title` + prescription below in `--type-data-s` mono `--text-tertiary` (`4 × 8 @ 60KG`). Right: sets-done fraction `--type-data-m` mono (`2/4`) — turns `--positive` when complete. Whole row is the tap target (expands).
- **Expanded set logger:** one line per set: `SET 2` eyebrow, then two steppers side by side:
  - **Stepper unit:** `[ − ] value [ + ]`. Buttons **56×56px**, `--surface-2` fill, `--radius-s`, `--hairline` border, icon = 2px-stroke minus/plus 20px in `--text-primary`. Value between: `--type-data-l` mono 32px, min-width 72px centered, unit label below in `--type-eyebrow` (`KG` / `REPS`).
  - Press: `--surface-3` + `scale(0.96)`, 100ms. Long-press auto-repeats every 120ms after 400ms hold. Weight steps ±2.5, reps ±1.
- **Log set button:** full-width 52px below the steppers, ghost style; flips to `--positive` check + `SET 2 LOGGED ✓`-free (no emoji — SVG check) and auto-starts the rest timer.
- Thumb math: steppers sit in the bottom half of the expanded region; nothing critical in the top-left dead zone.

### 5.4 Rest timer

A bottom sheet (not a modal) so the exercise list stays visible above it.

- **Sheet:** `--surface-2`, top corners `--radius-l` + corner-cut on top-left with red bracket, `--shadow-sheet`, slides up 320ms `var(--ease-swift)`.
- **Countdown:** `--type-data-xl` mono 72px `--text-primary`, centered: `01:30`. Final 10s: digits turn `--accent` and pulse scale 1.00→1.03 each second (CSS keyframe).
- **Progress:** a 3px full-width bar under the digits, track `--hairline`, fill `--accent` shrinking right-to-left via `transform: scaleX()` (GPU-safe).
- **Controls:** three 52px targets — `−15` ghost, `SKIP` ghost, `+15` ghost — mono labels. Skip is center and widest.
- Bell: at 0:00 the sheet border flashes `--accent-line` twice (240ms each) and haptics fire (`navigator.vibrate([80,60,80])`).

### 5.5 Streak / weekly-target ring

Lives in the Today header, 64×64px; expanded 160×160 version on Progress.

- SVG circle, stroke-width 5 (small) / 8 (large), track `--hairline-strong`, `stroke-linecap: round`.
- **Fill:** `--accent`, animated on load via `stroke-dashoffset` transition 800ms `var(--ease-out)` with 200ms delay.
- **Center (small):** sessions this week `--type-data-l` mono (`3`) over target `--type-data-s` `--text-tertiary` (`/5`).
- **Center (large):** adds streak line below in `--type-eyebrow`: `4 WK STREAK`.
- Target met: ring and number flip to `--positive`; a 6px sport-bracket appears at the ring's top-left tangent (signature echo).

### 5.6 Dashboard charts (Progress)

Quiet, ringside-scoreboard style. No chart-library default themes.

- Plot area `--bg-1`, no border; gridlines 1px `--hairline`, horizontal only, max 4.
- Axis labels `--type-data-s` mono `--text-tertiary`. No axis lines, no legends — series are labeled inline at line-end.
- **Series colors = sport colors**, 2px lines, no dots except last point (4px, filled) with its value beside it in `--type-data-m` mono.
- Volume bars: 6px wide, `--radius-full` tops, sport color at 100%; non-current weeks at 40% alpha.
- Empty state: bracket outline centered + `--type-caption`: `Nothing logged yet. First bell rings when you do.`
- Draw-in: lines animate via `stroke-dashoffset` 600ms; bars scale from baseline `transform: scaleY()` staggered 40ms.

### 5.7 Bottom tab navigation — Today / Log / Progress / Settings

- **Bar:** fixed bottom, height `calc(64px + env(safe-area-inset-bottom))`, `--surface-2` at 92% opacity + `backdrop-filter: blur(20px)` (fixed element — blur allowed), 1px `--hairline` top border. `z-index: var(--z-tabbar)`.
- **Tabs:** 4 equal columns, each full-height tap target (≥64px). Icon 24px, 1.75px stroke (Phosphor-light style), label `--type-eyebrow` 10px below.
- **Inactive:** icon + label `--text-tertiary`. **Active:** `--text-primary`, and the signature **8×8px red corner bracket** anchored to the icon's top-left — no pill, no dot, no background. The bracket translates between tabs with 260ms `var(--ease-swift)`.
- Press: `scale(0.94)` on the icon+label group, 100ms.

---

## 6. Motion

CSS-first. MOTION_INTENSITY ≈ 5: physical, brief, never decorative-idle. All animation on `transform`/`opacity` only.

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* entrances, reveals */
--ease-swift:  cubic-bezier(0.32, 0.72, 0, 1);   /* sheets, tab bracket, layout moves */
--dur-fast: 120ms; --dur-base: 240ms; --dur-slow: 400ms;
```

- **Page-load stagger ("walkout"):** screen children get `.stagger-item` — `opacity: 0; transform: translateY(12px)` resolving over 400ms `--ease-out`, `animation-delay: calc(var(--i) * 60ms)`, max 6 steps. Hero card is always `--i: 0`.
- **Tab switch:** incoming screen fades/rises 240ms; no exit animation (feels faster).
- **Tap feedback (universal):** every interactive element compresses `scale(0.97)` (large) or `scale(0.94)` (small) on `:active`, 100ms. This is the app's haptic identity.
- **Set logged:** the row's fraction counter does a single 1.0→1.15→1.0 pop, 240ms `--ease-swift`.
- **Rest timer final-10s pulse** and **ring draw-in** as specced above.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` kills stagger delays and pulses; opacity fades remain.
- No parallax, no scroll-hijack, no perpetual loops — a tired athlete's UI holds still.

---

## 7. What makes it memorable

**The Corner Cut + bracket.** One clipped corner and a small L-bracket in your sport's color, recurring from the hero card to the active tab to the completed ring. It's the visual contract of the app: *someone is standing in your corner.* Combined with fight-poster Big Shoulders headlines and round-clock mono digits on warm canvas black, no screen of Cornerman could be mistaken for a template — or for any other fitness app.
