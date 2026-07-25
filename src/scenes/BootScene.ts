import Phaser from 'phaser'
import { primePixelFont } from '../ui/pixelText'
import { primeCombatFont } from '../ui/combatText'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    Promise.all([primePixelFont(), primeCombatFont()])
      .then(() => this.scene.start('PreloadScene'))
      .catch(() => this.scene.start('PreloadScene'))
  }
}
