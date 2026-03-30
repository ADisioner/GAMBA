/**
 * Звуковая система GAMBA — синтезированные эффекты через Web Audio API.
 * Улучшенные "Luxury" звуки с мягкими атаками, гармониками и богатыми текстурами.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/** Создает мягкий ADSR-образный Envelope для более натурального звучания */
function playLuxuryTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, harmonics = false) {
  const ctx = getCtx()
  const now = ctx.currentTime
  
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  
  // Luxury ADSR Envelope
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume, now + 0.02) // Мягкая атака
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration) // Плавное затухание
  
  osc.connect(gain)
  gain.connect(ctx.destination)
  
  osc.start(now)
  osc.stop(now + duration)
  
  // Добавляем теплые гармоники для "богатого" звука
  if (harmonics) {
    const h1 = ctx.createOscillator()
    const h1Gain = ctx.createGain()
    h1.type = 'sine'
    h1.frequency.setValueAtTime(freq * 2.01, now) // Небольшой расстрой для объема
    h1Gain.gain.setValueAtTime(0, now)
    h1Gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05)
    h1Gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8)
    h1.connect(h1Gain)
    h1Gain.connect(ctx.destination)
    h1.start(now)
    h1.stop(now + duration)
  }
}

/** Белый шум (отфильтрованный для эффектов) */
function playFilteredNoise(duration: number, volume = 0.1, lowPass = 2000) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1)
  
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  
  source.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(lowPass, ctx.currentTime)
  
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

export const sounds = {
  /** Клик по кнопке — мягкий деревянный щелчок */
  click() {
    playLuxuryTone(1200, 0.08, 'sine', 0.1)
    playLuxuryTone(600, 0.05, 'triangle', 0.05)
  },

  /** Ставка сделана — звон монет */
  bet() {
    playLuxuryTone(1800, 0.15, 'sine', 0.1, true)
    setTimeout(() => playLuxuryTone(2400, 0.12, 'sine', 0.08), 40)
    setTimeout(() => playLuxuryTone(1200, 0.2, 'sine', 0.05), 80)
  },

  /** Вращение слотов — механический шелест */
  slotTick() {
    playLuxuryTone(200 + Math.random() * 50, 0.03, 'triangle', 0.06)
  },

  /** Барабан слота остановился — глухой удар */
  slotStop() {
    playLuxuryTone(150, 0.2, 'triangle', 0.15)
    playFilteredNoise(0.05, 0.05, 500)
  },

  /** Выигрыш — благородная арфа */
  win() {
    const notes = [659.25, 783.99, 1046.5, 1318.51] // E5 G5 C6 E6
    notes.forEach((freq, i) => {
      setTimeout(() => playLuxuryTone(freq, 0.6, 'sine', 0.15, true), i * 150)
    })
  },

  /** Большой выигрыш — оркестровый аккорд */
  bigWin() {
    const root = 523.25 // C5
    const chord = [1, 1.25, 1.5, 2, 2.5, 3] // Major chord harmonics
    chord.forEach((mult, i) => {
      setTimeout(() => playLuxuryTone(root * mult, 1.5, 'sine', 0.1, true), i * 100)
    })
    // Эффект дождя из монет
    for (let i = 0; i < 15; i++) {
      setTimeout(() => playLuxuryTone(3000 + Math.random() * 3000, 0.1, 'sine', 0.05), 500 + i * 80)
    }
  },

  /** Проигрыш — глубокий меланхоличный бас */
  lose() {
    playLuxuryTone(150, 0.6, 'sine', 0.15)
    setTimeout(() => playLuxuryTone(110, 0.8, 'sine', 0.1), 200)
  },

  /** Раздача карты — шелест бумаги */
  cardDeal() {
    playFilteredNoise(0.12, 0.15, 3000)
    playLuxuryTone(800, 0.05, 'sine', 0.05)
  },

  /** Переворот карты */
  cardFlip() {
    playLuxuryTone(600, 0.1, 'triangle', 0.1)
    playFilteredNoise(0.04, 0.08, 1500)
  },

  /** Рулетка — звук шарика (хрустальный перебор) */
  rouletteTick() {
    // Высокий "стеклянный" звук для шарика
    playLuxuryTone(2500 + Math.random() * 500, 0.04, 'sine', 0.08)
  },

  /** Рулетка — шарик приземлился — мягкий резонанс */
  rouletteLand() {
    playLuxuryTone(400, 0.4, 'triangle', 0.15, true)
    setTimeout(() => playLuxuryTone(800, 0.3, 'sine', 0.1), 100)
    playFilteredNoise(0.2, 0.05, 800)
  },

  /** Crash — гул взлета */
  crashTick(multiplier: number) {
    const freq = 150 + (multiplier - 1) * 300
    playLuxuryTone(Math.min(freq, 1500), 0.05, 'sine', 0.06)
  },

  /** Crash — взрыв (теперь более объемный) */
  crashExplode() {
    playFilteredNoise(1.2, 0.25, 400)
    playLuxuryTone(60, 1.0, 'sawtooth', 0.15)
    playLuxuryTone(40, 1.5, 'sine', 0.2)
  },

  /** Cash out — триумфальный подъем */
  cashOut() {
    const notes = [1046.5, 1318.51, 1567.98] // C6 E6 G6
    notes.forEach((f, i) => setTimeout(() => playLuxuryTone(f, 0.4, 'sine', 0.15, true), i * 100))
  },

  /** Mines — безопасный кристалл */
  minesSafe() {
    playLuxuryTone(1200 + Math.random() * 600, 0.15, 'sine', 0.15, true)
  },

  /** Mines — мина (подземный гул) */
  minesBoom() {
    playFilteredNoise(0.8, 0.2, 600)
    playLuxuryTone(80, 0.8, 'triangle', 0.2)
  },

  /** Бонус — небесный колокольчик */
  bonus() {
    const notes = [1046.5, 1318.51, 1567.98, 2093.00]
    notes.forEach((f, i) => setTimeout(() => playLuxuryTone(f, 1.0, 'sine', 0.2, true), i * 150))
  },

  /** Сообщение в чате */
  chatMessage() {
    playLuxuryTone(1500, 0.05, 'sine', 0.08)
    setTimeout(() => playLuxuryTone(1800, 0.05, 'sine', 0.06), 40)
  },

  /** Принудительное возобновление AudioContext (для браузеров) */
  resume() {
    getCtx();
  }
}
