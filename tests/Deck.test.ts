import { describe, expect, it } from 'vitest'
import {
  createCombatDeck,
  drawCards,
  endTurnDraw,
  fillHand,
  playFromHand,
  slottedCards,
  HAND_SIZE,
} from '../src/domain/cards/Deck'
import { resetCardIds } from '../src/domain/cards/Card'

const DECK_IDS = [
  'strike', 'bash', 'guard', 'toxin', 'salve',
  'slash', 'barrier', 'venom', 'mend', 'fortify',
]

describe('CombatDeck', () => {
  it('fills hand to HAND_SIZE', () => {
    resetCardIds()
    const deck = createCombatDeck(DECK_IDS, 2, () => 0.5)
    fillHand(deck)
    expect(deck.hand).toHaveLength(HAND_SIZE)
    expect(deck.draw).toHaveLength(DECK_IDS.length - HAND_SIZE)
  })

  it('plays from hand into slots and endTurnDraw replenishes', () => {
    resetCardIds()
    const deck = createCombatDeck(DECK_IDS, 2, () => 0.3)
    fillHand(deck)
    const a = deck.hand[0]!.id
    const b = deck.hand[1]!.id
    expect(playFromHand(deck, a)).toBe(true)
    expect(playFromHand(deck, b)).toBe(true)
    expect(slottedCards(deck)).toHaveLength(2)
    expect(playFromHand(deck, deck.hand[0]!.id)).toBe(false) // slots full

    const drawn = endTurnDraw(deck, () => 0.2)
    expect(drawn).toBe(2)
    expect(slottedCards(deck)).toHaveLength(0)
    expect(deck.hand).toHaveLength(HAND_SIZE)
    expect(deck.discard).toHaveLength(2)
  })

  it('reshuffles discard into draw when empty', () => {
    resetCardIds()
    const deck = createCombatDeck(['strike', 'bash'], 2, () => 0.1)
    drawCards(deck, 2)
    expect(deck.draw).toHaveLength(0)
    deck.discard.push(...deck.hand.splice(0, deck.hand.length))
    drawCards(deck, 1, () => 0.4)
    expect(deck.hand).toHaveLength(1)
    expect(deck.discard).toHaveLength(0)
  })
})
