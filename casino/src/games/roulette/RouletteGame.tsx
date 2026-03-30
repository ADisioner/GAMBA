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

// Порядок чисел на американском колесе
const WHEEL_NUMBERS = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  37, // 37 = "00"
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
]

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35])

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0 || n === 37) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

function displayNumber(n: number): string {
  return n === 37 ? '00' : String(n)
}

// Типы ставок
type BetType =
  | { kind: 'straight'; number: number }
  | { kind: 'red' } | { kind: 'black' }
  | { kind: 'odd' } | { kind: 'even' }
  | { kind: 'low' } | { kind: 'high' }
  | { kind: 'dozen'; group: 1 | 2 | 3 }
  | { kind: 'column'; col: 1 | 2 | 3 }

interface PlacedBet {
  type: BetType
  amount: number
}

/** Проверяет, выиграла ли ставка */
function checkBet(bet: BetType, winNum: number): number {
  switch (bet.kind) {
    case 'straight': return bet.number === winNum ? 35 : 0
    case 'red': return RED_NUMBERS.has(winNum) ? 1 : 0
    case 'black': return BLACK_NUMBERS.has(winNum) ? 1 : 0
    case 'odd': return winNum > 0 && winNum < 37 && winNum % 2 !== 0 ? 1 : 0
    case 'even': return winNum > 0 && winNum < 37 && winNum % 2 === 0 ? 1 : 0
    case 'low': return winNum >= 1 && winNum <= 18 ? 1 : 0
    case 'high': return winNum >= 19 && winNum <= 36 ? 1 : 0
    case 'dozen': {
      if (winNum === 0 || winNum === 37) return 0
      const group = Math.ceil(winNum / 12) as 1 | 2 | 3
      return group === bet.group ? 2 : 0
    }
    case 'column': {
      if (winNum === 0 || winNum === 37) return 0
      const col = ((winNum - 1) % 3) + 1
      return col === bet.col ? 2 : 0
    }
    default: return 0
  }
}

/** Уникальный ключ для типа ставки — для объединения одинаковых */
function betKey(bt: BetType): string {
  switch (bt.kind) {
    case 'straight': return `s_${bt.number}`
    case 'dozen': return `d_${bt.group}`
    case 'column': return `c_${bt.col}`
    default: return bt.kind
  }
}

// ==================== WHEEL COMPONENT ====================

