import Phaser from 'phaser'

/**
 * Make a GameObject interactive with a padded hit box (game pixels).
 *
 * Hit area is in Phaser texture / top-left space (InputManager adds
 * `displayOrigin` before Contains). Do NOT center the rect on the origin
 * (`-w/2,-h/2`) — that shifts hover up/left on origin-0.5 text.
 *
 * Avoid a large forced min height on dense vertical lists: neighbors overlap
 * and the wrong row gets pointerover. Pass `min` only for sparse buttons.
 */
export function enableTouchTarget(
  obj: Phaser.GameObjects.GameObject & {
    width: number
    height: number
  },
  opts: { pad?: number; min?: number } = {},
) {
  const pad = opts.pad ?? 2
  const min = opts.min ?? 0
  const bw = Math.max(1, Math.ceil(obj.width))
  const bh = Math.max(1, Math.ceil(obj.height))
  const w = Math.max(min, bw + pad * 2)
  const h = Math.max(min, bh + pad * 2)
  // Expand evenly around the texture bounds (0,0)-(bw,bh).
  const x = (bw - w) / 2
  const y = (bh - h) / 2
  ;(obj as Phaser.GameObjects.GameObject).setInteractive({
    hitArea: new Phaser.Geom.Rectangle(x, y, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })
  return obj
}

/** Expand an existing interactive zone size (for Zone/Graphics). */
export function minZoneSize(
  w: number,
  h: number,
  min = 24,
): { w: number; h: number } {
  return { w: Math.max(min, w), h: Math.max(min, h) }
}
