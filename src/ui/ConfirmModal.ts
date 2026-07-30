import type Phaser from 'phaser'
import { addPixelText } from './pixelText'
import { enableTouchTarget } from './touchTarget'
import { AudioSystem } from '../systems/AudioSystem'

export interface ConfirmModalOpts {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel?: () => void
}

/** Full-screen dim + centered confirm card. Blocks other taps while open. */
export function showConfirmModal(scene: Phaser.Scene, opts: ConfirmModalOpts) {
  const { width, height } = scene.cameras.main
  const cx = width / 2
  const root = scene.add.container(0, 0).setDepth(200).setScrollFactor(0)

  const dim = scene.add.graphics()
  dim.fillStyle(0x000000, 0.72)
  dim.fillRect(0, 0, width, height)
  root.add(dim)

  // Swallow taps on the dimmer (cancel on outside tap).
  const blocker = scene.add
    .zone(cx, height / 2, width, height)
    .setInteractive()
  root.add(blocker)

  const cardW = Math.min(width - 28, 220)
  const cardH = 120
  const cardX = (width - cardW) / 2
  const cardY = Math.round(height / 2 - cardH / 2)

  const card = scene.add.graphics()
  card.fillStyle(0x12121c, 0.96)
  card.fillRoundedRect(cardX, cardY, cardW, cardH, 4)
  card.lineStyle(1, 0x7788aa, 1)
  card.strokeRoundedRect(cardX, cardY, cardW, cardH, 4)
  root.add(card)

  const title = addPixelText(scene, cx, cardY + 16, opts.title, {
    fontSize: '10px',
    color: '#ffcc66',
    align: 'center',
    wordWrap: { width: cardW - 20 },
  }).setOrigin(0.5)
  root.add(title)

  const body = addPixelText(scene, cx, cardY + 42, opts.body, {
    fontSize: '8px',
    color: '#cccccc',
    align: 'center',
    wordWrap: { width: cardW - 24 },
  }).setOrigin(0.5, 0)
  root.add(body)

  const btnY = cardY + cardH - 22
  let closed = false
  const close = (fn?: () => void) => {
    if (closed) return
    closed = true
    root.destroy(true)
    fn?.()
  }

  const cancel = addPixelText(scene, cx - 48, btnY, opts.cancelLabel, {
    fontSize: '9px',
    color: '#aaaaaa',
  }).setOrigin(0.5)
  enableTouchTarget(cancel, { min: 32 })
  cancel.on('pointerover', () => cancel.setColor('#ffffff'))
  cancel.on('pointerout', () => cancel.setColor('#aaaaaa'))
  cancel.on('pointerdown', () => {
    AudioSystem.play('ui')
    close(opts.onCancel)
  })
  root.add(cancel)

  const confirm = addPixelText(scene, cx + 48, btnY, opts.confirmLabel, {
    fontSize: '9px',
    color: '#ff8888',
  }).setOrigin(0.5)
  enableTouchTarget(confirm, { min: 32 })
  confirm.on('pointerover', () => confirm.setColor('#ffaaaa'))
  confirm.on('pointerout', () => confirm.setColor('#ff8888'))
  confirm.on('pointerdown', () => {
    AudioSystem.play('ui')
    close(opts.onConfirm)
  })
  root.add(confirm)

  blocker.on('pointerdown', () => {
    AudioSystem.play('ui')
    close(opts.onCancel)
  })

  return root
}