function RouletteWheel({ spinning, winNumber, onSpinEnd }: {
  spinning: boolean; winNumber: number; onSpinEnd: () => void
}) {
  const segAngle = 360 / 38
  const [rotation, setRotation] = useState(0)
  const spinRef = useRef(false)
  const tickRef = useRef(0)

  useEffect(() => {
    if (!spinning) return
    spinRef.current = true

    // Вычисляем целевой угол — индекс числа на колесе
    const idx = WHEEL_NUMBERS.indexOf(winNumber)
    // Минимум 5 полных оборотов + точный угол к ячейке (с центровкой)
    const targetAngle = 360 * 7 + (360 - idx * segAngle - segAngle / 2)

    setRotation(prev => prev + targetAngle)

    // Звуки тиков во время вращения
    const tickInterval = setInterval(() => {
      if (spinRef.current) {
        tickRef.current++
        if (tickRef.current % 3 === 0) sounds.rouletteTick()
      }
    }, 120)

    // Остановка
    const timer = setTimeout(() => {
      spinRef.current = false
      clearInterval(tickInterval)
      sounds.rouletteLand()
      onSpinEnd()
    }, 5000) // 5 секунд вращение

    return () => {
      clearInterval(tickInterval)
      clearTimeout(timer)
    }
  }, [spinning, winNumber, onSpinEnd, segAngle])

  const colorMap: Record<string, string> = {
    red: '#c0392b',
    black: '#1a1a2e',
    green: '#1a6b3c'
  }

  return (
    <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto">
      {/* Указатель */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
      </div>

      {/* Внешнее кольцо свечения */}
      <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-gold/20 via-transparent to-gold/20 blur-lg pointer-events-none" />

      {/* Колесо */}
      <motion.div
        className="w-full h-full rounded-full ring-4 ring-gold/40 shadow-[0_0_50px_rgba(212,175,55,0.3),inset_0_0_0_6px_#2a2a1a,inset_0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden relative bg-black/80"
        animate={{ rotate: rotation }}
        transition={{
          duration: spinning ? 5 : 0,
          ease: [0.15, 0.85, 0.35, 1.0]
        }}
      >
        {/* Сегменты рулетки через conic-gradient */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${WHEEL_NUMBERS.map((n, i) => {
              const c = colorMap[getColor(n)]
              const start = (i / 38) * 100
              const end = ((i + 1) / 38) * 100
              return `${c} ${start}% ${end}%`
            }).join(', ')})`
          }}
        />

        {/* Числа на колесе */}
        {WHEEL_NUMBERS.map((n, i) => {
          const angle = i * segAngle + segAngle / 2
          return (
            <div
              key={i}
              className="absolute left-1/2 top-0 origin-[50%_calc(var(--wheel-r))]"
              style={{
                '--wheel-r': '160px',
                transform: `rotate(${angle}deg) translateX(-50%)`,
                width: '24px',
                height: '50%',
                display: 'flex',
                justifyContent: 'center',
                paddingTop: '8px',
              } as React.CSSProperties}
            >
              <span className="text-[9px] sm:text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] select-none"
                style={{ transform: `rotate(0deg)` }}>
                {displayNumber(n)}
              </span>
            </div>
          )
        })}

        {/* Центр колеса */}
        <div className="absolute inset-[28%] rounded-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-black border-4 border-[#3A3A2A] shadow-[0_0_15px_rgba(0,0,0,0.8),inset_0_5px_15px_rgba(255,255,255,0.1)] flex items-center justify-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-gold-light via-gold to-gold-dark font-serif text-xl font-black tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">GAMBA</span>
        </div>
      </motion.div>
    </div>
  )
}

// ==================== BETTING TABLE ====================

const CHIP_VALUES = [10, 25, 50, 100, 500]
const CHIP_COLORS: Record<number, string> = {
  10: 'bg-blue-600 border-blue-400',
  25: 'bg-green-600 border-green-400',
  50: 'bg-red-600 border-red-400',
  100: 'bg-purple-600 border-purple-400',
  500: 'bg-gold border-gold-light text-velvet-dark',
}

function BettingTable({ bets, selectedChip, onPlaceBet, onSelectChip, disabled, winNumber, showResult }: {
  bets: PlacedBet[]
  selectedChip: number
  onPlaceBet: (type: BetType) => void
  onSelectChip: (v: number) => void
  disabled: boolean
  winNumber: number | null
  showResult: boolean
}) {
  // Получаем сумму ставки по ключу
  function getBetAmount(bt: BetType): number {
    const key = betKey(bt)
    return bets.filter(b => betKey(b.type) === key).reduce((sum, b) => sum + b.amount, 0)
  }

  // Ячейка стола для числа
  function NumberCell({ num, className }: { num: number; className?: string }) {
    const color = getColor(num)
    const amount = getBetAmount({ kind: 'straight', number: num })
    const isWin = showResult && winNumber === num

    return (
      <button
        onClick={() => onPlaceBet({ kind: 'straight', number: num })}
        disabled={disabled}
        className={`relative flex items-center justify-center font-bold text-xs sm:text-sm rounded-md border transition-all duration-200 ${
          color === 'red'
            ? 'bg-red-700/80 border-red-500/40 hover:bg-red-600 hover:border-red-400'
            : color === 'black'
              ? 'bg-[#1a1a2e]/90 border-white/10 hover:bg-[#2a2a3e] hover:border-white/30'
              : 'bg-emerald-700/80 border-emerald-500/40 hover:bg-emerald-600'
        } ${isWin ? 'ring-2 ring-gold shadow-[0_0_20px_rgba(212,175,55,0.6)] scale-110 z-10' : ''}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          text-white ${className || 'h-8 sm:h-10'}`}
      >
        {displayNumber(num)}
        {amount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-[7px] font-black text-velvet-dark flex items-center justify-center shadow-lg z-20">
            {amount >= 1000 ? `${(amount/1000).toFixed(0)}K` : amount}
          </div>
        )}
      </button>
    )
  }

  // Внешняя ставка (красное/черное и т.д.)
  function OutsideBet({ label, type, className }: { label: string; type: BetType; className?: string }) {
    const amount = getBetAmount(type)
    const isWin = showResult && winNumber !== null && checkBet(type, winNumber) > 0

    return (
      <button
        onClick={() => onPlaceBet(type)}
        disabled={disabled}
        className={`relative flex items-center justify-center text-[10px] sm:text-xs font-bold rounded-md border transition-all duration-200 
          ${isWin ? 'ring-2 ring-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]' : ''}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95 hover:bg-white/10'}
          bg-white/5 border-white/10 text-white/90 ${className || 'h-8 sm:h-10'}`}
      >
        {label}
        {amount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-[7px] font-black text-velvet-dark flex items-center justify-center shadow-lg z-20">
            {amount >= 1000 ? `${(amount/1000).toFixed(0)}K` : amount}
          </div>
        )}
      </button>
    )
  }

  // Ряды чисел (горизонтальный макет)
  const row1 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
  const row2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]
  const row3 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]

  return (
    <div className="w-full mx-auto">
      {/* Выбор фишки */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mr-2">Фишка:</span>
        {CHIP_VALUES.map(v => (
          <button
            key={v}
            onClick={() => onSelectChip(v)}
            className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 text-xs font-black flex items-center justify-center transition-all ${CHIP_COLORS[v]} ${
              selectedChip === v
                ? 'ring-[3px] ring-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.5)] z-20'
                : 'opacity-70 hover:opacity-100 hover:scale-105 hover:z-10'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Стол */}
      <div className="bg-[#0f1914]/80 backdrop-blur-md border border-emerald-700/30 rounded-xl p-2 sm:p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] w-full overflow-x-auto">
        <div className="min-w-[550px] flex flex-col gap-1">
          
          {/* Верхний блок: Зеро, Числа, Опции 2:1 */}
          <div className="flex gap-1 h-[6.5rem] sm:h-[8rem]">
            {/* 0 и 00 */}
            <div className="flex flex-col gap-1 w-10 sm:w-12 shrink-0">
              <NumberCell num={0} className="flex-1 h-auto" />
              <NumberCell num={37} className="flex-1 h-auto" />
            </div>

            {/* Числа */}
            <div className="flex-1 grid grid-cols-12 grid-rows-3 gap-1">
              {row1.map(n => <NumberCell key={n} num={n} className="h-full" />)}
              {row2.map(n => <NumberCell key={n} num={n} className="h-full" />)}
              {row3.map(n => <NumberCell key={n} num={n} className="h-full" />)}
            </div>

            {/* Колонки 2:1 */}
            <div className="flex flex-col gap-1 w-10 sm:w-12 shrink-0">
              <OutsideBet label="2:1" type={{ kind: 'column', col: 3 }} className="flex-1 h-auto" />
              <OutsideBet label="2:1" type={{ kind: 'column', col: 2 }} className="flex-1 h-auto" />
              <OutsideBet label="2:1" type={{ kind: 'column', col: 1 }} className="flex-1 h-auto" />
            </div>
          </div>

          {/* Нижние блоки */}
          <div className="ml-[calc(2.5rem+4px)] sm:ml-[calc(3rem+4px)] mr-[calc(2.5rem+4px)] sm:mr-[calc(3rem+4px)] flex flex-col gap-1">
            {/* Дюжины */}
            <div className="grid grid-cols-3 gap-1">
              <OutsideBet label="1st 12" type={{ kind: 'dozen', group: 1 }} />
              <OutsideBet label="2nd 12" type={{ kind: 'dozen', group: 2 }} />
              <OutsideBet label="3rd 12" type={{ kind: 'dozen', group: 3 }} />
            </div>

            {/* Внешние ставки */}
            <div className="grid grid-cols-6 gap-1">
              <OutsideBet label="1-18" type={{ kind: 'low' }} />
              <OutsideBet label="EVEN" type={{ kind: 'even' }} />
              <OutsideBet label="🔴" type={{ kind: 'red' }} className="!bg-red-700/60 !border-red-500/30" />
              <OutsideBet label="⚫" type={{ kind: 'black' }} className="!bg-[#1a1a2e] !border-white/10" />
              <OutsideBet label="ODD" type={{ kind: 'odd' }} />
              <OutsideBet label="19-36" type={{ kind: 'high' }} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN GAME ====================

export function RouletteGame({ bet, luck, houseEdge, balance, onResult, takeBet }: Props) {
  const [bets, setBets] = useState<PlacedBet[]>([])
  const [selectedChip, setSelectedChip] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [winNumber, setWinNumber] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const lastBetsRef = useRef<PlacedBet[]>([])

  const totalBet = bets.reduce((s, b) => s + b.amount, 0)

  // Добавить ставку
  const placeBet = useCallback((type: BetType) => {
    if (spinning) return
    if (totalBet + selectedChip > balance) return

    setBets(prev => {
      const key = betKey(type)
      const existing = prev.findIndex(b => betKey(b.type) === key)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], amount: updated[existing].amount + selectedChip }
        return updated
      }
      return [...prev, { type, amount: selectedChip }]
    })
  }, [spinning, totalBet, selectedChip, balance])

  // Очистить ставки
  const clearBets = useCallback(() => {
    if (spinning) return
    setBets([])
  }, [spinning])

  // Повторить последние ставки
  const repeatBets = useCallback(() => {
    if (spinning || lastBetsRef.current.length === 0) return
    const total = lastBetsRef.current.reduce((s, b) => s + b.amount, 0)
    if (total > balance) return
    setBets([...lastBetsRef.current])
  }, [spinning, balance])

  // Определение выигрышного числа
  const getWinningNumber = useCallback((): number => {
    // Базовый рандом: 0-37 (37 = "00")
    const rand = Math.random() * 38
    let num = Math.floor(rand)
    if (num >= 38) num = 37

    // Через applyLuck можем слегка корректировать 
    // (при отрицательной удаче — чаще зеро)
    if (luck < 0) {
      const zeroChance = applyLuck(0.08, luck) // Базовый 5.26% шанс зеро → может вырасти
      if (Math.random() < zeroChance) {
        return Math.random() < 0.5 ? 0 : 37 // 0 или 00
      }
    }

    return num
  }, [luck])

  // Крутить
  const spin = useCallback(async () => {
    if (spinning || bets.length === 0 || totalBet > balance) return

    const success = await takeBet(totalBet)
    if (!success) return

    sounds.bet()
    lastBetsRef.current = [...bets]

    const num = getWinningNumber()
    setWinNumber(num)
    setSpinning(true)
    setShowResult(false)
    setLastWin(null)
  }, [spinning, bets, totalBet, balance, takeBet, getWinningNumber])

  // Обработка окончания вращения
  const handleSpinEnd = useCallback(() => {
    if (winNumber === null) return

    setShowResult(true)
    setSpinning(false)

    // Подсчёт выигрыша
    let totalPayout = 0
    for (const b of bets) {
      const multiplier = checkBet(b.type, winNumber)
      if (multiplier > 0) {
        totalPayout += b.amount + b.amount * multiplier // ставка + выигрыш
      }
    }

    const result: GameResult = totalPayout > 0 ? 'win' : 'lose'

    if (totalPayout > 0) {
      setLastWin(totalPayout)
      sounds.bigWin()
    } else {
      sounds.lose()
    }

    setHistory(prev => [winNumber, ...prev].slice(0, 15))
    onResult(result, totalPayout, { winNumber: displayNumber(winNumber), betsCount: bets.length, totalBet })

    // Через 3с разрешаем новый раунд
    setTimeout(() => {
      setShowResult(false)
      setBets([])
    }, 3000)
  }, [winNumber, bets, totalBet, onResult])

  return (
    <div className="py-4 px-2 sm:px-4 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-14 w-full max-w-[1400px] mx-auto">
      
      {/* Левая колонка: Колесо */}
      <div className="w-full lg:w-auto flex flex-col items-center justify-start xl:sticky xl:top-24 order-1 lg:order-1 shrink-0 z-10">
        <div className="mb-8 lg:mb-0 scale-110 sm:scale-125 lg:scale-150 xl:scale-[1.65] origin-top transition-transform duration-500">
          <RouletteWheel
            spinning={spinning}
            winNumber={winNumber ?? 0}
            onSpinEnd={handleSpinEnd}
          />
        </div>
      </div>

      {/* Правая колонка: Ставки, история и контролы */}
      <div className="flex-1 w-full max-w-3xl flex flex-col order-2 lg:order-2">
        
        {/* Результат */}
        <div className="h-20 flex items-center justify-center mb-4">
          <AnimatePresence mode="wait">
            {showResult && winNumber !== null && (
              <motion.div
                key="result"
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className={`inline-flex items-center gap-4 px-8 py-3 rounded-[2rem] border-2 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all ${
                  getColor(winNumber) === 'red' ? 'bg-red-900/60 border-red-500/50 shadow-red-900/40' :
                  getColor(winNumber) === 'black' ? 'bg-[#1a1a2e]/90 border-white/20 shadow-white/10' :
                  'bg-emerald-900/60 border-emerald-500/50 shadow-emerald-900/40'
                }`}>
                  <span className="text-4xl font-black text-white px-2">{displayNumber(winNumber)}</span>
                  {lastWin && lastWin > 0 && (
                    <span className="text-3xl font-black text-gold border-l border-white/10 pl-4">{lastWin.toLocaleString()}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* История */}
        {history.length > 0 ? (
          <div className="flex gap-2 flex-wrap justify-center mb-8 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-inner">
            {history.map((n, i) => (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: i === 0 ? 1 : 0.7 }}
                key={`${i}-${n}`}
                className={`w-9 h-9 rounded-full text-[11px] font-black flex items-center justify-center shadow-lg ${
                  getColor(n) === 'red' ? 'bg-red-600/90 text-white' :
                  getColor(n) === 'black' ? 'bg-gray-900 text-white border border-gray-700' :
                  'bg-emerald-600/90 text-white'
                } ${i === 0 ? 'ring-2 ring-gold scale-110 z-10' : ''} transition-all duration-300`}
              >
                {displayNumber(n)}
              </motion.span>
            ))}
          </div>
        ) : (
          <div className="h-[60px] mb-8" /> 
        )}

        {/* Стол ставок */}
        <div className="transform-gpu transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] rounded-2xl">
          <BettingTable
            bets={bets}
            selectedChip={selectedChip}
            onPlaceBet={placeBet}
            onSelectChip={setSelectedChip}
            disabled={spinning || showResult}
            winNumber={winNumber}
            showResult={showResult}
          />
        </div>

        {/* Контролы */}
        <div className="mt-8 flex items-center gap-3 w-full">
          <Button
            variant="outline"
            onClick={clearBets}
            disabled={spinning || showResult || bets.length === 0}
            className="flex-1 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] h-8 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300 active:scale-95"
          >
            Очистить
          </Button>

          <Button
            variant="outline"
            onClick={repeatBets}
            disabled={spinning || showResult || lastBetsRef.current.length === 0}
            className="flex-1 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] h-8 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300 active:scale-95"
          >
            Повторить
          </Button>

          <div className="flex-[2] relative group">
            <div className={`absolute -inset-1 bg-gradient-to-r from-gold-light via-gold to-gold-dark blur-md rounded-xl transition-all duration-500 opacity-60 group-hover:opacity-100 ${spinning ? '!opacity-0' : ''}`} />
            <Button
              onClick={spin}
              disabled={spinning || showResult || bets.length === 0 || totalBet > balance}
              className={`relative w-full h-10 sm:h-12 rounded-lg text-sm sm:text-base font-black tracking-widest transition-all duration-300 border border-white/10 overflow-hidden ${
                spinning
                  ? 'bg-gray-800/80 text-white/40 cursor-not-allowed border-transparent'
                  : 'bg-gradient-to-br from-[#FFDF00] via-[#D4AF37] to-[#996515] text-[#1A1A1A] hover:brightness-110 active:scale-[0.98]'
              }`}
            >
              {/* Эффект блика на кнопке при наведении */}
              {!spinning && (
                <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-[1.5s] ease-in-out bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
              )}
              
              {spinning ? (
                <span className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  КРУТИТСЯ
                </span>
              ) : (
                `КРУТИТЬ${totalBet > 0 ? ` (${totalBet.toLocaleString()})` : ''}`
              )}
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}
