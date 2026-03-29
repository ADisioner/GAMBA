import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { sounds } from '@/lib/sounds'
import { applyLuck } from '@/lib/luck'
import { useAuth } from '@/contexts/AuthContext'
import { rtdb } from '@/lib/firebase'
import { ref, update } from 'firebase/database'
import type { GameResult, MultiplayerRoom, PlayerStatus } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
  takeBet: (amount: number) => Promise<boolean>
  multiplayer?: {
    room: MultiplayerRoom | null
    joinRoom: (seat: number) => Promise<void>
    leaveRoom: () => Promise<void>
    placeBet: (bet: number) => Promise<void>
    updatePlayerStatus: (status: PlayerStatus) => Promise<void>
  }
}

const NUMBERS = Array.from({ length: 37 }, (_, i) => i)
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]

type BetType = 'red' | 'black' | 'green' | 'even' | 'odd' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3' | number

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green'
  return RED.includes(n) ? 'red' : 'black'
}

function getColorClass(n: number): string {
  const c = getColor(n)
  if (c === 'red') return 'bg-red-600 text-white'
  if (c === 'green') return 'bg-emerald-600 text-white'
  return 'bg-gray-900 text-white'
}

function getPayout(betType: BetType, result: number): number {
  if (typeof betType === 'number') return betType === result ? 35 : -1
  switch (betType) {
    case 'red': return RED.includes(result) ? 1 : -1
    case 'black': return !RED.includes(result) && result !== 0 ? 1 : -1
    case 'green': return result === 0 ? 35 : -1
    case 'even': return result !== 0 && result % 2 === 0 ? 1 : -1
    case 'odd': return result % 2 === 1 ? 1 : -1
    case 'low': return result >= 1 && result <= 18 ? 1 : -1
    case 'high': return result >= 19 && result <= 36 ? 1 : -1
    case 'dozen1': return result >= 1 && result <= 12 ? 2 : -1
    case 'dozen2': return result >= 13 && result <= 24 ? 2 : -1
    case 'dozen3': return result >= 25 && result <= 36 ? 2 : -1
    default: return -1
  }
}

/** Порядок чисел на реальном европейском колесе рулетки */
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]

