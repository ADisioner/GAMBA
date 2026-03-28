import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { sounds } from '@/lib/sounds'
import { applyLuck } from '@/lib/luck'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
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

export function RouletteGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [selectedBet, setSelectedBet] = useState<BetType>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [ballAngle, setBallAngle] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const wheelRef = useRef(0)
  const ballRef = useRef(0)

  const spin = useCallback(async () => {
    if (spinning || bet > balance) return
    sounds.bet()
    setSpinning(true)
    setLastWin(null)

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
    const slotIndex = WHEEL_ORDER.indexOf(winNumber)
    const slotAngle = (slotIndex / 37) * 360

    // Колесо крутится по часовой
    const wheelSpins = 3 + Math.random() * 2
    const newWheelAngle = wheelRef.current + wheelSpins * 360
    
    // Шарик крутится против часовой, но должен приземлиться точно на ячейку.
    // Абсолютный угол ячейки на экране = newWheelAngle + slotAngle.
    const targetAngle = newWheelAngle + slotAngle
    // Считаем насколько градусов против часовой нужно прокрутить шарик (diff от -360 до 0)
    let diff = (targetAngle % 360) - (ballRef.current % 360)
    while (diff > 0) diff -= 360
    while (diff <= -360) diff += 360
    const ballSpins = 6 + Math.random() * 3
    const newBallAngle = ballRef.current - (Math.floor(ballSpins) * 360) + diff

    wheelRef.current = newWheelAngle
    ballRef.current = newBallAngle
    setWheelAngle(newWheelAngle)
    setBallAngle(newBallAngle)

    // Тикающие звуки
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
  }, [spinning, bet, balance, selectedBet, onResult])

  return (
    <div className="p-6 sm:p-8 flex flex-col items-center">

      {/* Колесо рулетки */}
      <div className="relative w-72 h-72 sm:w-[400px] sm:h-[400px] mb-6">
        {/* Внешнее кольцо */}
        <div className="absolute inset-0 rounded-full border-[6px] border-amber-900/80 shadow-[0_0_30px_rgba(120,80,20,0.3),inset_0_0_20px_rgba(0,0,0,0.5)]" />

        {/* Колесо с числами */}
        <motion.div
          animate={{ rotate: wheelAngle }}
          transition={{ duration: 4.5, ease: [0.12, 0.5, 0.1, 1] }}
          className="absolute inset-[6px] rounded-full overflow-hidden"
        >
          {/* Секторы */}
          {WHEEL_ORDER.map((num, i) => {
            const angle = (i / 37) * 360
            const col = getColor(num)
            const bg = col === 'red' ? '#dc2626' : col === 'green' ? '#16a34a' : '#1f2937'
            return (
              <div key={num} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[2px] h-1/2 origin-bottom"
                  style={{ background: `linear-gradient(to top, transparent 40%, ${bg} 40%)` }} />
                <div className="absolute left-1/2 -translate-x-1/2 top-[8%] sm:top-[6%]"
                  style={{ transform: 'translateX(-50%)' }}>
                  <span className="text-[8px] sm:text-[10px] font-bold text-white drop-shadow-md">{num}</span>
                </div>
              </div>
            )
          })}

          {/* Цветные кольца (внутренняя часть с цветом) */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
            {WHEEL_ORDER.map((num, i) => {
              const col = getColor(num)
              const fill = col === 'red' ? '#dc2626' : col === 'green' ? '#16a34a' : '#1f2937'
              const startAngle = (i / 37) * 360 - 90
              const endAngle = ((i + 1) / 37) * 360 - 90
              const r = 78
              const ir = 52
              const x1 = 100 + r * Math.cos((startAngle * Math.PI) / 180)
              const y1 = 100 + r * Math.sin((startAngle * Math.PI) / 180)
              const x2 = 100 + r * Math.cos((endAngle * Math.PI) / 180)
              const y2 = 100 + r * Math.sin((endAngle * Math.PI) / 180)
              const x3 = 100 + ir * Math.cos((endAngle * Math.PI) / 180)
              const y3 = 100 + ir * Math.sin((endAngle * Math.PI) / 180)
              const x4 = 100 + ir * Math.cos((startAngle * Math.PI) / 180)
              const y4 = 100 + ir * Math.sin((startAngle * Math.PI) / 180)
              return (
                <path key={num}
                  d={`M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 0,0 ${x4},${y4} Z`}
                  fill={fill} stroke="#111" strokeWidth="0.5" />
              )
            })}
          </svg>
        </motion.div>

        {/* Шарик */}
        <motion.div
          animate={{ rotate: ballAngle }}
          transition={{ duration: 4.5, ease: [0.12, 0.5, 0.1, 1] }}
          className="absolute inset-[10px] rounded-full pointer-events-none z-20"
        >
          <div className="absolute left-1/2 -translate-x-1/2 top-[10px] sm:top-[14px]">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9),0_0_15px_rgba(255,255,255,0.5)]" />
          </div>
        </motion.div>

        {/* Центральный хаб */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-amber-900 via-amber-800 to-amber-950 border-4 border-gold/40 flex items-center justify-center shadow-xl">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-marble border-2 border-gold/50 flex items-center justify-center">
              <span className="text-2xl sm:text-4xl font-bold text-gold">
                {result !== null ? result : '?'}
              </span>
            </div>
          </div>
        </div>

        {/* Указатель */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-30">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-gold drop-shadow-lg" />
        </div>
      </div>

      {/* Результат */}
      <AnimatePresence>
        {result !== null && !spinning && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-4 text-center">
            <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xl font-bold ${
              getColor(result) === 'red' ? 'bg-red-600/20 text-red-400 border border-red-500/30'
              : getColor(result) === 'green' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-gray-700/50 text-gray-300 border border-gray-600/30'
            }`}>
              {result}
            </span>
            {lastWin && <p className="text-xl font-bold text-gold mt-2 animate-pulse">🎉 +${lastWin.toLocaleString()}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* История */}
      {history.length > 0 && (
        <div className="flex gap-1.5 mb-5 flex-wrap justify-center">
          {history.map((n, i) => (
            <motion.div key={`${n}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getColorClass(n)} ${i === 0 ? 'ring-2 ring-gold ring-offset-1 ring-offset-background' : 'opacity-70'}`}>
              {n}
            </motion.div>
          ))}
        </div>
      )}

      {/* Ставки */}
      <div className="w-full max-w-xl mb-5">
        {/* Числовая сетка */}
        <div className="grid grid-cols-12 gap-1 mb-3">
          <button onClick={() => setSelectedBet(0)} disabled={spinning}
            className={`col-span-12 py-2 rounded text-sm font-bold transition-all ${selectedBet === 0 ? 'bg-emerald-600 text-white ring-2 ring-gold' : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'}`}>
            0
          </button>
          {NUMBERS.slice(1).map(n => (
            <button key={n} onClick={() => setSelectedBet(n)} disabled={spinning}
              className={`py-1.5 rounded text-[11px] font-bold transition-all ${
                selectedBet === n ? 'ring-2 ring-gold scale-110 z-10' : 'hover:scale-105'
              } ${getColorClass(n)}`}>
              {n}
            </button>
          ))}
        </div>

        {/* Опции ставок */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { type: 'red' as BetType, label: 'Красное', cls: 'bg-red-600/20 text-red-400 border-red-500/30' },
            { type: 'black' as BetType, label: 'Чёрное', cls: 'bg-gray-700/30 text-gray-300 border-gray-600/30' },
            { type: 'even' as BetType, label: 'Чётное', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'odd' as BetType, label: 'Нечётное', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'low' as BetType, label: '1-18', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'high' as BetType, label: '19-36', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'dozen1' as BetType, label: '1-12', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'dozen2' as BetType, label: '13-24', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
            { type: 'dozen3' as BetType, label: '25-36', cls: 'bg-marble-light/30 text-foreground/70 border-gold/20' },
          ].map(b => (
            <button key={String(b.type)} onClick={() => setSelectedBet(b.type)} disabled={spinning}
              className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                selectedBet === b.type ? 'border-gold bg-gold/20 text-gold ring-1 ring-gold' : b.cls + ' hover:border-gold/40'
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={spin} disabled={spinning || bet > balance} size="xl" className="w-56 text-lg font-bold h-14">
        {spinning ? '⏳ Крутим...' : '🎡 КРУТИТЬ'}
      </Button>
    </div>
  )
}
