import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { CHARACTERS } from '../domain/progression/Characters'
import { startCampaignRun } from '../domain/progression/startRun'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import {
  charHandicap,
  charLore,
  charName,
  t,
  tKey,
} from '../i18n/I18n'
import { addBackButton } from '../ui/BackButton'
import { enableTouchTarget } from '../ui/touchTarget'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { describeCard } from '../ui/CardSprite'

function isLocked(index: number): boolean {
  return CHARACTERS[index].locked
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0
  private inputLocked = false

  private nameText!: Phaser.GameObjects.Text
  private loreText!: Phaser.GameObjects.Text
  private statsText!: Phaser.GameObjects.Text
  private specialLabel!: Phaser.GameObjects.Text
  private specialName!: Phaser.GameObjects.Text
  private specialDesc!: Phaser.GameObjects.Text
  private weaknessLabel!: Phaser.GameObjects.Text
  private weaknessText!: Phaser.GameObjects.Text
  private lockedText!: Phaser.GameObjects.Text
  private leftArrow!: Phaser.GameObjects.Text
  private rightArrow!: Phaser.GameObjects.Text
  private startBtn!: Phaser.GameObjects.Text
  private panelGfx!: Phaser.GameObjects.Graphics
  private pageText!: Phaser.GameObjects.Text

  private contentW = 200
  private panelTop = 0

  constructor() {
    super('CharacterSelectScene')
  }

  init() {
    this.inputLocked = false
    this.selectedIndex = 0
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    this.contentW = width - 48

    addBackButton(this, () => this.scene.start('MenuScene'))

    addPixelText(this, cx, 18, t('charSelect.title'), {
      fontSize: '12px',
      color: '#cccccc',
    }).setOrigin(0.5)

    const arrowX = 16
    const nameY = 72

    this.leftArrow = addPixelText(this, arrowX, nameY, '<', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)
    enableTouchTarget(this.leftArrow, { min: 32 })

    this.rightArrow = addPixelText(this, width - arrowX, nameY, '>', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)
    enableTouchTarget(this.rightArrow, { min: 32 })

    this.leftArrow.on('pointerdown', () => this.navigate(-1))
    this.rightArrow.on('pointerdown', () => this.navigate(1))

    this.nameText = addPixelText(this, cx, nameY, '', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: this.contentW - 24 },
      align: 'center',
    }).setOrigin(0.5)
    enableTouchTarget(this.nameText, { min: 28 })
    this.nameText.on('pointerdown', () => this.confirm())

    this.pageText = addPixelText(this, cx, nameY + 18, '', {
      fontSize: '8px',
      color: '#666677',
    }).setOrigin(0.5)

    this.loreText = addPixelText(this, cx, nameY + 36, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      wordWrap: { width: this.contentW },
      align: 'center',
    }).setOrigin(0.5, 0)

    this.panelTop = nameY + 70
    this.panelGfx = this.add.graphics().setDepth(1)

    const colX = 24 + 14
    let y = this.panelTop + 12

    this.statsText = addPixelText(this, cx, y, '', {
      fontSize: '8px',
      color: '#ddeeff',
      align: 'center',
      wordWrap: { width: this.contentW - 20 },
    }).setOrigin(0.5, 0).setDepth(2)

    this.specialLabel = addPixelText(this, colX, y, t('charSelect.signature'), {
      fontSize: '8px',
      color: '#aaccff',
    }).setOrigin(0, 0).setDepth(2)

    this.specialName = addPixelText(this, colX, y, '', {
      fontSize: '8px',
      color: '#ffffff',
      wordWrap: { width: this.contentW - 28 },
    }).setOrigin(0, 0).setDepth(2)

    this.specialDesc = addPixelText(this, colX, y, '', {
      fontSize: '8px',
      color: '#99bbdd',
      wordWrap: { width: this.contentW - 28 },
    }).setOrigin(0, 0).setDepth(2)

    this.weaknessLabel = addPixelText(this, colX, y, t('charSelect.handicap'), {
      fontSize: '8px',
      color: '#aa6666',
    }).setOrigin(0, 0).setDepth(2)

    this.weaknessText = addPixelText(this, colX, y, '', {
      fontSize: '8px',
      color: '#cc8888',
      wordWrap: { width: this.contentW - 28 },
    }).setOrigin(0, 0).setDepth(2)

    this.lockedText = addPixelText(this, cx, height - 78, '', {
      fontSize: '8px',
      color: '#cc6666',
    }).setOrigin(0.5)

    this.startBtn = addPixelText(this, cx, height - 56, t('charSelect.descend'), {
      fontSize: '14px',
      color: '#88cc88',
    }).setOrigin(0.5)
    enableTouchTarget(this.startBtn, { min: 32 })
    this.startBtn.on('pointerdown', () => this.confirm())

    addPixelText(this, cx, height - 34, t('charSelect.hint'), {
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5)

    this.refresh()

    bindSceneKeys(this, {
      'keydown-LEFT': () => this.navigate(-1),
      'keydown-RIGHT': () => this.navigate(1),
      'keydown-ENTER': () => this.confirm(),
      'keydown-ESC': () => this.scene.start('MenuScene'),
    })
  }

  private navigate(dir: number) {
    this.selectedIndex =
      (this.selectedIndex + dir + CHARACTERS.length) % CHARACTERS.length
    AudioSystem.play('ui')
    this.refresh()
  }

  private refresh() {
    const { width } = this.cameras.main
    const cx = width / 2
    const char = CHARACTERS[this.selectedIndex]
    const locked = isLocked(this.selectedIndex)
    const colX = (width - this.contentW) / 2 + 8

    this.nameText.setText(charName(char.name))
    this.pageText.setText(`${this.selectedIndex + 1}/${CHARACTERS.length}`)
    this.loreText.setText(charLore(char.name))

    this.statsText.setText(
      t('charSelect.statsLine', {
        hp: char.maxHp,
        slots: MetaProgression.getActionSlots(),
      }),
    )

    const sig = char.signatureCards[0] ?? 'strike'
    this.specialLabel.setText(t('charSelect.signature'))
    this.specialName.setText(tKey(`card.${sig}.name`, sig))
    this.specialDesc.setText(describeCard(sig))
    this.weaknessText.setText(charHandicap(char.name))

    this.lockedText.setText(locked ? t('charSelect.locked') : '')
    this.startBtn.setText(locked ? t('charSelect.blocked') : t('charSelect.descend'))
    this.startBtn.setColor(locked ? '#666666' : '#88cc88')

    let y = this.panelTop + 12
    this.statsText.setPosition(cx, y)
    y += Math.ceil(this.statsText.height) + 12
    this.specialLabel.setPosition(colX, y)
    y += Math.ceil(this.specialLabel.height) + 4
    this.specialName.setPosition(colX, y)
    y += Math.ceil(this.specialName.height) + 2
    this.specialDesc.setPosition(colX, y)
    y += Math.ceil(this.specialDesc.height) + 10
    this.weaknessLabel.setPosition(colX, y)
    y += Math.ceil(this.weaknessLabel.height) + 2
    this.weaknessText.setPosition(colX, y)
    y += Math.ceil(this.weaknessText.height) + 12

    const panelX = (width - this.contentW) / 2
    const panelH = Math.max(88, y - this.panelTop)
    this.panelGfx.clear()
    this.panelGfx.fillStyle(0x12121c, 0.9)
    this.panelGfx.fillRoundedRect(panelX, this.panelTop, this.contentW, panelH, 4)
    this.panelGfx.lineStyle(1, locked ? 0x553333 : 0x445566, 1)
    this.panelGfx.strokeRoundedRect(panelX, this.panelTop, this.contentW, panelH, 4)
  }

  private confirm() {
    if (this.inputLocked) return
    const char = CHARACTERS[this.selectedIndex]
    if (isLocked(this.selectedIndex)) return
    this.inputLocked = true
    AudioSystem.unlock()
    AudioSystem.play('select')

    if (!MetaProgression.hasOpenedStarterPacks()) {
      this.scene.start('PackOpenScene', {
        mode: 'starter',
        characterName: char.name,
      })
      return
    }

    const state = startCampaignRun(char.name)
    this.time.delayedCall(150, () => this.scene.start('MapScene', { runState: state }))
  }
}
