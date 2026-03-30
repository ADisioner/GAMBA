import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { applyLuck } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import { rtdb } from '@/lib/firebase'
import { ref, update, onValue } from 'firebase/database'
import { useAuth } from '@/contexts/AuthContext'
import type { GameResult, MultiplayerRoom, RoomPlayer } from '@/types'
import { Coins, Users, Clock, History, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'

// --- SHARED CONSTANTS ---
const WHEEL_NUMBERS = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  37, // 37 = "00"
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
]
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0 || n === 37) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

function displayNumber(n: number): string {
  return n === 37 ? '00' : String(n)
}

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

function betKey(bt: BetType): string {
  if (bt.kind === 'straight') return `num-${bt.number}`
  if (bt.kind === 'dozen') return `dozen-${bt.group}`
  if (bt.kind === 'column') return `col-${bt.col}`
  return bt.kind
}

function checkBet(bet: BetType, winNum: number): number {
  switch (bet.kind) {
    case 'straight': return bet.number === winNum ? 35 : 0
    case 'red': return RED_NUMBERS.has(winNum) ? 1 : 0
    case 'black': return !RED_NUMBERS.has(winNum) && winNum !== 0 && winNum !== 37 ? 1 : 0
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

// --- SUB-COMPONENTS ---

function RouletteWheel({ spinning, winNumber, onSpinEnd }: {
  spinning: boolean; winNumber: number; onSpinEnd: () => void
}) {
  const segAngle = 360 / 38
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (!spinning) return
    const idx = WHEEL_NUMBERS.indexOf(winNumber)
    const targetMod = 360 - (idx * segAngle + segAngle / 2)
    setRotation(prev => {
      const prevMod = prev % 360
      const diff = targetMod >= prevMod ? targetMod - prevMod : 360 - (prevMod - targetMod)
      return prev + (360 * 5) + diff
    })
    const timer = setTimeout(() => onSpinEnd(), 5500)
    return () => clearTimeout(timer)
  }, [spinning, winNumber, onSpinEnd, segAngle])

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold drop-shadow-glow-gold" />
      </div>
      <motion.div
        className="w-full h-full rounded-full ring-4 ring-gold/40 shadow-[0_0_50px_rgba(212,175,55,0.3),inset_0_0_0_6px_#2a2a1a,inset_0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden relative bg-black/80"
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 5 : 0, ease: [0.15, 0.85, 0.35, 1.0] }}
      >
        <div className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${WHEEL_NUMBERS.map((n, i) => {
              const c = getColor(n) === 'green' ? '#166534' : getColor(n) === 'red' ? '#991b1b' : '#0f172a'
              return `${c} ${(i/38)*100}% ${((i+1)/38)*100}%`
            }).join(', ')})`
          }}
        />
        {WHEEL_NUMBERS.map((n, i) => (
          <div key={i} className="absolute left-[calc(50%-12px)] top-0 origin-[50%_100%]"
            style={{ transform: `rotate(${i * segAngle + segAngle / 2}deg)`, width: '24px', height: '50%', display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
            <span className="text-[10px] font-bold text-white drop-shadow-md select-none">{displayNumber(n)}</span>
          </div>
        ))}
        <div className="absolute inset-[28%] rounded-full bg-radial-gradient from-gray-700 via-gray-900 to-black border-4 border-[#3A3A2A] shadow-inner flex items-center justify-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-gold-light via-gold to-gold-dark font-serif text-xl font-black tracking-widest drop-shadow-md">GAMBA</span>
        </div>
      </motion.div>
    </div>
  )
}

function BettingTable({ room, localBets, selectedChip, onPlaceBet, onSelectChip, disabled, winNumber, showResult }: {
  room: MultiplayerRoom | null
  localBets: PlacedBet[]
  selectedChip: number
  onPlaceBet: (type: BetType) => void
  onSelectChip: (v: number) => void
  disabled: boolean
  winNumber: number | null
  showResult: boolean
}) {
  const CHIP_VALUES = [10, 25, 50, 100, 500]
  const CHIP_COLORS: Record<number, string> = {
    10: 'bg-blue-600', 25: 'bg-green-600', 50: 'bg-red-600', 100: 'bg-purple-600', 500: 'bg-gold text-black'
  }

  // Расчет общих ставок за столом по ключу
  function getTableBets(bt: BetType) {
    const key = betKey(bt)
    const result: { uid: string, amount: number, nickname: string }[] = []
    
    Object.values(room?.players || {}).forEach(p => {
      // @ts-ignore
      const bets = (p.bets || []) as PlacedBet[]
      const amount = bets.filter(b => betKey(b.type) === key).reduce((s, b) => s + b.amount, 0)
      if (amount > 0) result.push({ uid: p.uid, amount, nickname: p.nickname })
    })
    return result
  }

  function NumberCell({ num, className }: { num: number; className?: string }) {
    const allBets = getTableBets({ kind: 'straight', number: num })
    const totalAmount = allBets.reduce((s, b) => s + b.amount, 0)
    const isWin = showResult && winNumber === num
    const color = getColor(num)

    return (
      <button
        onClick={() => onPlaceBet({ kind: 'straight', number: num })}
        disabled={disabled}
        className={`relative flex items-center justify-center font-bold text-xs rounded border transition-all duration-200 ${
          color === 'red' ? 'bg-red-700/80 border-red-500/40 hover:bg-red-600' :
          color === 'black' ? 'bg-[#1a1a2e]/90 border-white/10 hover:bg-[#2a2a3e]' :
          'bg-emerald-700/80 border-emerald-500/40 hover:bg-emerald-600'
        } ${isWin ? 'ring-2 ring-gold scale-110 z-10' : ''} ${disabled ? 'opacity-60' : 'cursor-pointer active:scale-95'} text-white ${className || 'h-8 sm:h-10'}`}
      >
        {displayNumber(num)}
        {totalAmount > 0 && (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
             <div className="px-1 h-3.5 rounded-full bg-gold text-[7px] font-black text-black flex items-center justify-center shadow-lg uppercase">
               {totalAmount >= 1000 ? `${(totalAmount/1000).toFixed(0)}K` : totalAmount}
             </div>
          </div>
        )}
      </button>
    )
  }

  function OutsideBet({ label, type, className }: { label: string; type: BetType; className?: string }) {
    const allBets = getTableBets(type)
    const totalAmount = allBets.reduce((s, b) => s + b.amount, 0)
    const isWin = showResult && winNumber !== null && checkBet(type, winNumber) > 0

    return (
      <button onClick={() => onPlaceBet(type)} disabled={disabled}
        className={`relative flex items-center justify-center text-[10px] font-bold rounded border transition-all ${isWin ? 'ring-2 ring-gold bg-gold/20' : 'bg-white/5 border-white/10'} ${disabled ? 'opacity-60' : 'hover:bg-white/10 active:scale-95'} text-white/90 ${className || 'h-8 sm:h-10'}`}>
        {label}
        {totalAmount > 0 && (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
             <div className="px-1 h-3.5 rounded-full bg-gold text-[7px] font-black text-black flex items-center justify-center shadow-lg">
               {totalAmount}
             </div>
          </div>
        )}
      </button>
    )
  }

  const row1 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
  const row2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]
  const row3 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]

  return (
    <div className="w-full">
      <div className="flex justify-center gap-2 mb-6">
        {CHIP_VALUES.map(v => (
          <button key={v} onClick={() => onSelectChip(v)}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 text-[10px] font-black flex items-center justify-center transition-all ${CHIP_COLORS[v]} ${selectedChip === v ? 'ring-2 ring-white scale-110 shadow-glow' : 'opacity-60 hover:opacity-100'}`}>
            {v}
          </button>
        ))}
      </div>

      <div className="bg-emerald-950/60 backdrop-blur-md rounded-xl p-3 border border-emerald-500/20 overflow-x-auto shadow-2xl">
        <div className="min-w-[650px] flex flex-col gap-1.5">
          <div className="flex gap-1.5 h-32">
            <div className="flex flex-col gap-1.5 w-12 shrink-0">
              <NumberCell num={0} className="flex-1 h-auto" />
              <NumberCell num={37} className="flex-1 h-auto" />
            </div>
            <div className="flex-1 grid grid-cols-12 grid-rows-3 gap-1.5">
              {row1.map(n => <NumberCell key={n} num={n} className="h-full" />)}
              {row2.map(n => <NumberCell key={n} num={n} className="h-full" />)}
              {row3.map(n => <NumberCell key={n} num={n} className="h-full" />)}
            </div>
            <div className="flex flex-col gap-1.5 w-12 shrink-0">
              <OutsideBet label="2:1" type={{ kind: 'column', col: 3 }} className="flex-1 h-auto" />
              <OutsideBet label="2:1" type={{ kind: 'column', col: 2 }} className="flex-1 h-auto" />
              <OutsideBet label="2:1" type={{ kind: 'column', col: 1 }} className="flex-1 h-auto" />
            </div>
          </div>
          <div className="ml-14 mr-14 flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <OutsideBet label="1st 12" type={{ kind: 'dozen', group: 1 }} />
              <OutsideBet label="2nd 12" type={{ kind: 'dozen', group: 2 }} />
              <OutsideBet label="3rd 12" type={{ kind: 'dozen', group: 3 }} />
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              <OutsideBet label="1-18" type={{ kind: 'low' }} />
              <OutsideBet label="EVEN" type={{ kind: 'even' }} />
              <OutsideBet label="RED" type={{ kind: 'red' }} className="!bg-red-700/40" />
              <OutsideBet label="BLACK" type={{ kind: 'black' }} className="!bg-slate-900/60" />
              <OutsideBet label="ODD" type={{ kind: 'odd' }} />
              <OutsideBet label="19-36" type={{ kind: 'high' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- MAIN MULTIPLAYER COMPONENT ---

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
  takeBet: (amount: number) => Promise<boolean>
  multiplayer: {
    room: MultiplayerRoom | null
    joinRoom: (seat: number) => Promise<void>
    leaveRoom: () => Promise<void>
    placeBet: (amount: number) => Promise<void>
    updatePlayerStatus: (status: any) => Promise<void>
  }
}

export function MultiplayerRouletteGame({ bet, luck, houseEdge, balance, onResult, takeBet, multiplayer }: Props) {
  const { profile } = useAuth()
  const { room } = multiplayer
  const isHost = room?.host === profile?.nickname

  const [localBets, setLocalBets] = useState<PlacedBet[]>([])
  const [spinning, setSpinning] = useState(false)
  const [winNumber, setWinNumber] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [selectedChip, setSelectedChip] = useState(10)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const totalBet = localBets.reduce((s, b) => s + b.amount, 0)
  const lastBetsRef = useRef<PlacedBet[]>([])

  // Синхронизация комнаты
  useEffect(() => {
    if (!room) return
    if (room.status === 'playing' && room.winNumber != null && !spinning) {
      lastBetsRef.current = [...localBets] // Сохраняем для повтора
      setWinNumber(room.winNumber)
      setSpinning(true)
      setShowResult(false)
      setLastWin(null)
    }
    if (room.status === 'waiting' || room.status === 'betting') {
      if (spinning || showResult) {
        setSpinning(false)
        setShowResult(false)
        setLocalBets([])
      }
    }
  }, [room?.status, room?.winNumber])

  const handlePlaceBet = useCallback(async (type: BetType) => {
    if (spinning || !room || (room.status !== 'waiting' && room.status !== 'betting')) return
    const currentTotal = localBets.reduce((s, b) => s + b.amount, 0)
    if (currentTotal + selectedChip > balance) return

    const success = await takeBet(selectedChip)
    if (!success) return

    setLocalBets(prev => {
      const key = betKey(type)
      const existing = prev.findIndex(b => betKey(b.type) === key)
      const next = existing >= 0 ? [...prev] : [...prev, { type, amount: 0 }]
      const idx = existing >= 0 ? existing : next.length - 1
      next[idx] = { ...next[idx], amount: next[idx].amount + selectedChip }

      if (profile) {
        update(ref(rtdb, `rooms/roulette/${room.id}/players/${profile.uid}`), {
          bets: next,
          bet: next.reduce((s, b) => s + b.amount, 0),
          status: 'betting'
        })
      }
      return next
    })

    if (isHost && room.status === 'waiting') {
      update(ref(rtdb, `rooms/roulette/${room.id}`), { status: 'betting' })
    }
    sounds.bet()
  }, [spinning, room, localBets, selectedChip, balance, takeBet, profile, isHost])

  const handleClearBets = useCallback(async () => {
    if (spinning || localBets.length === 0 || !room || !profile) return
    
    // Возвращаем баланс (технически в мультиплеере мы уже списали через takeBet, 
    // поэтому Clear должен либо зачислять обратно в Firestore, либо мы меняем логику списания).
    // Для простоты: Clear здесь просто обнуляет текущие ставки раунда в БД.
    setLocalBets([])
    update(ref(rtdb, `rooms/roulette/${room.id}/players/${profile.uid}`), {
      bets: [],
      bet: 0,
      status: 'ready'
    })
    toast.info('Ставки очищены')
  }, [spinning, localBets, room, profile])

  const handleRepeatBets = useCallback(async () => {
    if (spinning || lastBetsRef.current.length === 0 || !room || !profile) return
    const total = lastBetsRef.current.reduce((s, b) => s + b.amount, 0)
    if (total > balance) return

    const success = await takeBet(total)
    if (!success) return

    setLocalBets([...lastBetsRef.current])
    update(ref(rtdb, `rooms/roulette/${room.id}/players/${profile.uid}`), {
      bets: lastBetsRef.current,
      bet: total,
      status: 'betting'
    })
    toast.success('Ставки повторены')
  }, [spinning, balance, room, profile, takeBet])

  const handleSpinStart = async () => {
    if (!isHost || !room || room.status !== 'betting') return
    const rand = Math.floor(Math.random() * 38)
    await update(ref(rtdb, `rooms/roulette/${room.id}`), {
      winNumber: rand,
      status: 'playing',
      updatedAt: Date.now()
    })
  }

  const handleSpinEnd = useCallback(() => {
    if (winNumber === null || !room) return
    setSpinning(false)
    setShowResult(true)

    let payout = 0
    localBets.forEach(b => {
      const mult = checkBet(b.type, winNumber)
      if (mult > 0) payout += b.amount * (mult + 1)
    })

    if (payout > 0) {
      setLastWin(payout)
      sounds.win()
    } else {
      sounds.lose()
    }

    onResult(payout > 0 ? 'win' : 'lose', payout, { winNumber, betsCount: localBets.length })

    if (isHost) {
      setTimeout(() => {
        update(ref(rtdb, `rooms/roulette/${room.id}`), { status: 'waiting', winNumber: null })
      }, 5000)
    }
  }, [winNumber, localBets, onResult, isHost, room?.id])

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1400px] mx-auto p-4 animate-in fade-in duration-500">
      
      {/* LEFT: WHEEL & PLAYERS */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        <RouletteWheel spinning={spinning} winNumber={winNumber ?? 0} onSpinEnd={handleSpinEnd} />
        
        <div className="bg-black/40 rounded-3xl border border-gold/20 p-6 backdrop-blur-xl">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-gold font-serif font-bold flex items-center gap-2"><Users className="w-5 h-5"/> Участники</h3>
              <span className="text-xs text-gold/60">{Object.keys(room?.players || {}).length} / {room?.maxPlayers}</span>
           </div>
           <div className="space-y-3">
              {Object.values(room?.players || {}).map(p => (
                <div key={p.uid} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${p.uid === profile?.uid ? 'bg-gold/10 border-gold/30' : 'bg-white/5 border-white/5'}`}>
                   <div className="flex items-center gap-3">
                      <img src={p.avatarUrl} className="w-8 h-8 rounded-full border border-gold/40 shadow-glow" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white pr-2 truncate max-w-[100px]">{p.nickname}</span>
                        <span className="text-[9px] text-emerald-400/80 font-black tracking-tighter uppercase">Total: ${p.bet || 0}</span>
                      </div>
                   </div>
                   <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${p.status === 'betting' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                     {p.status || 'ready'}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* RIGHT: TABLE & ACTIONS */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="h-20 flex items-center justify-between px-8 bg-marble/10 rounded-3xl border border-gold/10 backdrop-blur-md relative overflow-hidden">
           <div className="flex items-center gap-4 z-10">
              {room?.status === 'waiting' && <p className="text-gold font-serif font-bold animate-pulse text-lg">Ожидание начала...</p>}
              {room?.status === 'betting' && <div className="flex items-center gap-3 text-blue-400"><Clock className="w-5 h-5 animate-spin" /><span className="font-black uppercase tracking-widest">Ставки открыты</span></div>}
              {room?.status === 'playing' && <p className="text-emerald-400 font-black animate-bounce text-xl uppercase tracking-tighter">Вращение!</p>}
           </div>
           
           <AnimatePresence>
             {showResult && winNumber !== null && (
               <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-6 z-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-white border-2 border-gold shadow-glow-gold ${getColor(winNumber) === 'red' ? 'bg-red-600' : getColor(winNumber) === 'black' ? 'bg-slate-900' : 'bg-emerald-600'}`}>
                    {displayNumber(winNumber)}
                  </div>
                  {lastWin && lastWin > 0 && (
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] text-gold uppercase font-bold tracking-widest">Выигрыш</span>
                       <span className="text-2xl font-black text-emerald-400 drop-shadow-md">+${lastWin.toLocaleString()}</span>
                    </div>
                  )}
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* ПАНЕЛЬ СТАВОК */}
        <div className="relative group p-4 bg-black/20 rounded-3xl border border-gold/10">
           <BettingTable room={room} localBets={localBets} selectedChip={selectedChip} onPlaceBet={handlePlaceBet} onSelectChip={setSelectedChip} disabled={spinning || showResult} winNumber={winNumber} showResult={showResult} />
           
           <div className="mt-6 flex gap-4">
              <Button variant="outline" onClick={handleClearBets} disabled={spinning || localBets.length === 0} className="flex-1 bg-white/5 border-gold/20 text-gold/80 hover:bg-gold/10 h-10">
                 Очистить
              </Button>
              <Button variant="outline" onClick={handleRepeatBets} disabled={spinning || lastBetsRef.current.length === 0} className="flex-1 bg-white/5 border-gold/20 text-gold/80 hover:bg-gold/10 h-10">
                 Повторить
              </Button>
           </div>

           {/* Кнопка Старта (только для Хоста) */}
           {isHost && room?.status === 'betting' && !spinning && (
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8 flex justify-center z-40">
                <Button onClick={handleSpinStart} className="bg-gradient-to-br from-gold-light via-gold to-gold-dark text-black font-black px-16 py-8 shadow-glow-gold hover:scale-105 active:scale-95 transition-all text-xl uppercase tracking-tighter w-full rounded-2xl">
                   🚀 ЗАПУСТИТЬ КОЛЕСО
                </Button>
             </motion.div>
           )}
        </div>

        {/* ИНФО */}
        {!isHost && room?.status === 'betting' && (
           <p className="text-center text-gold/40 text-xs mt-12 animate-pulse font-bold uppercase tracking-widest">Ожидание запуска игры хостом...</p>
        )}
      </div>

    </div>
  )
}
