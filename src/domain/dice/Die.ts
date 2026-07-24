export class Die {
  value = 1
  sides = 6

  roll(): number {
    this.value = Math.floor(Math.random() * this.sides) + 1
    return this.value
  }
}
