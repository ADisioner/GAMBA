import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { applyLuck } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
  takeBet: (amount: number) => Promise<boolean>
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣']
const PAYOUTS: Record<string, number> = { '7️⃣': 50, '💎': 25, '🍇': 10, '🍊': 5, '🍋': 3, '🍒': 2 }

function getWeightedSymbol(luck: number): string {
  const bonus = Math.max(0, luck / 10)
  const weights = SYMBOLS.map((_, i) => {
    const base = SYMBOLS.length - i
    return i >= 4 ? base + (base * 100 * bonus) : base
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[0]
}

function Reel({ spinning, finalSymbol, delay, onStop }: {
  spinning: boolean; finalSymbol: string; delay: number; onStop: () => void
}) {
  const [internalSpinning, setInternalSpinning] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  
  // Мы будем анимировать "ленту" значков, где наш целевой значок в центре
  const [strip, setStrip] = useState<string[]>(Array(10).fill('?').map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]))

  useEffect(() => {
    if (spinning) {
      setInternalSpinning(true)
      setIsStopping(false)
      
      // Генерируем длинную ленту, в конце которой будет наш заветный символ
      const newStrip = Array(20).fill('?').map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      // Наш финальный символ будет на 18-й позиции (чтобы после него еще было пару значков для эффекта)
      newStrip[17] = finalSymbol
      setStrip(newStrip)

      const stopTimeout = setTimeout(() => {
        setIsStopping(true)
        setInternalSpinning(false)
        sounds.slotStop()
        setTimeout(onStop, 600) // Сообщаем об остановке после завершения анимации
      }, 1500 + delay)

      return () => clearTimeout(stopTimeout)
    }
  }, [spinning, finalSymbol, delay, onStop])

  return (
    <div className="relative w-28 h-28 sm:w-36 sm:h-36 overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-[inner_0_4px_24px_rgba(0,0,0,0.6)]">
      {/* Боковые тени/градиент для глубины */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-transparent to-black/90 z-20 pointer-events-none" />
      
      <motion.div
        animate={internalSpinning ? {
          y: [0, -2000],
          transition: { 
            duration: 1.5, 
            ease: "linear", 
            repeat: Infinity 
          }
        } : isStopping ? {
          y: -17 * (typeof window !== 'undefined' && window.innerWidth < 640 ? 112 : 144) + (typeof window !== 'undefined' && window.innerWidth < 640 ? 112 : 144), 
          transition: { 
            type: "spring", 
            damping: 15, 
            stiffness: 70, 
            mass: 0.8
          }
        } : { y: 0 }}
        className="flex flex-col items-center"
      >
        {strip.map((sym, i) => (
          <div 
            key={i} 
            className="w-28 h-28 sm:w-36 h-36 flex items-center justify-center text-5xl sm:text-6xl select-none"
          >
            <span className={i === 17 ? 'drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]' : 'opacity-40 grayscale-[0.5]'}>
              {sym}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export function SlotsGame({ bet, luck, houseEdge, balance, onResult, takeBet }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAuto, setIsAuto] = useState(false)
  const [finalSymbols, setFinalSymbols] = useState<string[]>(['🍒', '💎', '🍒'])
  const finalSymbolsRef = useRef<string[]>(['🍒', '💎', '🍒'])
  const [stoppedReels, setStoppedReels] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const resultProcessed = useRef(false)

  const spin = useCallback(async () => {
    if (spinning || isProcessing || bet > balance) {
      if (bet > balance && isAuto) setIsAuto(false)
      return
    }

    setIsProcessing(true)

    const success = await takeBet(bet)
    if (!success) {
      setIsProcessing(false)
      setIsAuto(false)
      return
    }

    sounds.bet()
    setSpinning(true)
    setIsProcessing(false)
    setLastWin(null)
    setShowWin(false)
    setStoppedReels(0)
    resultProcessed.current = false

    const currentLuck = isAuto ? luck * 0.7 : luck

    const finals: string[] = []
    for (let i = 0; i < 3; i++) finals.push(getWeightedSymbol(currentLuck))

    const winChance = applyLuck(0.25, currentLuck)
    if (Math.random() < winChance) {
      const sym = getWeightedSymbol(currentLuck * 1.1)
      finals[0] = sym; finals[1] = sym; finals[2] = sym
    }

    setFinalSymbols(finals)
    finalSymbolsRef.current = finals
  }, [bet, balance, spinning, isProcessing, luck, isAuto, takeBet])

  useEffect(() => {
    if (isAuto && !spinning && bet <= balance) {
      const timer = setTimeout(() => {
        if (isAuto) spin()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isAuto, spinning, bet, balance, spin])

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => {
      const next = prev + 1
      if (next === 3) {
        const middle = finalSymbolsRef.current
        const allSame = middle[0] === middle[1] && middle[1] === middle[2]
        let payout = 0
        if (allSame) payout = bet * (PAYOUTS[middle[0]] || 2)

        const result: GameResult = payout > 0 ? 'win' : 'lose'
        
        // Показываем результат после небольшой паузы
        setTimeout(() => {
          if (payout > 0) {
            setLastWin(payout)
            setShowWin(true)
            if (allSame) sounds.bigWin()
            else sounds.win()
          } else {
            sounds.lose()
          }
          onResult(result, payout, { reels: middle, allSame })
          setSpinning(false)
        }, 300)
      }
      return next
    })
  }, [bet, onResult])

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[600px] w-full relative z-0">
      
      {/* Фоновое свечение для создания пространства */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Основной контейнер с 3D перспективой */}
      <motion.div 
        className="relative mb-12"
        initial={{ rotateX: 10, y: 20, opacity: 0 }}
        animate={{ rotateX: 5, y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ perspective: '1200px' }}
      >
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 sm:p-8 transform-gpu preserve-3d">
          
          {/* Дизайнерская линия выигрыша (лазер) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent shadow-[0_0_15px_5px_rgba(250,204,21,0.3)] z-30 pointer-events-none" />
          
          {/* Декоративные винты / крепления по краям стекла */}
          <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-white/20 shadow-inner" />
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-white/20 shadow-inner" />
          <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-white/20 shadow-inner" />
          <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-white/20 shadow-inner" />

          {/* Барабаны */}
          <div className="flex gap-4">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                spinning={spinning}
                finalSymbol={finalSymbols[i]}
                delay={i * 800} // Увеличиваем задержку для эффектности
                onStop={handleReelStop}
              />
            ))}
          </div>
        </div>

        {/* LED индикаторы-огни (улучшенные) */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="relative">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                showWin 
                  ? 'bg-yellow-400 shadow-[0_0_15px_#facc15] animate-pulse' 
                  : spinning 
                    ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' 
                    : 'bg-white/10 shadow-inner'
              }`} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Зона элементов управления и результата */}
      <div className="flex flex-col items-center w-full max-w-lg relative">
        
        {/* Win display */}
        <div className="h-24 flex items-center justify-center mb-4">
          <AnimatePresence mode="wait">
            {showWin && lastWin && (
              <motion.div
                key="win"
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="text-center bg-black/40 backdrop-blur-md border border-yellow-500/30 px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.2)]"
              >
                <p className="text-xl font-bold tracking-widest text-yellow-500/80 uppercase">Блестяще</p>
                <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-sm mt-1">
                  +${lastWin.toLocaleString()}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Контролы */}
        <div className="flex items-center gap-8 w-full justify-center bg-white/5 backdrop-blur-lg border border-white/5 p-4 rounded-3xl shadow-xl">
          
          {/* Авто-тогл (Glassmorphic) */}
          <label className="flex flex-col items-center gap-2 cursor-pointer group">
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 group-hover:text-yellow-400 transition-colors">AUTO</span>
            <div className={`relative w-16 h-8 rounded-full transition-all duration-500 flex items-center px-1 shadow-inner ${
              isAuto ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]' : 'bg-black/50 border border-white/10'
            }`} onClick={() => setIsAuto(!isAuto)}>
               <motion.div 
                 className={`w-6 h-6 rounded-full shadow-lg ${isAuto ? 'bg-white' : 'bg-white/40'}`}
                 animate={{ x: isAuto ? 32 : 0 }} 
                 transition={{ type: 'spring', stiffness: 500, damping: 30 }} 
               />
            </div>
          </label>

          {/* Главная кнопка КРУТИТЬ (Antigravity Button) */}
          <motion.div 
            whileHover={{ scale: 1.05, y: -2 }} 
            whileTap={{ scale: 0.95, y: 2 }}
            className="relative"
          >
            {/* Свечение под кнопкой */}
            <div className={`absolute inset-0 bg-yellow-500 blur-xl rounded-2xl transition-opacity duration-300 ${spinning ? 'opacity-0' : 'opacity-40'}`} />
            
            <Button 
              onClick={spin} 
              disabled={spinning || isProcessing || bet > balance} 
              size="lg"
              className={`relative w-48 sm:w-56 h-16 rounded-2xl text-lg font-black tracking-wider transition-all duration-300 border-t border-white/30 text-black shadow-[0_10px_20px_rgba(0,0,0,0.3)] ${
                (spinning || isProcessing) 
                  ? 'bg-gray-800 text-white/50 border-white/5 shadow-none' 
                  : 'bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 hover:brightness-110'
              }`}
            >
              {(spinning || isProcessing) ? (
                <span className="flex items-center gap-3">
                  <motion.div animate={{ rotate: 180 }} transition={{ duration: 0.2, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  КРУТИТСЯ...
                </span>
              ) : 'КРУТИТЬ СЛОТ'}
            </Button>
          </motion.div>
        </div>

        {/* Таблица выплат (Minimalist Luxury) */}
        <div className="mt-8 grid grid-cols-6 sm:grid-cols-7 gap-2 text-center w-full">
          {Object.entries(PAYOUTS).map(([sym, mult]) => (
            <div key={sym} className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-yellow-500/30 transition-all cursor-default group">
              <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{sym}</span>
              <span className="text-[10px] font-bold text-yellow-500/70 mt-1">x{mult}</span>
            </div>
          ))}

        </div>

      </div>
    </div>
  )
}
