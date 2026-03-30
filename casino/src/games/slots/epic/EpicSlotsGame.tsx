import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'
import { EpicReel } from './EpicReel'
import { generateReels, evaluateSpin, EPIC_SYMBOLS } from './paylines'
import type { SymbolType } from './paylines'

interface Props {
  bet: number; 
  luck: number; 
  balance: number;
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>;
  takeBet: (amount: number) => Promise<boolean>;
}

export function EpicSlotsGame({ bet, luck, balance, onResult, takeBet }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [isAuto, setIsAuto] = useState(false)
  
  // 5 arrays of 3 symbols
  const [finalReels, setFinalReels] = useState<SymbolType[][]>([
    ['J', 'Q', 'K'], ['💰', '💎', '7️⃣'], ['🃏', '⭐', 'A'], ['J', 'J', 'Q'], ['K', 'K', 'K']
  ])
  const finalReelsRef = useRef<SymbolType[][]>([['J', 'Q', 'K'], ['💰', '💎', '7️⃣'], ['🃏', '⭐', 'A'], ['J', 'J', 'Q'], ['K', 'K', 'K']])
  
  const [stoppedReels, setStoppedReels] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [bigWin, setBigWin] = useState(false)

  const triggerBigWin = () => {
    setBigWin(true)
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } })
    }, 250)
  }

  const spin = useCallback(async () => {
    if (spinning || bet > balance) {
      if (bet > balance && isAuto) setIsAuto(false)
      return
    }

    const success = await takeBet(bet)
    if (!success) return

    sounds.bet()
    setSpinning(true)
    setLastWin(null)
    setShowWin(false)
    setBigWin(false)
    setStoppedReels(0)

    const currentLuck = isAuto ? luck * 0.7 : luck
    const reels = generateReels(currentLuck)
    
    setFinalReels(reels)
    finalReelsRef.current = reels
  }, [bet, balance, spinning, luck, isAuto, takeBet])

  useEffect(() => {
    if (isAuto && !spinning && bet <= balance) {
      const timer = setTimeout(() => {
        if (isAuto) spin()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isAuto, spinning, bet, balance, spin])

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => {
      const next = prev + 1
      if (next === 5) {
        // Evaluate
        const currentReels = finalReelsRef.current
        const betPerLine = bet / 20 // 20 lines
        
        const { totalWin, winLines, scatters } = evaluateSpin(currentReels, betPerLine)

        const result: GameResult = totalWin > 0 ? 'win' : 'lose'
        
        setTimeout(() => {
          if (totalWin > 0) {
            setLastWin(totalWin)
            setShowWin(true)
            
            // Big win check
            if (totalWin >= bet * 10) {
              sounds.bigWin()
              triggerBigWin()
            } else {
              sounds.win()
            }
          } else {
            sounds.lose()
          }
          
          if (scatters >= 3) {
            // In a full implementation, trigger free spins logic here
            sounds.bigWin() // Bonus sound 
          }

          onResult(result, totalWin, { lines: winLines, scatters })
          setSpinning(false)
        }, 500)
      }
      return next
    })
  }, [bet, onResult])

  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[700px] w-full relative z-0">
      
      {/* Фоновое свечение (Неоновая магия Gambino) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-900/20 blur-[150px] rounded-full pointer-events-none -z-10" />

      {/* BIG WIN Оверлей */}
      <AnimatePresence>
        {bigWin && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 2, opacity: 0, filter: 'blur(20px)' }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="text-center font-black drop-shadow-[0_10px_20px_rgba(255,100,0,0.8)] flex flex-col items-center">
              <span className="text-[120px] bg-clip-text text-transparent bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 leading-none">BIG WIN</span>
              <span className="text-6xl text-white drop-shadow-[0_5px_10px_rgba(0,0,0,1)] mt-4">
                +${lastWin?.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frame / Машина слота */}
      <motion.div 
        className="relative mb-8"
        initial={{ rotateX: 10, y: 30, opacity: 0 }}
        animate={{ rotateX: 5, y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ perspective: '1500px' }}
      >
        {/* Заголовок */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-xl px-12 py-3 shadow-[0_10px_30px_rgba(250,204,21,0.5)] z-30">
          <h2 className="text-3xl font-black text-black tracking-widest uppercase">Epic Slots</h2>
        </div>

        {/* Рамка и Барабаны */}
        <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 shadow-[0_40px_100px_-20px_rgba(0,0,0,1),inset_0_2px_0_rgba(255,255,255,0.2)] p-6 sm:p-10 transform-gpu preserve-3d relative">
          
          <div className="flex gap-2 sm:gap-4 relative z-10">
            {[0, 1, 2, 3, 4].map(i => (
              <EpicReel
                key={i}
                index={i}
                spinning={spinning}
                finalSymbols={finalReels[i]}
                delay={i * 600} // Плавная остановка по очереди
                onStop={handleReelStop}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Зона элементов управления и результата */}
      <div className="flex flex-col items-center w-full max-w-4xl relative z-20">
        
        {/* Win display */}
        <div className="h-20 flex items-center justify-center mb-6 w-full">
          <AnimatePresence mode="wait">
            {showWin && lastWin && !bigWin && (
              <motion.div
                key="win"
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
                className="text-center bg-black/60 backdrop-blur-lg border border-yellow-500/50 px-10 py-3 rounded-full flex gap-4 items-center shadow-[0_0_30px_rgba(250,204,21,0.3)]"
              >
                <span className="text-lg font-bold tracking-widest text-yellow-500/80 uppercase">WIN</span>
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500">
                  +${lastWin.toLocaleString()}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Контролы */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-12 w-full justify-center bg-white/5 backdrop-blur-xl border border-white/10 p-4 sm:p-6 rounded-3xl shadow-2xl relative overflow-hidden">
          
          {/* Bet size info */}
          <div className="flex flex-col items-center justify-center bg-black/40 px-6 py-2 rounded-xl ring-1 ring-white/10 shadow-inner">
            <span className="text-xs text-white/50 uppercase font-bold tracking-wider mb-1">Total Bet</span>
            <span className="text-2xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">${bet.toFixed(2)}</span>
            <span className="text-[10px] text-white/40 mt-1">20 Lines / ${(bet/20).toFixed(2)}</span>
          </div>

          {/* Авто-тогл (Glassmorphic) */}
          <label className="flex flex-col items-center gap-2 cursor-pointer group">
            <span className="text-xs font-bold tracking-widest text-white/50 group-hover:text-purple-400 transition-colors">AUTO</span>
            <div className={`relative w-20 h-10 rounded-full transition-all duration-500 flex items-center px-1 shadow-inner ${
              isAuto ? 'bg-gradient-to-r from-purple-600 to-indigo-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]' : 'bg-black/50 border border-white/10'
            }`} onClick={() => setIsAuto(!isAuto)}>
               <motion.div 
                 className={`w-8 h-8 rounded-full shadow-lg ${isAuto ? 'bg-white' : 'bg-white/40'}`}
                 animate={{ x: isAuto ? 40 : 0 }} 
                 transition={{ type: 'spring', stiffness: 500, damping: 30 }} 
               />
            </div>
          </label>

          {/* Главная кнопка КРУТИТЬ */}
          <motion.div 
            whileHover={{ scale: 1.05, y: -2 }} 
            whileTap={{ scale: 0.95, y: 2 }}
            className="relative"
          >
            <div className={`absolute inset-0 bg-yellow-500 blur-2xl rounded-3xl transition-opacity duration-300 ${spinning ? 'opacity-0' : 'opacity-60'}`} />
            
            <Button 
              onClick={spin} 
              disabled={spinning || bet > balance} 
              size="lg"
              className={`relative w-48 sm:w-64 h-20 rounded-3xl text-2xl font-black tracking-widest transition-all duration-300 border-t border-white/40 text-black shadow-[0_15px_30px_rgba(0,0,0,0.5)] ${
                spinning 
                  ? 'bg-gray-800 text-white/40 border-white/5 shadow-none' 
                  : 'bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 hover:brightness-110'
              }`}
            >
              {spinning ? (
                <span className="flex items-center gap-3">
                  <motion.div animate={{ rotate: 180 }} transition={{ duration: 0.2, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full" />
                </span>
              ) : 'SPIN'}
            </Button>
          </motion.div>
        </div>

      </div>
    </div>
  )
}
