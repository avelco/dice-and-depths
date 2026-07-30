import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { CHARACTERS } from '../domain/progression/Characters'
import { startCampaignRun } from '../domain/progression/startRun'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { charBuff, charHandicap, charLore, charName, t } from '../i18n/I18n'
import { addBackButton } from '../ui/BackButton'
import { enableTouchTarget } from '../ui/touchTarget'

function isLocked(index: number): boolean {
  return CHARACTERS[index].locked
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0
  private inputLocked = false

  private nameText!: Phaser.GameObjects.Text
  private loreText!: Phaser.GameObjects.Text
  private statsText!: Phaser.GameObjects.Text
  private strengthLabel!: Phaser.GameObjects.Text
  private strengthText!: Phaser.GameObjects.Text
  private weaknessLabel!: Phaser.GameObjects.Text
  private weaknessText!: Phaser.GameObjects.Text
  private lockedText!: Phaser.GameObjects.Text
  private leftArrow!: Phaser.GameObjects.Text
  private rightArrow!: Phaser.GameObjects.Text
  private startBtn!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
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
    this.leftArrow.on('pointerover', () => this.leftArrow.setColor('#ffffaa'))
    this.leftArrow.on('pointerout', () => this.leftArrow.setColor('#ffffff'))
    this.rightArrow.on('pointerover', () => this.rightArrow.setColor('#ffffaa'))
    this.rightArrow.on('pointerout', () => this.rightArrow.setColor('#ffffff'))

    this.nameText = addPixelText(this, cx, nameY, '', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: this.contentW - 24 },
      align: 'center',
    }).setOrigin(0.5)
    enableTouchTarget(this.nameText, { min: 28 })
    this.nameText.on('pointerdown', () => this.confirm())
    this.nameText.on('pointerover', () => {
      if (!isLocked(this.selectedIndex)) this.nameText.setColor('#ffffcc')
    })
    this.nameText.on('pointerout', () => this.nameText.setColor('#ffffff'))

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

    // Info card
    this.panelTop = nameY + 70
    this.panelGfx = this.add.graphics().setDepth(1)

    const pad = 14
    const colX = 24 + pad
    let y = this.panelTop + 12

    this.statsText = addPixelText(this, cx, y, '', {
      fontSize: '8px',
      color: '#ddeeff',
      align: 'center',
      wordWrap: { width: this.contentW - 20 },
    }).setOrigin(0.5, 0).setDepth(2)

    this.strengthLabel = addPixelText(this, colX, y, t('charSelect.buff'), {
      fontSize: '8px',
      color: '#66aa66',
    }).setOrigin(0, 0).setDepth(2)

    this.strengthText = addPixelText(this, colX, y, '', {
      fontSize: '8px',
      color: '#88cc88',
      wordWrap: { width: this.contentW - 28 },
      align: 'left',
    }).setOrigin(0, 0).setDepth(2)

    this.weaknessLabel = addPixelText(this, colX, y, t('charSelect.handicap'), {
      fontSize: '8px',
      color: '#aa6666',
    }).setOrigin(0, 0).setDepth(2)

    this.weaknessText = addPixelText(this, colX, y, '', {
      fontSize: '8px',
      color: '#cc8888',
      wordWrap: { width: this.contentW - 28 },
      align: 'left',
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
    this.startBtn.on('pointerover', () => {
      if (!isLocked(this.selectedIndex)) this.startBtn.setColor('#ccffcc')
    })
    this.startBtn.on('pointerout', () => this.refresh())

    // Above the bottom-left back chip so they never overlap.
    this.hintText = addPixelText(this, cx, height - 34, t('charSelect.hint'), {
      fontSize: '8px',
      color: '#666666',
      wordWrap: { width: width - 24 },
      align: 'center',
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
    this.nameText.setColor('#ffffff')
    this.pageText.setText(`${this.selectedIndex + 1}/${CHARACTERS.length}`)
    this.loreText.setText(charLore(char.name))

    this.statsText.setText(
      t('charSelect.statsLine', {
        hp: char.maxHp,
        dice: char.diceAtk,
        rerolls: char.rerollAtk,
      }),
    )

    this.strengthLabel.setText(t('charSelect.buff'))
    this.strengthText.setText(charBuff(char.name))
    this.weaknessLabel.setText(t('charSelect.handicap'))
    this.weaknessText.setText(charHandicap(char.name))

    this.lockedText.setText(locked ? t('charSelect.locked') : '')
    this.startBtn.setText(locked ? t('charSelect.blocked') : t('charSelect.descend'))
    this.startBtn.setColor(locked ? '#666666' : '#88cc88')
    this.hintText.setText(
      locked ? t('charSelect.hintLocked') : t('charSelect.hint'),
    )

    // Layout inside card: stats → ventaja → debilidad
    let y = this.panelTop + 12
    this.statsText.setPosition(cx, y)
    y += Math.ceil(this.statsText.height) + 12

    this.strengthLabel.setPosition(colX, y)
    y += Math.ceil(this.strengthLabel.height) + 2
    this.strengthText.setPosition(colX, y)
    y += Math.ceil(this.strengthText.height) + 10

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

    // Dim locked characters slightly
    const alpha = locked ? 0.75 : 1
    this.loreText.setAlpha(alpha)
    this.statsText.setAlpha(alpha)
    this.strengthText.setAlpha(alpha)
    this.weaknessText.setAlpha(alpha)
  }

  private confirm() {
    if (this.inputLocked) return
    const char = CHARACTERS[this.selectedIndex]
    if (isLocked(this.selectedIndex)) return
    this.inputLocked = true
    AudioSystem.unlock()
    AudioSystem.play('select')

    const state = startCampaignRun(char.name)
    this.time.delayedCall(150, () => this.scene.start('MapScene', { runState: state }))
  }
}
