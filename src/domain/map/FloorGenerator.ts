import type { MapNodeKind } from './NodeTypes'
import { t } from '../../i18n/I18n'

export function nodeColor(kind: MapNodeKind): number {
  switch (kind) {
    case 'start': return 0x44aa44
    case 'boss': return 0xcc3333
    case 'combat': return 0x888888
    case 'elite': return 0xcc6622
    case 'event': return 0x8866cc
    case 'shop': return 0xccaa44
    case 'rest': return 0x44aaaa
    default: return 0x888888
  }
}

export function nodeName(kind: MapNodeKind): string {
  switch (kind) {
    case 'start': return t('map.node.start')
    case 'combat': return t('map.node.combat')
    case 'elite': return t('map.node.elite')
    case 'event': return t('map.node.event')
    case 'shop': return t('map.node.shop')
    case 'rest': return t('map.node.rest')
    case 'boss': return t('map.node.boss')
    default: return '?'
  }
}

/** Short icon glyph for map nodes (Silkscreen-safe ASCII). */
export function nodeIcon(kind: MapNodeKind): string {
  switch (kind) {
    case 'start': return '>'
    case 'combat': return 'X'
    case 'elite': return '!'
    case 'event': return '?'
    case 'shop': return '$'
    case 'rest': return '+'
    case 'boss': return 'B'
    default: return '·'
  }
}
