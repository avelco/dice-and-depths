type SfxId =
  | 'ui'
  | 'select'
  | 'dice'
  | 'reroll'
  | 'attack'
  | 'hit'
  | 'block'
  | 'hurt'
  | 'ko'
  | 'heal'
  | 'coin'
  | 'map'
  | 'combo2'
  | 'combo3'
  | 'combo4'
  | 'combo5'
  | 'combo6'
  | 'combo7'
  | 'combo8'
  | 'combo9'
  | 'comboMonster'
  | 'dodge'

/** Lightweight procedural SFX — no asset files required. */
export class AudioSystem {
  private static ctx: AudioContext | null = null
  private static muted = false
  private static master = 0.35

  static isMuted() {
    return this.muted
  }

  static setMuted(on: boolean) {
    this.muted = on
  }

  static toggleMute() {
    this.muted = !this.muted
    return this.muted
  }

  /** Call from a user gesture so browsers allow audio. */
  static unlock() {
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  static play(id: SfxId) {
    if (this.muted) return
    try {
      const ctx = this.ensureCtx()
      if (ctx.state === 'suspended') void ctx.resume()
      switch (id) {
        case 'ui':
          this.tone(880, 0.04, 'square', 0.08)
          break
        case 'select':
          this.tone(520, 0.05, 'triangle', 0.1)
          this.tone(780, 0.06, 'triangle', 0.08, 0.04)
          break
        case 'dice':
          this.noise(0.05, 0.12)
          this.tone(180 + Math.random() * 80, 0.04, 'square', 0.06)
          break
        case 'reroll':
          this.noise(0.04, 0.1)
          this.tone(240, 0.03, 'square', 0.05)
          break
        case 'attack':
          this.tone(160, 0.08, 'sawtooth', 0.12)
          this.tone(90, 0.1, 'square', 0.08, 0.03)
          break
        case 'hit':
          this.noise(0.06, 0.18)
          this.tone(220, 0.07, 'square', 0.14)
          this.tone(110, 0.09, 'sawtooth', 0.1, 0.02)
          break
        case 'block':
          this.tone(300, 0.05, 'triangle', 0.1)
          this.tone(180, 0.08, 'triangle', 0.08, 0.03)
          break
        case 'hurt':
          this.tone(140, 0.1, 'sawtooth', 0.14)
          this.tone(70, 0.14, 'square', 0.1, 0.04)
          break
        case 'ko':
          this.tone(400, 0.08, 'square', 0.12)
          this.tone(560, 0.1, 'square', 0.1, 0.07)
          this.tone(720, 0.14, 'triangle', 0.1, 0.14)
          break
        case 'heal':
          this.tone(480, 0.07, 'sine', 0.1)
          this.tone(640, 0.09, 'sine', 0.09, 0.05)
          break
        case 'coin':
          this.tone(980, 0.05, 'square', 0.09)
          this.tone(1320, 0.08, 'square', 0.07, 0.04)
          break
        case 'map':
          this.tone(360, 0.05, 'triangle', 0.09)
          break
        case 'combo2':
          this.tone(440, 0.06, 'square', 0.1)
          this.tone(660, 0.08, 'square', 0.08, 0.05)
          break
        case 'combo3':
          this.tone(520, 0.06, 'square', 0.11)
          this.tone(780, 0.09, 'triangle', 0.09, 0.05)
          break
        case 'combo4':
          this.tone(600, 0.07, 'square', 0.12)
          this.tone(900, 0.1, 'triangle', 0.1, 0.05)
          break
        case 'combo5':
          this.tone(680, 0.07, 'square', 0.12)
          this.tone(1020, 0.1, 'square', 0.1, 0.06)
          break
        case 'combo6':
          this.tone(760, 0.08, 'sawtooth', 0.12)
          this.tone(1140, 0.1, 'square', 0.1, 0.06)
          break
        case 'combo7':
          this.tone(840, 0.08, 'sawtooth', 0.13)
          this.tone(1260, 0.11, 'square', 0.1, 0.07)
          break
        case 'combo8':
          this.tone(920, 0.09, 'sawtooth', 0.14)
          this.tone(1380, 0.12, 'triangle', 0.11, 0.07)
          break
        case 'combo9':
          this.tone(1000, 0.1, 'square', 0.14)
          this.tone(1500, 0.12, 'triangle', 0.12, 0.08)
          this.tone(1800, 0.1, 'sine', 0.08, 0.16)
          break
        case 'comboMonster':
          this.tone(220, 0.08, 'sawtooth', 0.16)
          this.tone(440, 0.1, 'square', 0.14, 0.06)
          this.tone(880, 0.12, 'triangle', 0.12, 0.14)
          this.tone(1320, 0.14, 'sine', 0.1, 0.22)
          break
        case 'dodge':
          this.tone(720, 0.05, 'triangle', 0.12)
          this.tone(1080, 0.08, 'sine', 0.1, 0.04)
          break
      }
    } catch {
      // Audio unavailable — ignore
    }
  }

  private static ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    }
    return this.ctx
  }

  private static tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const ctx = this.ensureCtx()
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(this.master * volume, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  private static noise(duration: number, volume: number) {
    const ctx = this.ensureCtx()
    const sampleRate = ctx.sampleRate
    const length = Math.floor(sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    }
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buffer
    gain.gain.value = this.master * volume
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  }
}
