import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface IBottomLayerProps {
  children: ReactNode
}

/**
 * Renders bottom-pinned chrome (sheets, rest timer, toasts) into
 * document.body. Inside a screen, animated ancestors (screen entrance,
 * stagger items) can become the containing block for position: fixed and
 * detach the chrome from the viewport — portaling out makes that impossible.
 */
export function BottomLayer({ children }: IBottomLayerProps) {
  return createPortal(children, document.body)
}
