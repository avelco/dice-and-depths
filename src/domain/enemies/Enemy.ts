export class Enemy {
  name: string
  maxHp: number
  hp: number
  defense: number

  constructor(name: string, hp: number, defense: number) {
    this.name = name
    this.maxHp = hp
    this.hp = hp
    this.defense = defense
  }

  get alive(): boolean {
    return this.hp > 0
  }

  takeDamage(amount: number): number {
    const actual = Math.max(1, amount - this.defense)
    this.hp = Math.max(0, this.hp - actual)
    return actual
  }

  static forFloor(floor: number): Enemy {
    const hp = 8 + Math.floor(floor * 3 + Math.random() * 5)
    const def = Math.floor(floor * 1.2 + Math.random() * 2)
    const names = ['Slime', 'Esqueleto', 'Bandido', 'Orco', 'Espectro', 'Golem']
    const name = names[Math.min(floor - 1, names.length - 1)]
    return new Enemy(name, hp, def)
  }
}
