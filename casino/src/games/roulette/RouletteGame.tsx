import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

const NUMBERS = Array.from({ length: 37 }, (_, i) => i) // 0-36
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]

type BetType = 'red' | 'black' | 'green' | 'even' | 'odd' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3' | number

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green'
  return RED.includes(n) ? 'red' : 'black'
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

export function RouletteGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [selectedBet, setSelectedBet] = useState<BetType>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [lastWin, setLastWin] = useState<number | null>(null)

  const spin = useCallback(async () => {
    if (spinning || bet > balance) return
    sounds.bet()
    setSpinning(true)
    setLastWin(null)

    // Генерируем результат
    const winNumber = Math.floor(Math.random() * 37)

    // Анимация
    const spins = 5 + Math.random() * 3
    const targetAngle = (360 / 37) * winNumber
    const totalRotation = rotation + spins * 360 + targetAngle
    setRotation(totalRotation)

    // Тикающие звуки во время вращения
    for (let i = 0; i < 15; i++) {
      setTimeout(() => sounds.rouletteTick(), i * 180)
    }

    await new Promise(r => setTimeout(r, 3000))
    sounds.rouletteLand()
    setResult(winNumber)

    const payoutMult = getPayout(selectedBet, winNumber)
    const gameResult: GameResult = payoutMult > 0 ? 'win' : 'lose'
    const payout = payoutMult > 0 ? bet + bet * payoutMult : 0

    if (gameResult === 'win') { setLastWin(payout); sounds.win() }
    else { sounds.lose() }

    await onResult(gameResult, payout, { winNumber, betType: selectedBet, color: getColor(winNumber) })
    setSpinning(false)
  }, [spinning, bet, balance, selectedBet, rotation, onResult])

  const betOptions: { type: BetType; label: string; color?: string }[] = [
    { type: 'red', label: 'Красное', color: 'bg-red-600' },
    { type: 'black', label: 'Чёрное', color: 'bg-gray-800' },
    { type: 'green', label: '0', color: 'bg-green-600' },
    { type: 'even', label: 'Чётное' }, { type: 'odd', label: 'Нечётное' },
    { type: 'low', label: '1-18' }, { type: 'high', label: '19-36' },
    { type: 'dozen1', label: '1-12' }, { type: 'dozen2', label: '13-24' }, { type: 'dozen3', label: '25-36' },
  ]

  return (
    <div className="p-8 flex flex-col items-center">
      {/* Wheel */}
      <div className="relative w-64 h-64 mb-8">
        <motion.div animate={{ rotate: rotation }} transition={{ duration: 3, ease: [0.17, 0.67, 0.12, 0.99] }}
          className="w-full h-full rounded-full border-4 border-gold/60 bg-gradient-to-br from-velvet-dark to-marble flex items-center justify-center"
          style={{ background: 'conic-gradient(from 0deg, #dc2626, #1f2937, #dc2626, #1f2937, #dc2626, #1f2937, #16a34a, #dc2626, #1f2937, #dc2626, #1f2937, #dc2626)' }}>
          <div className="w-16 h-16 rounded-full bg-marble border-2 border-gold flex items-center justify-center">
            <span className="text-2xl font-bold text-gold">{result !== null ? result : '?'}</span>
          </div>
        </motion.div>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-4 h-6 bg-gold" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
      </div>

      {/* Result */}
      <AnimatePresence>
        {result !== null && !spinning && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-4 text-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold ${getColor(result) === 'red' ? 'bg-red-600/20 text-red-400' : getColor(result) === 'green' ? 'bg-green-600/20 text-green-400' : 'bg-gray-700/50 text-gray-300'}`}>
              {result} {getColor(result) === 'red' ? '🔴' : getColor(result) === 'green' ? '🟢' : '⚫'}
            </span>
            {lastWin && <p className="text-xl font-bold text-gold mt-2 animate-pulse">🎉 +{lastWin.toLocaleString()}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet options */}
      <div className="grid grid-cols-5 gap-2 mb-6 w-full max-w-lg">
        {betOptions.map(b => (
          <button key={String(b.type)} onClick={() => setSelectedBet(b.type)} disabled={spinning}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              selectedBet === b.type ? 'border-gold bg-gold/20 text-gold' : 'border-gold/20 bg-marble-light/30 text-foreground/70 hover:border-gold/40'
            }`}>
            {b.color && <span className={`inline-block w-3 h-3 rounded-full ${b.color} mr-1`} />}
            {b.label}
          </button>
        ))}
      </div>

      <Button onClick={spin} disabled={spinning || bet > balance} size="xl" className="w-48 text-lg font-bold">
        {spinning ? '⏳ Крутим...' : '🎡 КРУТИТЬ'}
      </Button>
    </div>
  )
}