export function RouletteGame({ bet, luck, houseEdge, balance, onResult, takeBet, multiplayer }: Props) {
  const { profile } = useAuth()
  const isMulti = !!multiplayer?.room
  const room = multiplayer?.room
  const isHost = room?.host === profile?.nickname

  const [selectedBet, setSelectedBet] = useState<BetType>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [ballAngle, setBallAngle] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  
  const wheelRef = useRef(0)
  const ballRef = useRef(0)

  const runAnimation = useCallback(async (winNumber: number) => {
    setSpinning(true)
    setLastWin(null)
    setResult(null)

    const slotIndex = WHEEL_ORDER.indexOf(winNumber)
    const slotAngle = (slotIndex / 37) * 360

    const wheelSpins = 3 + Math.random() * 2
    const newWheelAngle = wheelRef.current + wheelSpins * 360
    
    const targetAngle = newWheelAngle + slotAngle
    let diff = (targetAngle % 360) - (ballRef.current % 360)
    while (diff > 0) diff -= 360
    while (diff <= -360) diff += 360
    const ballSpins = 6 + Math.random() * 3
    const newBallAngle = ballRef.current - (Math.floor(ballSpins) * 360) + diff

    wheelRef.current = newWheelAngle
    ballRef.current = newBallAngle
    setWheelAngle(newWheelAngle)
    setBallAngle(newBallAngle)

    for (let i = 0; i < 20; i++) {
      setTimeout(() => sounds.rouletteTick(), i * 200 + Math.random() * 100)
    }

    await new Promise(r => setTimeout(r, 4500))
    sounds.rouletteLand()
    setResult(winNumber)
    setHistory(prev => [winNumber, ...prev].slice(0, 15))

    const payoutMult = getPayout(selectedBet, winNumber)
    const gameResult: GameResult = payoutMult > 0 ? 'win' : 'lose'
    const payout = payoutMult > 0 ? bet + bet * payoutMult : 0

    if (gameResult === 'win') { setLastWin(payout); sounds.win() }
    else { sounds.lose() }

    await onResult(gameResult, payout, { winNumber, betType: selectedBet, color: getColor(winNumber) })
    setSpinning(false)

    if (isMulti && isHost) {
      await update(ref(rtdb, `rooms/roulette/${room?.id}`), {
        status: 'waiting',
        winNumber: null
      })
    }
  }, [selectedBet, bet, onResult, isMulti, isHost, room?.id])

  const spin = useCallback(async () => {
    if (spinning || bet > balance) return
    
    if (isMulti) {
      if (!isHost) return
      // В мультиплеере ставка УЖЕ списана в GamePage при нажатии "Сделать ставку"
      const winNumber = Math.floor(Math.random() * 37)
      
      await update(ref(rtdb, `rooms/roulette/${room?.id}`), {
        winNumber,
        status: 'playing',
        updatedAt: Date.now()
      })
      return 
    }

    const success = await takeBet(bet)
    if (!success) return

    sounds.bet()
    const winningNumbers = NUMBERS.filter(n => getPayout(selectedBet, n) > 0)
    const losingNumbers = NUMBERS.filter(n => getPayout(selectedBet, n) <= 0)
    const baseChance = winningNumbers.length / 37
    const finalChance = applyLuck(baseChance, luck)

    let winNumber: number
    if (Math.random() < finalChance && winningNumbers.length > 0) {
      winNumber = winningNumbers[Math.floor(Math.random() * winningNumbers.length)]
    } else {
      winNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)]
    }
    
    runAnimation(winNumber)
  }, [spinning, bet, balance, selectedBet, isMulti, isHost, room?.id, luck, runAnimation])

  useEffect(() => {
    if (isMulti && room?.status === 'playing' && room?.winNumber !== undefined && room.winNumber !== null && !spinning) {
      runAnimation(room.winNumber)
    }
  }, [isMulti, room?.status, room?.winNumber, spinning, runAnimation])

  return (
    <div className="p-6 sm:p-8 flex flex-col items-center">
      {/* Table Title if Multiplayer */}
      {isMulti && (
        <div className="mb-6 text-center">
           <h2 className="text-2xl font-serif text-gold flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             МУЛЬТИПЛЕЕР: СТОЛ #{room?.id?.slice(-4)}
           </h2>
           <p className="text-gold/60 text-xs mt-1 uppercase tracking-widest">
             Средняя удача стола: <span className="text-gold font-bold">{(luck * 100).toFixed(1)}%</span>
           </p>
        </div>
      )}

      {/* History */}
      <div className="flex gap-1 mb-8 overflow-hidden h-8 items-center bg-black/40 px-3 rounded-full border border-gold/10">
        {history.map((n, i) => (
          <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getColorClass(n)}`}>
            {n}
          </div>
        ))}
      </div>

      {/* Roulette Wheel */}
      <div className="relative w-72 h-72 sm:w-96 sm:h-96 mb-12">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-8 border-gold/20 shadow-[0_0_50px_rgba(212,175,55,0.1)]" />
        
        {/* The Wheel */}
        <motion.div 
          className="absolute inset-2"
          animate={{ rotate: wheelAngle }}
          transition={{ duration: 4.5, ease: [0.32, 0.73, 0.44, 1] }}
        >
            <img src="/roulette-wheel.svg" className="w-full h-full" alt="Wheel" 
              onError={(e) => { 
                const target = e.currentTarget;
                if (!target.dataset.tried) {
                  target.dataset.tried = 'true';
                  target.src = 'https://cdn-icons-png.flaticon.com/512/1045/1045479.png';
                  target.style.filter = 'sepia(1) saturate(2) hue-rotate(5deg) brightness(0.8)';
                }
              }} 
            />
        </motion.div>

        {/* The Ball */}
        <motion.div
          className="absolute inset-[15%] pointer-events-none"
          animate={{ rotate: ballAngle }}
          transition={{ duration: 4.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] z-10" />
        </motion.div>

        {/* Center Result */}
        <AnimatePresence>
          {result !== null && !spinning && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
            >
              <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-gold/50 ${getColorClass(result)}`}>
                <span className="text-4xl font-serif font-bold">{result}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">{getColor(result)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Win Display */}
      <div className="h-12 mb-6">
        <AnimatePresence>
          {lastWin && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-emerald-400 font-serif text-3xl font-bold italic"
            >
              +{lastWin.toLocaleString()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bets Grid */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-md mb-8">
        <button 
          onClick={() => setSelectedBet('red')}
          disabled={spinning}
          className={`h-24 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedBet === 'red' ? 'bg-red-600/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-marble/40 border-gold/20 hover:border-red-500/50'}`}
        >
          <div className="w-8 h-8 rounded-full bg-red-600" />
          <span className="text-xs font-bold uppercase tracking-widest text-red-500">КРАСНОЕ</span>
          <span className="text-[10px] text-white/40">Выплата 2x</span>
        </button>
        <button 
          onClick={() => setSelectedBet('black')}
          disabled={spinning}
          className={`h-24 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedBet === 'black' ? 'bg-gray-900 border-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]' : 'bg-marble/40 border-gold/20 hover:border-gold/50'}`}
        >
          <div className="w-8 h-8 rounded-full bg-gray-900 border border-gold/30" />
          <span className="text-xs font-bold uppercase tracking-widest text-gold">ЧЕРНОЕ</span>
          <span className="text-[10px] text-white/40">Выплата 2x</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        {isMulti && !room?.players?.[profile?.uid ?? ''] ? (
          <Button onClick={() => multiplayer.joinRoom(0)} className="w-full bg-gold hover:bg-gold-light text-velvet-dark font-bold py-8 text-xl">
             <Plus className="mr-2 h-5 w-5" /> ЗАНЯТЬ МЕСТО ЗА СТОЛОМ
          </Button>
        ) : (
          <>
             <div className="flex gap-2 flex-wrap justify-center mb-2">
               {['red', 'black', 'green', 'even', 'odd', 'low', 'high', 'dozen1', 'dozen2', 'dozen3'].map(bt => (
                 <Button key={bt} variant={selectedBet === bt ? 'default' : 'outline'} size="sm" 
                   onClick={() => setSelectedBet(bt as BetType)} disabled={spinning} className="text-[10px] uppercase font-bold py-1 px-3">
                   {bt}
                 </Button>
               ))}
             </div>
             
             {isMulti && room?.status === 'waiting' && isHost && (
                <Button onClick={spin} disabled={spinning} size="xl" className="w-full bg-emerald-600 hover:bg-emerald-500 animate-pulse font-serif py-8 text-2xl shadow-[0_0_20px_rgba(16,163,74,0.4)]">
                   🚀 ЗАПУСТИТЬ КОЛЕСО
                </Button>
             )}

             {!isMulti && (
                <Button onClick={spin} disabled={spinning || bet > balance} size="xl" className="w-full font-serif py-8 text-2xl">
                   {spinning ? 'КРУТИМ...' : 'КРУТИТЬ'}
                </Button>
             )}

             {isMulti && room?.status === 'playing' && (
                <div className="text-gold font-bold animate-bounce py-4">ЖДЕМ РЕЗУЛЬТАТА...</div>
             )}
             
             {isMulti && !isHost && room?.status === 'waiting' && (
                <div className="text-muted-foreground text-sm italic py-4">Ожидание запуска хостом...</div>
             )}
          </>
        )}
      </div>
    </div>
  )
}
