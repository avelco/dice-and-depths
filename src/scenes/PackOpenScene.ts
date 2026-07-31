import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { enableTouchTarget } from '../ui/touchTarget'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { characterByName } from '../domain/progression/Characters'
import { startCampaignRun } from '../domain/progression/startRun'
import {
  endRunPackCount,
  openPacks,
  STARTER_PACK_COUNT,
} from '../domain/cards/Packs'
import { cardDef } from '../domain/cards/Card'
import { t, tKey } from '../i18n/I18n'
import type { RunState } from '../domain/progression/RunState'

export type PackMode = 'starter' | 'endRun'

interface PackOpenData {
  mode: PackMode
  characterName?: string
  runState?: RunState
  victory?: boolean
}

export class PackOpenScene extends Phaser.Scene {
  private mode: PackMode = 'starter'
  private cards: string[] = []
  private locked = false

  constructor() {
    super('PackOpenScene')
  }

  init() {
    this.locked = false
    this.cards = []
  }

  create() {
    const data = (this.scene.settings.data ?? {}) as PackOpenData
    this.mode = data.mode ?? 'starter'
    const { width, height } = this.cameras.main
    const cx = width / 2

    if (this.mode === 'starter') {
      this.cards = openPacks(STARTER_PACK_COUNT)
      addPixelText(this, cx, 24, t('packs.starterTitle'), {
        fontSize: '12px',
        color: '#ffcc66',
      }).setOrigin(0.5)
      addPixelText(this, cx, 42, t('packs.starterSub'), {
        fontSize: '8px',
        color: '#aaaaaa',
      }).setOrigin(0.5)
    } else {
      const n = endRunPackCount(!!data.victory)
      this.cards = openPacks(n)
      MetaProgression.addCardsToCollection(this.cards)
      addPixelText(this, cx, 24, t('packs.endTitle'), {
        fontSize: '12px',
        color: '#ffcc66',
      }).setOrigin(0.5)
      addPixelText(this, cx, 42, t('packs.endSub', { n }), {
        fontSize: '8px',
        color: '#aaaaaa',
      }).setOrigin(0.5)
    }

    let y = 64
    this.cards.forEach((id, i) => {
      const def = cardDef(id)
      const name = tKey(`card.${id}.name`, id)
      const effects = def?.effects.map(e => `${e.type}${e.value}`).join(' ') ?? ''
      const color =
        def?.rarity === 'legendary'
          ? '#ffcc44'
          : def?.rarity === 'rare'
            ? '#66aaff'
            : '#cccccc'
      addPixelText(this, 16, y, `${i + 1}. ${name}  ${effects}`, {
        fontSize: '8px',
        color,
      })
      y += 14
    })

    const btn = addPixelText(this, cx, height - 40, t('packs.continue'), {
      fontSize: '12px',
      color: '#88cc88',
    }).setOrigin(0.5)
    enableTouchTarget(btn, { min: 32 })
    btn.on('pointerdown', () => this.finish(data))
    bindSceneKeys(this, {
      'keydown-ENTER': () => this.finish(data),
      'keydown-SPACE': () => this.finish(data),
    })
  }

  private finish(data: PackOpenData) {
    if (this.locked) return
    this.locked = true
    AudioSystem.play('select')

    if (this.mode === 'starter') {
      const name = data.characterName ?? 'Paladín'
      const kit = characterByName(name)
      MetaProgression.commitStarterPacks(this.cards, kit?.signatureCards ?? [])
      MetaProgression.completeTutorial()
      const state = startCampaignRun(name, 1)
      this.scene.start('MapScene', { runState: state })
      return
    }

    this.scene.start('DeckScene', { fromEndRun: true })
  }
}
