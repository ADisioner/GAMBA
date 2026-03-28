/**
 * Звуковая система GAMBA — синтезированные эффекты через Web Audio API.
 * Не требует внешних файлов, генерирует звуки программно.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/** Играет тон с заданной частотой, длительностью и типом волны */
function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

/** Белый шум (для crash/explosion) */
function playNoise(duration: number, volume = 0.15) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * volume
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

// === Звуковые эффекты ===

export const sounds = {
  /** Клик по кнопке */
  click() {
    playTone(800, 0.08, 'sine', 0.15)
  },

  /** Ставка сделана */
  bet() {
    playTone(600, 0.1, 'sine', 0.2)
    setTimeout(() => playTone(900, 0.1, 'sine', 0.15), 50)
  },

  /** Вращение слотов — тикающий звук */
  slotTick() {
    playTone(400 + Math.random() * 200, 0.04, 'square', 0.08)
  },

  /** Барабан слота остановился */
  slotStop() {
    playTone(300, 0.15, 'triangle', 0.2)
    setTimeout(() => playTone(500, 0.1, 'sine', 0.15), 80)
  },

  /** Выигрыш — мелодия из 4 нот */
  win() {
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.25, 'sine', 0.25), i * 120)
    })
  },

  /** Большой выигрыш — расширенная мелодия */
  bigWin() {
    const notes = [523, 659, 784, 1047, 1175, 1319, 1568] // мажорная гамма вверх
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'sine', 0.3), i * 100)
    })
    // добавляем «искры»
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(2000 + Math.random() * 2000, 0.05, 'sine', 0.1), 700 + i * 60)
    }
  },

  /** Проигрыш */
  lose() {
    playTone(300, 0.3, 'sawtooth', 0.12)
    setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.1), 150)
  },

  /** Раздача карты */
  cardDeal() {
    playNoise(0.06, 0.2)
    playTone(1200, 0.05, 'sine', 0.1)
  },

  /** Переворот карты */
  cardFlip() {
    playTone(800, 0.08, 'triangle', 0.15)
    playNoise(0.04, 0.1)
  },

  /** Рулетка — звук шарика */
  rouletteTick() {
    playTone(1800 + Math.random() * 400, 0.03, 'sine', 0.12)
  },

  /** Рулетка — шарик приземлился */
  rouletteLand() {
    playTone(600, 0.2, 'triangle', 0.2)
    setTimeout(() => playTone(800, 0.15, 'sine', 0.15), 100)
    setTimeout(() => playTone(1000, 0.1, 'sine', 0.1), 200)
  },

  /** Crash — множитель растёт */
  crashTick(multiplier: number) {
    const freq = 200 + multiplier * 100
    playTone(Math.min(freq, 2000), 0.04, 'sine', 0.08)
  },

  /** Crash — взрыв */
  crashExplode() {
    playNoise(0.5, 0.3)
    playTone(100, 0.5, 'sawtooth', 0.2)
    setTimeout(() => playTone(60, 0.4, 'sawtooth', 0.15), 100)
  },

  /** Cash out */
  cashOut() {
    playTone(800, 0.1, 'sine', 0.2)
    setTimeout(() => playTone(1200, 0.1, 'sine', 0.2), 80)
    setTimeout(() => playTone(1600, 0.15, 'sine', 0.25), 160)
  },

  /** Mines — открытие безопасной клетки */
  minesSafe() {
    playTone(800 + Math.random() * 400, 0.1, 'sine', 0.2)
  },

  /** Mines — нашли мину */
  minesBoom() {
    playNoise(0.4, 0.25)
    playTone(150, 0.4, 'sawtooth', 0.2)
    setTimeout(() => playTone(80, 0.3, 'square', 0.15), 100)
  },

  /** Ежедневный бонус */
  bonus() {
    const notes = [440, 554, 659, 880]
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.25), i * 150))
  },

  /** Сообщение в чате */
  chatMessage() {
    playTone(1200, 0.05, 'sine', 0.1)
    setTimeout(() => playTone(1500, 0.05, 'sine', 0.08), 60)
  },
}
