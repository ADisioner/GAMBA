import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'
import { EpicReel } from './EpicReel'
import { generateReels, evaluateSpin, EPIC_SYMBOLS } from './paylines'
import type { SymbolType, WinLine } from './paylines'

interface Props {
  bet: number; 
  luck: number; 
  balance: number;
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>;
  takeBet: (amount: number) => Promise<boolean>;
}

export function EpicSlotsGame({ bet, luck, balance, onResult, takeBet }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // Блокировка кнопки до начала анимации

  const [isAuto, setIsAuto] = useState(false)
  
  const [finalReels, setFinalReels] = useState<SymbolType[][]>([
    ['J', 'Q', 'K'], ['💰', '💎', '7️⃣'], ['🃏', '⭐', 'A'], ['J', 'J', 'Q'], ['K', 'K', 'K']
  ])
  const finalReelsRef = useRef<SymbolType[][]>([['J', 'Q', 'K'], ['💰', '💎', '7️⃣'], ['🃏', '⭐', 'A'], ['J', 'J', 'Q'], ['K', 'K', 'K']])
  
  const [stoppedReels, setStoppedReels] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [bigWin, setBigWin] = useState(false)
  const [winLines, setWinLines] = useState<WinLine[]>([])
  const [currentWinLineIndex, setCurrentWinLineIndex] = useState<number>(-1)

  // Циклическое переключение выигрышных линий
  useEffect(() => {
    if (winLines.length > 0) {
      setCurrentWinLineIndex(0);
      const interval = setInterval(() => {
        setCurrentWinLineIndex(prev => (prev + 1) % winLines.length);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setCurrentWinLineIndex(-1);
    }
  }, [winLines]);

  const triggerBigWin = () => {
    setBigWin(true)
    const duration = 4000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 40, spread: 360, ticks: 100, zIndex: 100 }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)
      const particleCount = 70 * (timeLeft / duration)
      confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } })
    }, 200)
  }

  const spin = useCallback(async () => {
    // Если уже крутимся или идет обработка транзакции — блокируем. Либо если превышен баланс
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

    // Разблокируем звук для браузера
    sounds.bet()
    sounds.resume();

    // Сброс стейтов перед новым кручением
    setLastWin(null)
    setShowWin(false)
    setBigWin(false)
    setStoppedReels(0)
    setWinLines([])

    const currentLuck = isAuto ? luck * 0.7 : luck
    const reels = generateReels(currentLuck)
    
    setFinalReels(reels)
    finalReelsRef.current = reels
    setSpinning(true)
    setIsProcessing(false)
  }, [bet, balance, spinning, isProcessing, luck, isAuto, takeBet])

  useEffect(() => {
    if (isAuto && !spinning && bet <= balance) {
      const timer = setTimeout(() => {
        if (isAuto) spin()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [isAuto, spinning, bet, balance, spin])

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => {
      const next = prev + 1
      if (next === 5) {
        const currentReels = finalReelsRef.current
        const betPerLine = bet / 20 
        
        const { totalWin, winLines, scatters } = evaluateSpin(currentReels, betPerLine)
        const result: GameResult = totalWin > 0 ? 'win' : 'lose'
        
        setTimeout(() => {
          if (totalWin > 0) {
            setLastWin(totalWin)
            setShowWin(true)
            setWinLines(winLines)
            
            if (totalWin >= bet * 10) {
              sounds.bigWin()
              triggerBigWin()
            } else {
              sounds.win()
            }
          } else {
            sounds.lose()
          }
          
          if (scatters >= 3) sounds.bigWin()

          onResult(result, totalWin, { lines: winLines, scatters })
          setSpinning(false)
        }, 600)
      }
      return next
    })
  }, [bet, onResult])

  // Какие ряды подсветить для каждого барабана
  const getHighlightedRows = (reelIdx: number) => {
    if (currentWinLineIndex === -1 || !winLines[currentWinLineIndex]) return [];
    return winLines[currentWinLineIndex].positions
      .filter(p => p.col === reelIdx)
      .map(p => p.row);
  }

  return (
    <div className="p-4 sm:p-8 pt-24 flex flex-col items-center justify-center min-h-[800px] w-full relative z-0 overflow-visible">
      
      {/* LUXURY BACKGROUND */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[800px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none -z-10" />

      {/* BIG WIN OVERLAY */}
      <AnimatePresence>
        {bigWin && (
          <motion.div 
            initial={{ scale: 0.1, opacity: 0, rotate: -20 }} 
            animate={{ scale: 1, opacity: 1, rotate: 0 }} 
            exit={{ scale: 3, opacity: 0, filter: 'blur(40px)' }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="text-center font-black drop-shadow-[0_20px_40px_rgba(255,100,0,0.9)] flex flex-col items-center">
              <motion.span 
                animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-[140px] sm:text-[180px] bg-clip-text text-transparent bg-gradient-to-b from-yellow-200 via-orange-500 to-red-700 leading-none"
              >
                BIG WIN
              </motion.span>
              <span className="text-7xl sm:text-9xl text-white drop-shadow-[0_10px_20px_rgba(0,0,0,1)] mt-8">
                +${lastWin?.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN SLOT MACHINE FRAME */}
      <motion.div 
        className="relative mb-12 mt-16"
        initial={{ rotateX: 20, y: 100, opacity: 0 }}
        animate={{ rotateX: 5, y: 0, opacity: 1 }}
        transition={{ duration: 1.2, type: 'spring' }}
        style={{ perspective: '2000px' }}
      >
        {/* HEADER GLOW */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-2xl px-16 py-4 shadow-[0_15px_40px_rgba(251,191,36,0.6)] z-30 border-b-4 border-yellow-800/40 whitespace-nowrap min-w-max">
          <h2 className="text-4xl font-black text-black tracking-tighter uppercase italic px-4">Epic Slots 777</h2>
        </div>

        {/* REELS CONTAINER (LARGER) */}
        <div className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,1),inset_0_4px_0_rgba(255,255,255,0.1)] p-8 sm:p-14 transform-gpu preserve-3d relative">
          
          <div className="flex gap-4 sm:gap-6 relative z-10">
            {[0, 1, 2, 3, 4].map(i => (
              <EpicReel
                key={i}
                index={i}
                spinning={spinning}
                finalSymbols={finalReels[i]}
                delay={i * 400} 
                onStop={handleReelStop}
                highlightedRows={getHighlightedRows(i)}
              />
            ))}
          </div>

          {/* Payline Label Overlay */}
          {currentWinLineIndex !== -1 && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute -left-10 top-1/2 -translate-y-1/2 bg-yellow-500 text-black font-bold px-3 py-6 rounded-l-xl text-xl shadow-[0_0_20px_rgba(250,204,21,0.8)] z-20"
            >
              L{winLines[currentWinLineIndex].lineIndex + 1}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* WIN INFO & CONTROLS CONTAINER */}
      <div className="flex flex-col items-center w-full max-w-6xl relative z-20">
        
        {/* WIN DISPLAY */}
        <div className="h-24 flex items-center justify-center mb-8 w-full">
          <AnimatePresence mode="wait">
            {showWin && lastWin && !bigWin && (
              <motion.div
                key="win"
                initial={{ scale: 0.5, opacity: 0, y: 30 }}
                animate={{ scale: 1.2, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, filter: 'blur(20px)' }}
                className="text-center bg-black/80 backdrop-blur-2xl border-2 border-yellow-500 px-12 py-4 rounded-full flex gap-6 items-center shadow-[0_0_50px_rgba(250,204,21,0.4)]"
              >
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-bold tracking-[0.3em] text-yellow-500 uppercase">WINNER</span>
                  <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-yellow-500">
                    +${lastWin.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8 w-full bg-white/5 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl">
          
          {/* BALANCE & BET STATS */}
          <div className="flex gap-4 items-center justify-center md:justify-start">
            <div className="flex flex-col bg-black/40 px-8 py-4 rounded-2xl ring-1 ring-white/10 shadow-inner min-w-[160px]">
              <span className="text-xs text-white/40 uppercase font-black tracking-widest mb-1">Bet Amount</span>
              <span className="text-3xl font-mono text-white tracking-tighter">${bet.toFixed(0)}</span>
              <span className="text-[10px] text-yellow-500/60 font-bold mt-1">20 PAYLINES ACTIVE</span>
            </div>
          </div>

          {/* SPIN BUTTON (CENTER) */}
          <div className="flex justify-center">
            <motion.div 
              whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} 
              whileTap={{ scale: 0.92 }}
              className="relative"
            >
              <div className={`absolute inset-0 bg-yellow-400 blur-3xl rounded-full transition-opacity duration-500 ${spinning ? 'opacity-0' : 'opacity-40'}`} />
              
              <Button 
                onClick={spin} 
                disabled={spinning || isProcessing || bet > balance} 
                className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full text-3xl font-black tracking-widest transition-all duration-300 border-[6px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${
                  (spinning || isProcessing)
                    ? 'bg-gray-900 text-white/20 border-white/5 shadow-none' 
                    : 'bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 border-yellow-700/50 text-black hover:rotate-3'
                }`}
              >
                {(spinning || isProcessing) ? (
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-[6px] border-white/10 border-t-white rounded-full" 
                  />
                ) : 'SPIN'}
              </Button>
            </motion.div>
          </div>

          {/* AUTO SPIN & OPTIONS */}
          <div className="flex flex-col items-center md:items-end justify-center gap-4">
             <div className="flex items-center gap-6">
                <label className="flex flex-col items-center gap-2 cursor-pointer group">
                  <span className={`text-[10px] font-black tracking-[0.2em] transition-colors ${isAuto ? 'text-purple-400' : 'text-white/40'}`}>AUTO MODE</span>
                  <div className={`relative w-20 h-10 rounded-full transition-all duration-500 flex items-center px-1 shadow-inner ${
                    isAuto ? 'bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-black/60 border border-white/5'
                  }`} onClick={() => setIsAuto(!isAuto)}>
                    <motion.div 
                      className="w-8 h-8 rounded-full bg-white shadow-lg"
                      animate={{ x: isAuto ? 40 : 0 }} 
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }} 
                    />
                  </div>
                </label>
             </div>
          </div>
        </div>

      </div>
    </div>
  )
}

