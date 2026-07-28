import Phaser from 'phaser'

/**
 * Phaser's KeyboardPlugin is shared across scenes; `.on()` handlers persist
 * after `scene.start()`. Bind keys here so they are removed on shutdown.
 */
export function bindSceneKeys(
  scene: Phaser.Scene,
  bindings: Record<string, (...args: unknown[]) => void>,
) {
  const kb = scene.input.keyboard
  if (!kb) return

  const entries = Object.entries(bindings)
  for (const [event, fn] of entries) {
    kb.on(event, fn)
  }

  const cleanup = () => {
    for (const [event, fn] of entries) {
      kb.off(event, fn)
    }
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
}
