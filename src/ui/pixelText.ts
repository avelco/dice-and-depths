import Phaser from 'phaser'
import { PIXEL_FONT } from '../config'

/** Silkscreen renders crisply at 8px and 16px only (bitmap-style metrics). */
export function snapFontSize(size: string | number | undefined): string {
  const px = typeof size === 'string' ? parseInt(size, 10) : (size ?? 8)
  if (Number.isNaN(px) || px <= 10) return '8px'
  return '16px'
}

/** Crisp pixel-font text: snapped sizes, no synthetic bold, 2× internal resolution. */
export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const { fontStyle: _dropBold, fontSize, ...rest } = style
  const txt = scene.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: `"${PIXEL_FONT}"`,
    fontSize: snapFontSize(fontSize),
    ...rest,
  })
  txt.setResolution(2)
  txt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
  return txt
}

export function pixelTextStyle(
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const { fontStyle: _dropBold, fontSize, ...rest } = style
  return {
    fontFamily: `"${PIXEL_FONT}"`,
    fontSize: snapFontSize(fontSize),
    ...rest,
  }
}

export function applyPixelTextSharpness(txt: Phaser.GameObjects.Text) {
  txt.setResolution(2)
  txt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
}

export function primePixelFont(): Promise<void> {
  if (!document.fonts?.load) return Promise.resolve()
  return Promise.all([
    document.fonts.load(`8px "${PIXEL_FONT}"`),
    document.fonts.load(`16px "${PIXEL_FONT}"`),
  ]).then(() => { document.fonts.ready })
}
