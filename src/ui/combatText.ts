import Phaser from 'phaser'
import { COMBAT_FONT } from '../config'

/** VT323 reads best at 20px steps on a 480×270 canvas. */
export function snapCombatFontSize(size: string | number | undefined): string {
  const px = typeof size === 'string' ? parseInt(size, 10) : (size ?? 20)
  if (Number.isNaN(px) || px <= 18) return '20px'
  if (px <= 26) return '24px'
  return '28px'
}

export function addCombatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const { fontStyle: _b, fontSize, ...rest } = style
  const txt = scene.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: `"${COMBAT_FONT}"`,
    fontSize: snapCombatFontSize(fontSize),
    ...rest,
  })
  txt.setResolution(2)
  txt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
  return txt
}

export function combatTextStyle(
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const { fontStyle: _b, fontSize, ...rest } = style
  return {
    fontFamily: `"${COMBAT_FONT}"`,
    fontSize: snapCombatFontSize(fontSize),
    ...rest,
  }
}

export function applyCombatTextSharpness(txt: Phaser.GameObjects.Text) {
  txt.setResolution(2)
  txt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
}

export function primeCombatFont(): Promise<void> {
  if (!document.fonts?.load) return Promise.resolve()
  return Promise.all([
    document.fonts.load(`20px "${COMBAT_FONT}"`),
    document.fonts.load(`24px "${COMBAT_FONT}"`),
    document.fonts.load(`28px "${COMBAT_FONT}"`),
  ]).then(() => { document.fonts.ready })
}
