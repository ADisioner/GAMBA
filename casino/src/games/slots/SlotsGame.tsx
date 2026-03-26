import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { applyLuck } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣']
const PAYOUTS: Record<string, number> = { '7️⃣': 50, '💎': 25, '🍇': 10, '🍊': 5, '🍋': 3, '🍒': 2 }

/** Генерирует случайную ленту символов для анимации */
function generateReelStrip(length: number): string[] {
  return Array.from({ length }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
}

function getWeightedSymbol(luck: number): string {
  // Luck повышает шанс ценных символов (индексы 4-5 = 💎, 7️⃣)
  const weights = SYMBOLS.map((_, i) => {
    const base = SYMBOLS.length - i
    return i >= 4 ? base * luck : base
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[0]
}

/** Компонент одного барабана */
function Reel({ symbols, spinning, finalSymbol, delay, onStop }: {
  symbols: string[]; spinning: boolean; finalSymbol: string; delay: number; onStop: () => void
}) {
  const [displaySymbols, setDisplaySymbols] = useState<string[]>([symbols[0], symbols[1], symbols[2]])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (spinning) {
      // Быстро меняем символы — имитация вращения
      let tick = 0
      intervalRef.current = setInterval(() => {
        tick++
        if (tick % 3 === 0) sounds.slotTick()
        setDisplaySymbols([
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        ])
      }, 60)

      // Останавливаемся после delay мс
      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        // Финальная позиция: finalSymbol в центре
        const top = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        const bottom = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        setDisplaySymbols([top, finalSymbol, bottom])
        sounds.slotStop()
        onStop()
      }, 1200 + delay)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [spinning, finalSymbol, delay, onStop])

  return (
    <div className="bg-marble-light rounded-xl border border-gold/20 overflow-hidden">
      {displaySymbols.map((sym, i) => (
        <motion.div
          key={i}
          animate={spinning ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
          transition={spinning ? { duration: 0.12, repeat: Infinity } : { duration: 0.3 }}
          className={`w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-4xl sm:text-5xl transition-all ${
            i === 1 ? 'bg-marble-light/80 scale-110 relative z-10' : 'opacity-40'
          }`}
        >
          <motion.span
            key={sym + i + (spinning ? 'spin' : 'stop')}
            initial={!spinning ? { y: -20, opacity: 0 } : false}
            animate={!spinning ? { y: 0, opacity: 1 } : {}}
            transition={{ type: 'spring', damping: 12, delay: i === 1 ? 0.05 : 0 }}
          >
            {sym}
          </motion.span>
        </motion.div>
      ))}
    </div>
  )
}

export function SlotsGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [finalSymbols, setFinalSymbols] = useState<string[]>(['🍒', '🍋', '🍊'])
  const [stoppedReels, setStoppedReels] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const resultProcessed = useRef(false)

  const spin = useCallback(async () => {
    if (spinning || bet > balance) return
    sounds.bet()
    setSpinning(true)
    setLastWin(null)
    setShowWin(false)
    setStoppedReels(0)
    resultProcessed.current = false

    // Генерируем финальные символы заранее
    const finals: string[] = []
    for (let i = 0; i < 3; i++) finals.push(getWeightedSymbol(luck))

    // С учётом luck — шанс на выигрышную линию
    const winChance = applyLuck(0.25, luck)
    if (Math.random() < winChance) {
      const sym = getWeightedSymbol(luck * 1.1)
      finals[0] = sym; finals[1] = sym; finals[2] = sym
    }

    setFinalSymbols(finals)
  }, [bet, balance, spinning, luck])

  /** Когда все 3 барабана остановились — считаем результат */
  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => {
      const next = prev + 1
      if (next >= 3 && !resultProcessed.current) {
        resultProcessed.current = true

        // Оценка результата
        const middle = finalSymbols
        const allSame = middle[0] === middle[1] && middle[1] === middle[2]
        const twoSame = middle[0] === middle[1] || middle[1] === middle[2]

        let result: GameResult = 'lose'
        let payout = 0

        if (allSame) {
          const mult = PAYOUTS[middle[0]] || 2
          payout = bet * mult
          result = 'win'
        } else if (twoSame) {
          payout = Math.floor(bet * 1.5)
          result = 'win'
        }

        if (result === 'win') {
          setLastWin(payout)
          setTimeout(() => setShowWin(true), 300)
          if (allSame) sounds.bigWin(); else sounds.win()
        } else {
          sounds.lose()
        }

        onResult(result, payout, { reels: middle, allSame, twoSame })
        setTimeout(() => setSpinning(false), 100)
      }
      return next
    })
  }, [finalSymbols, bet, onResult])

  return (
    <div className="p-8 flex flex-col items-center">
      {/* Slot machine */}
      <div className="relative mb-8">
        <div className="bg-marble rounded-2xl border-2 border-gold/40 p-6 glow-gold-sm">
          {/* Win line indicators */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-gold rounded-r-full z-20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-gold rounded-l-full z-20" />

          {/* Win line */}
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-gold/30 z-10" />

          <div className="flex gap-3">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                symbols={[SYMBOLS[i], SYMBOLS[(i+1)%6], SYMBOLS[(i+2)%6]]}
                spinning={spinning}
                finalSymbol={finalSymbols[i]}
                delay={i * 400}
                onStop={handleReelStop}
              />
            ))}
          </div>
        </div>

        {/* Декоративные огни сверху */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${showWin ? 'bg-gold animate-pulse' : 'bg-gold/30'}`} />
          ))}
        </div>
      </div>

      {/* Win display */}
      <AnimatePresence>
        {showWin && lastWin && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 8 }}
            className="mb-6 text-center"
          >
            <p className="text-4xl font-bold text-gold text-glow-gold">
              🎉 ВЫИГРЫШ!
            </p>
            <p className="text-2xl font-bold text-gold-light mt-1">
              +{lastWin.toLocaleString()} фишек
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin button */}
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button onClick={spin} disabled={spinning || bet > balance} size="xl"
          className="w-52 text-lg font-bold h-14">
          {spinning ? (
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>
                🎰
              </motion.span>
              Крутим...
            </span>
          ) : '🎰 КРУТИТЬ'}
        </Button>
      </motion.div>

      {/* Paytable */}
      <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        {Object.entries(PAYOUTS).reverse().map(([sym, mult]) => (
          <div key={sym} className="px-3 py-2 rounded-lg bg-marble-light/30 border border-gold/10 hover:border-gold/30 transition-colors">
            <span className="text-lg">{sym}{sym}{sym}</span>
            <span className="block text-gold font-semibold mt-1">×{mult}</span>
          </div>
        ))}
        <div className="px-3 py-2 rounded-lg bg-marble-light/30 border border-gold/10">
          <span className="text-lg">🔢🔢➖</span>
          <span className="block text-gold font-semibold mt-1">×1.5</span>
        </div>
      </div>
    </div>
  )
}
