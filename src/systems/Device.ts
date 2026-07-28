/** Coarse pointer / touch phone-tablet heuristic. */
export function isTouchMobile(): boolean {
  if (typeof window === 'undefined') return false
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const touchPoints = navigator.maxTouchPoints > 0
  const small =
    Math.min(window.screen.width, window.screen.height) <= 920
  return (coarse || touchPoints) && small
}

/** Prefer fewer / shorter combat motion effects on mobile. */
export function preferReducedMotion(): boolean {
  return isTouchMobile()
}
