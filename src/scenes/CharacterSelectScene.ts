import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { CHARACTERS } from '../domain/progression/Characters'
import { startCampaignRun } from '../domain/progression/startRun'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { charBuff, charHandicap, charLore, charName, t } from '../i18n/I18n'
import { addBackButton } from '../ui/BackButton'
import { enableTouchTarget } from '../ui/touchTarget'

function isLocked(index: number): boolean {
  const char = CHARACTERS[index]
  if (char.name === 'Pícaro') return !MetaProgression.isRogueUnlocked()
  return char.locked
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0
  private inputLocked = false
  private nameText!: Phaser.GameObjects.Text
  private loreText!: Phaser.GameObjects.Text
  private buffText!: Phaser.GameObjects.Text
  private handicapText!: Phaser.GameObjects.Text
  private lockedText!: Phaser.GameObjects.Text
  private leftArrow!: Phaser.GameObjects.Text
  private rightArrow!: Phaser.GameObjects.Text
  private startBtn!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text

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

    addBackButton(this, () => this.scene.start('MenuScene'))

    addPixelText(this, cx, 20, t('charSelect.title'), {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.leftArrow = addPixelText(this, cx - 80, height / 2 - 20, '<', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)
    enableTouchTarget(this.leftArrow, { min: 28 })

    this.rightArrow = addPixelText(this, cx + 80, height / 2 - 20, '>', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)
    enableTouchTarget(this.rightArrow, { min: 28 })

    this.leftArrow.on('pointerdown', () => this.navigate(-1))
    this.rightArrow.on('pointerdown', () => this.navigate(1))
    this.leftArrow.on('pointerover', () => this.leftArrow.setColor('#ffffaa'))
    this.leftArrow.on('pointerout', () => this.leftArrow.setColor('#ffffff'))
    this.rightArrow.on('pointerover', () => this.rightArrow.setColor('#ffffaa'))
    this.rightArrow.on('pointerout', () => this.rightArrow.setColor('#ffffff'))

    this.nameText = addPixelText(this, cx, height / 2 - 36, '', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)
    enableTouchTarget(this.nameText, { min: 24 })
    this.nameText.on('pointerdown', () => this.confirm())
    this.nameText.on('pointerover', () => {
      if (!isLocked(this.selectedIndex)) this.nameText.setColor('#ffffcc')
    })
    this.nameText.on('pointerout', () => this.nameText.setColor('#ffffff'))

    this.loreText = addPixelText(this, cx, height / 2 - 14, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      wordWrap: { width: width - 40 },
      align: 'center',
    }).setOrigin(0.5)

    this.buffText = addPixelText(this, cx, height / 2 + 12, '', {
      fontSize: '8px',
      color: '#88cc88',
    }).setOrigin(0.5)

    this.handicapText = addPixelText(this, cx, height / 2 + 28, '', {
      fontSize: '8px',
      color: '#cc8888',
    }).setOrigin(0.5)

    this.lockedText = addPixelText(this, cx, height / 2 + 48, '', {
      fontSize: '8px',
      color: '#cc6666',
    }).setOrigin(0.5)

    this.startBtn = addPixelText(this, cx, height - 40, t('charSelect.descend'), {
      fontSize: '16px',
      color: '#88cc88',
    }).setOrigin(0.5)
    enableTouchTarget(this.startBtn, { min: 28 })
    this.startBtn.on('pointerdown', () => this.confirm())
    this.startBtn.on('pointerover', () => {
      if (!isLocked(this.selectedIndex)) this.startBtn.setColor('#ccffcc')
    })
    this.startBtn.on('pointerout', () => this.refresh())

    this.hintText = addPixelText(this, cx, height - 18, t('charSelect.hint'), {
      fontSize: '8px',
      color: '#777777',
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
    const char = CHARACTERS[this.selectedIndex]
    const locked = isLocked(this.selectedIndex)
    this.nameText.setText(charName(char.name))
    this.nameText.setColor('#ffffff')
    this.loreText.setText(charLore(char.name))
    this.buffText.setText(`${t('charSelect.buff')}: ${charBuff(char.name)}`)
    this.handicapText.setText(`${t('charSelect.handicap')}: ${charHandicap(char.name)}`)
    this.lockedText.setText(locked ? t('charSelect.locked') : '')
    this.startBtn.setText(locked ? t('charSelect.blocked') : t('charSelect.descend'))
    this.startBtn.setColor(locked ? '#666666' : '#88cc88')
    this.hintText.setText(
      locked ? t('charSelect.hintLocked') : t('charSelect.hint'),
    )
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
