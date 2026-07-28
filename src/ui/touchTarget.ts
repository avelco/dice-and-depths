import Phaser from 'phaser'

const MIN = 24

/**
 * Make a GameObject interactive with a minimum hit box (game pixels).
 * Hit area is in Phaser texture/top-left space (InputManager adds displayOrigin
 * before Contains) — do not origin-center the rectangle yourself.
 */
export function enableTouchTarget(
  obj: Phaser.GameObjects.GameObject & {
    width: number
    height: number
  },
  opts: { pad?: number } = {},
) {
  const pad = opts.pad ?? 4
  const bw = Math.ceil(obj.width)
  const bh = Math.ceil(obj.height)
  const w = Math.max(MIN, bw + pad * 2)
  const h = Math.max(MIN, bh + pad * 2)
  const x = -((w - bw) / 2)
  const y = -((h - bh) / 2)
  ;(obj as Phaser.GameObjects.GameObject).setInteractive({
    hitArea: new Phaser.Geom.Rectangle(x, y, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })
  return obj
}

/** Expand an existing interactive zone size (for Zone/Graphics). */
export function minZoneSize(w: number, h: number, min = MIN): { w: number; h: number } {
  return { w: Math.max(min, w), h: Math.max(min, h) }
}
