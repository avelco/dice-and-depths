import { getLocale } from '../i18n/I18n'

const ROTATE_ES = 'Gira el dispositivo a vertical'
const ROTATE_EN = 'Rotate your device to portrait'

/** Sync the HTML rotate overlay copy with the active locale. */
export function syncRotateHintLocale() {
  const el = document.getElementById('rotate-hint-text')
  if (!el) return
  el.textContent = getLocale() === 'en' ? ROTATE_EN : ROTATE_ES
}
