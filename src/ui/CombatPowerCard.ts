import Phaser from 'phaser'
import { addPixelText } from './pixelText'

export type FormulaToken = { text: string; color: string }

const PLUS = '#66cc66'
const MINUS = '#cc6666'
const NUM = '#cccccc'
const MUL = '#99aacc'

/** Build spaced formula tokens; leading sign on a term becomes a colored op. */
export function formulaTokensFromParts(parts: string[]): FormulaToken[] {
  const tokens: FormulaToken[] = []
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i]
    if (i > 0) {
      if (raw.startsWith('-')) {
        tokens.push({ text: ' - ', color: MINUS })
        tokens.push({ text: raw.slice(1), color: NUM })
        continue
      }
      if (raw.startsWith('+')) {
        tokens.push({ text: ' + ', color: PLUS })
        tokens.push({ text: raw.slice(1), color: NUM })
        continue
      }
      tokens.push({ text: ' + ', color: PLUS })
      tokens.push(...expandPart(raw))
      continue
    }
    if (raw.startsWith('-')) {
      tokens.push({ text: '-', color: MINUS })
      tokens.push({ text: raw.slice(1), color: NUM })
    } else if (raw.startsWith('+')) {
      tokens.push({ text: raw.slice(1), color: NUM })
    } else {
      tokens.push(...expandPart(raw))
    }
  }
  return tokens
}

function expandPart(part: string): FormulaToken[] {
  const m = /^(\d+)x(\d+)$/.exec(part)
  if (m) {
    return [
      { text: m[1], color: NUM },
      { text: ' x ', color: MUL },
      { text: m[2], color: NUM },
    ]
  }
  return [{ text: part, color: NUM }]
}

/**
 * DAÑO | DEFENSA preview card for the combat dice panel.
 * Compact header so ATACAR can sit above it inside the same panel.
 */
export class CombatPowerCard {
  /** Vertical space from `top` through the formula row. */
  static readonly HEIGHT = 44

  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private dmgTotal: Phaser.GameObjects.Text
  private defTotal: Phaser.GameObjects.Text
  private skullGfx: Phaser.GameObjects.Graphics
  private shieldGfx: Phaser.GameObjects.Graphics
  private dmgFormula: Phaser.GameObjects.Text[] = []
  private defFormula: Phaser.GameObjects.Text[] = []
  private readonly dmgCx: number
  private readonly defCx: number
  private readonly valueY: number
  private readonly formulaY: number

  constructor(
    scene: Phaser.Scene,
    cx: number,
    top: number,
    panelW: number,
    damageLabel: string,
    defenseLabel: string,
  ) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(5)

    const half = panelW / 2
    this.dmgCx = cx - half / 2
    this.defCx = cx + half / 2
    const titleY = top + 2
    this.valueY = top + 14
    this.formulaY = top + 34

    const g = scene.add.graphics()
    g.lineStyle(1, 0x555566, 1)
    g.lineBetween(cx, top + 1, cx, top + CombatPowerCard.HEIGHT - 2)
    this.root.add(g)

    this.root.add(
      addPixelText(scene, this.dmgCx, titleY, damageLabel, {
        fontSize: '8px',
        color: '#ff6666',
      }).setOrigin(0.5),
    )
    this.root.add(
      addPixelText(scene, this.defCx, titleY, defenseLabel, {
        fontSize: '8px',
        color: '#88bbff',
      }).setOrigin(0.5),
    )

    this.dmgTotal = addPixelText(scene, this.dmgCx, this.valueY, '0', {
      fontSize: '16px',
      color: '#ff5555',
    }).setOrigin(0.5, 0)
    this.defTotal = addPixelText(scene, this.defCx, this.valueY, '0', {
      fontSize: '16px',
      color: '#88bbff',
    }).setOrigin(0.5, 0)
    this.root.add([this.dmgTotal, this.defTotal])

    this.skullGfx = this.drawSkull()
    this.shieldGfx = this.drawShield()
    this.layoutDmgRow()
    this.layoutDefRow()
  }

  setDamage(total: number, tokens: FormulaToken[]) {
    this.dmgTotal.setText(String(total))
    this.layoutDmgRow()
    this.replaceFormula(this.dmgFormula, this.dmgCx, tokens)
  }

  setDefense(total: number, tokens: FormulaToken[]) {
    this.defTotal.setText(String(total))
    this.layoutDefRow()
    this.replaceFormula(this.defFormula, this.defCx, tokens)
  }

  /** [skull][number] centered under DAÑO. */
  private layoutDmgRow() {
    const iconW = 12
    const gap = 6
    const numW = Math.max(8, this.dmgTotal.width)
    const totalW = iconW + gap + numW
    const left = this.dmgCx - totalW / 2
    this.skullGfx.setPosition(left + iconW / 2, this.valueY + 8)
    this.dmgTotal.setPosition(left + iconW + gap + numW / 2, this.valueY)
  }

  /** [number][shield] centered under DEFENSA. */
  private layoutDefRow() {
    const iconW = 12
    const gap = 6
    const numW = Math.max(8, this.defTotal.width)
    const totalW = numW + gap + iconW
    const left = this.defCx - totalW / 2
    this.defTotal.setPosition(left + numW / 2, this.valueY)
    this.shieldGfx.setPosition(left + numW + gap + iconW / 2, this.valueY + 8)
  }

  private replaceFormula(
    bucket: Phaser.GameObjects.Text[],
    cx: number,
    tokens: FormulaToken[],
  ) {
    for (const txt of bucket) txt.destroy()
    bucket.length = 0
    if (tokens.length === 0) return

    const texts = tokens.map(tok =>
      addPixelText(this.scene, 0, this.formulaY, tok.text, {
        fontSize: '8px',
        color: tok.color,
      }).setOrigin(0, 0),
    )
    const totalW = texts.reduce((s, txt) => s + txt.width, 0)
    let x = cx - totalW / 2
    for (const txt of texts) {
      txt.setX(x)
      x += txt.width
      this.root.add(txt)
      bucket.push(txt)
    }
  }

  private drawSkull(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics()
    g.fillStyle(0x888888, 1)
    g.fillCircle(0, -2, 5)
    g.fillRoundedRect(-4, 1, 8, 5, 1)
    g.fillStyle(0x1a1a2e, 1)
    g.fillCircle(-2, -2, 1.5)
    g.fillCircle(2, -2, 1.5)
    this.root.add(g)
    return g
  }

  private drawShield(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics()
    g.fillStyle(0x888888, 1)
    g.fillTriangle(0, 8, -7, -4, 7, -4)
    g.fillRect(-7, -6, 14, 4)
    g.fillStyle(0x1a1a2e, 1)
    g.fillTriangle(0, 5, -4, -2, 4, -2)
    this.root.add(g)
    return g
  }
}
