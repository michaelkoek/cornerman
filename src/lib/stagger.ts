import type { CSSProperties } from 'react'

/** Index for the .stagger-item walkout animation delay (`--i` custom prop). */
export const st = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties
