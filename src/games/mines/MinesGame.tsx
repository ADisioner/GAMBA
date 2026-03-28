import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Bomb, Diamond, Coins } from 'lucide-react'
import { sounds } from '@/lib/sounds'
import { applyLuck } from '@/lib/luck'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

const GRID_SIZE = 5
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE

function generateMines(count: number): Set<number> {
  const mines = new Set<number>()
  while (mines.size < count) mines.add(Math.floor(Math.random() * TOTAL_CELLS))
  return mines
}

function calcMultiplier(safeRevealed: number, mineCount: number): number {
  // Каждая безопасная клетка увеличивает множитель
  let mult = 1
  for (let i = 0; i < safeRevealed; i++) {
    mult *= TOTAL_CELLS / (TOTAL_CELLS - mineCount - i)
  }
  return parseFloat(mult.toFixed(2))
}

export function MinesGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [mineCount, setMineCount] = useState(5)
  const [mines, setMines] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [state, setState] = useState<'setup' | 'playing' | 'boom' | 'cashed'>('setup')
  const [multiplier, setMultiplier] = useState(1)

  const startGame = useCallback(() => {
    if (bet > balance) return
    sounds.bet()
    const m = generateMines(mineCount)
    setMines(m)
    setRevealed(new Set())
    setState('playing')
    setMultiplier(1)
  }, [bet, balance, mineCount])

  const revealCell = useCallback((idx: number) => {
    if (state !== 'playing' || revealed.has(idx)) return

    let currentMines = mines

    // Подкрутка: спасаем игрока от мины, квантово перемещая её
    if (currentMines.has(idx)) {
      const saveChance = applyLuck(0, luck)
      if (Math.random() < saveChance) {
        const emptyCells = Array.from({ length: TOTAL_CELLS }, (_, i) => i)
          .filter(i => !currentMines.has(i) && !revealed.has(i) && i !== idx)
        if (emptyCells.length > 0) {
          const newMineIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)]
          const newMines = new Set(currentMines)
          newMines.delete(idx)
          newMines.add(newMineIdx)
          setMines(newMines)
          currentMines = newMines // Обновляем локальную переменную для дальнейшей логики
        }
      }
    }

    if (currentMines.has(idx)) {
      // BOOM!
      sounds.minesBoom()
      setRevealed(new Set([...revealed, idx, ...currentMines]))
      setState('boom')
      onResult('lose', 0, { mineCount, revealed: revealed.size, hitMine: idx })
      return
    }

    sounds.minesSafe()
    const newRevealed = new Set([...revealed, idx])
    setRevealed(newRevealed)
    const safeCells = [...newRevealed].filter(i => !currentMines.has(i)).length
    const mult = calcMultiplier(safeCells, mineCount)
    setMultiplier(mult)

    // Все безопасные клетки открыты — автоматический выигрыш
    if (safeCells >= TOTAL_CELLS - mineCount) {
      setState('cashed')
      const payout = Math.floor(bet * mult)
      onResult('win', payout, { mineCount, revealed: safeCells, multiplier: mult })
    }
  }, [state, revealed, mines, mineCount, bet, onResult])

  const cashOut = useCallback(() => {
    if (state !== 'playing' || revealed.size === 0) return
    sounds.cashOut()
    setState('cashed')
    const payout = Math.floor(bet * multiplier)
    setRevealed(new Set([...revealed, ...mines]))
    onResult('win', payout, { mineCount, revealed: revealed.size, multiplier })
  }, [state, bet, multiplier, revealed, mines, mineCount, onResult])

  return (
    <div className="p-8 flex flex-col items-center">
      {state === 'setup' && (
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Количество мин: {mineCount}</p>
          <div className="flex gap-2 justify-center mb-4">
            {[1, 3, 5, 10, 15, 20].map(n => (
              <button key={n} onClick={() => setMineCount(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${mineCount === n ? 'border-gold bg-gold/20 text-gold' : 'border-gold/20 bg-marble-light/30 text-foreground/70'}`}>
                {n}
              </button>
            ))}
          </div>
          <Button onClick={startGame} size="lg" disabled={bet > balance}>💣 НАЧАТЬ</Button>
        </div>
      )}

      {/* Multiplier */}
      {state !== 'setup' && (
        <div className="mb-4 text-center">
          <p className={`text-3xl font-bold ${state === 'boom' ? 'text-neon-red' : 'text-gold'}`}>
            {state === 'boom' ? '💥 БУМ!' : `${multiplier.toFixed(2)}×`}
          </p>
          {state === 'cashed' && (
            <p className="text-neon-green font-bold mt-1">+${Math.floor(bet * multiplier).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-1.5 mb-6" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
        {Array.from({ length: TOTAL_CELLS }).map((_, idx) => {
          const isRevealed = revealed.has(idx)
          const isMine = mines.has(idx)
          const canClick = state === 'playing' && !isRevealed

          return (
            <motion.button key={idx} onClick={() => revealCell(idx)} disabled={!canClick}
              whileHover={canClick ? { scale: 1.1 } : {}}
              whileTap={canClick ? { scale: 0.95 } : {}}
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center text-xl font-bold transition-all border ${
                !isRevealed ? 'bg-marble-light border-gold/20 hover:border-gold/50 cursor-pointer'
                : isMine ? 'bg-neon-red/20 border-neon-red/50'
                : 'bg-neon-green/10 border-neon-green/30'
              }`}>
              {isRevealed ? (
                isMine ? <Bomb className="w-5 h-5 text-neon-red" /> : <Diamond className="w-5 h-5 text-neon-green" />
              ) : (
                <span className="text-gold/30">?</span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Controls */}
      {state === 'playing' && revealed.size > 0 && (
        <Button onClick={cashOut} size="lg" variant="neon">
          <Coins className="w-5 h-5" /> Забрать {Math.floor(bet * multiplier).toLocaleString()}
        </Button>
      )}
      {(state === 'boom' || state === 'cashed') && (
        <Button onClick={() => setState('setup')} size="lg" className="mt-2">🔄 Новая игра</Button>
      )}
    </div>
  )
}
