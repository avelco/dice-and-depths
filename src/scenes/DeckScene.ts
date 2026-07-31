import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { enableTouchTarget } from '../ui/touchTarget'
import { addBackButton } from '../ui/BackButton'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { DECK_SIZE } from '../domain/cards/Packs'
import { MAX_ACTION_SLOTS } from '../domain/cards/Deck'
import { cardDef } from '../domain/cards/Card'
import { t, tKey } from '../i18n/I18n'

interface DeckSceneData {
  fromEndRun?: boolean
}

export class DeckScene extends Phaser.Scene {
  private deck: string[] = []
  private collection: string[] = []
  private statusTxt!: Phaser.GameObjects.Text

  constructor() {
    super('DeckScene')
  }

  create() {
    const data = (this.scene.settings.data ?? {}) as DeckSceneData
    const { width, height } = this.cameras.main
    const cx = width / 2

    this.deck = MetaProgression.getActiveDeck()
    this.collection = MetaProgression.getCardCollection()

    addPixelText(this, cx, 16, t('deck.title'), {
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5)

    const slots = MetaProgression.getActionSlots()
    addPixelText(this, cx, 32, t('deck.slots', { n: slots, max: MAX_ACTION_SLOTS }), {
      fontSize: '8px',
      color: '#88aacc',
    }).setOrigin(0.5)

    this.statusTxt = addPixelText(this, cx, 46, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      wordWrap: { width: width - 16 },
      align: 'center',
    }).setOrigin(0.5)

    this.drawLists()

    if (slots < MAX_ACTION_SLOTS) {
      const unlock = addPixelText(
        this,
        cx,
        height - 72,
        t('deck.unlockSlot', { pts: MetaProgression.getSkillPoints() }),
        { fontSize: '8px', color: '#ffcc66' },
      ).setOrigin(0.5)
      enableTouchTarget(unlock, { min: 28 })
      unlock.on('pointerdown', () => {
        if (MetaProgression.tryUnlockActionSlot()) {
          AudioSystem.play('select')
          this.scene.restart(data)
        } else {
          AudioSystem.play('ui')
          this.statusTxt.setText(t('deck.unlockFail'))
        }
      })
    }

    const saveBtn = addPixelText(this, cx, height - 48, t('deck.save'), {
      fontSize: '12px',
      color: '#88cc88',
    }).setOrigin(0.5)
    enableTouchTarget(saveBtn, { min: 32 })
    saveBtn.on('pointerdown', () => {
      if (MetaProgression.setActiveDeck(this.deck)) {
        AudioSystem.play('select')
        this.scene.start('MenuScene')
      } else {
        this.statusTxt.setText(t('deck.saveFail'))
      }
    })

    if (!data.fromEndRun) {
      addBackButton(this, () => this.scene.start('MenuScene'))
    }

    bindSceneKeys(this, {
      'keydown-ESC': () => this.scene.start('MenuScene'),
    })
  }

  private drawLists() {
    const { width } = this.cameras.main
    addPixelText(this, 8, 58, t('deck.active'), {
      fontSize: '8px',
      color: '#88ff88',
    })

    let y = 70
    this.deck.forEach((id, i) => {
      const name = tKey(`card.${id}.name`, id)
      const row = addPixelText(this, 8, y, `${i + 1}. ${name}`, {
        fontSize: '8px',
        color: '#dddddd',
      })
      enableTouchTarget(row, { min: 18 })
      row.on('pointerdown', () => {
        // Remove from deck → stay in collection (already there)
        this.deck.splice(i, 1)
        this.scene.restart(this.scene.settings.data)
      })
      y += 12
    })

    addPixelText(this, width / 2 + 4, 58, t('deck.collection'), {
      fontSize: '8px',
      color: '#88aaff',
    })

    // Count available extras not fully used in deck
    const used = new Map<string, number>()
    for (const id of this.deck) used.set(id, (used.get(id) ?? 0) + 1)
    const have = new Map<string, number>()
    for (const id of this.collection) have.set(id, (have.get(id) ?? 0) + 1)

    y = 70
    const shown = new Set<string>()
    for (const id of this.collection) {
      if (shown.has(id)) continue
      shown.add(id)
      const free = (have.get(id) ?? 0) - (used.get(id) ?? 0)
      if (free <= 0) continue
      const name = tKey(`card.${id}.name`, id)
      const def = cardDef(id)
      const color =
        def?.rarity === 'legendary'
          ? '#ffcc44'
          : def?.rarity === 'rare'
            ? '#66aaff'
            : '#cccccc'
      const row = addPixelText(this, width / 2 + 4, y, `${name} x${free}`, {
        fontSize: '8px',
        color,
      })
      enableTouchTarget(row, { min: 18 })
      row.on('pointerdown', () => {
        if (this.deck.length >= DECK_SIZE) {
          this.statusTxt.setText(t('deck.full'))
          return
        }
        this.deck.push(id)
        AudioSystem.play('ui')
        this.scene.restart(this.scene.settings.data)
      })
      y += 12
      if (y > 360) break
    }

    this.statusTxt.setText(t('deck.hint', { n: this.deck.length, max: DECK_SIZE }))
  }
}
