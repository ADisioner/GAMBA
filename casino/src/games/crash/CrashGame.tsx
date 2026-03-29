import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { generateCrashMultiplier } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import { useAuth } from '@/contexts/AuthContext'
import { rtdb } from '@/lib/firebase'
import { ref, update } from 'firebase/database'
import type { GameResult, MultiplayerRoom, PlayerStatus } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
  multiplayer?: {
    room: MultiplayerRoom | null
    joinRoom: (seat: number) => Promise<void>
    leaveRoom: () => Promise<void>
    placeBet: (bet: number) => Promise<void>
    updatePlayerStatus: (status: PlayerStatus) => Promise<void>
  }
}

export function CrashGame({ bet, luck, houseEdge, balance, onResult, multiplayer }: Props) {
  const { profile } = useAuth()
  const isMulti = !!multiplayer?.room
  const room = multiplayer?.room
  const isHost = room?.host === profile?.nickname

  const [state, setState] = useState<'idle' | 'running' | 'crashed' | 'cashed'>('idle')
  const [multiplier, setMultiplier] = useState(1.00)
  const [crashPoint, setCrashPoint] = useState(0)
  const [cashedAt, setCashedAt] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const animRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = 0
    }
  }, [])

  const animate = useCallback((cp: number, startTime: number) => {
    const elapsed = (Date.now() - startTime) / 1000
    const current = Math.pow(Math.E, elapsed * 0.15)
    
    setMultiplier(parseFloat(current.toFixed(2)))

    if (Date.now() - lastTickRef.current > 300) {
      sounds.crashTick(current)
      lastTickRef.current = Date.now()
    }

    if (current >= cp) {
      setMultiplier(parseFloat(cp.toFixed(2)))
      setState('crashed')
      sounds.crashExplode()
      setHistory(prev => [parseFloat(cp.toFixed(2)), ...prev].slice(0, 10))
      
      // Сами записываем проигрыш, если не успели забрать
      if (state !== 'cashed') {
        onResult('lose', 0, { crashPoint: cp, cashedAt: 0 })
      }

      if (isMulti && isHost) {
        update(ref(rtdb, `rooms/crash/${room?.id}`), {
          status: 'waiting',
          crashPoint: null,
          startTime: null
        })
      }
      return
    }
    animRef.current = requestAnimationFrame(() => animate(cp, startTime))
  }, [state, onResult, isMulti, isHost, room?.id])

  const start = useCallback(async () => {
    if (bet > balance || state === 'running') return
    
    if (isMulti) {
      if (!isHost) return
      const cp = generateCrashMultiplier(luck, houseEdge)
      const updates: any = {
        status: 'playing',
        crashPoint: cp,
        startTime: Date.now(),
        updatedAt: Date.now()
      }
      // Сбрасываем статус всех игроков на 'acting' (в игре)
      Object.keys(room?.players || {}).forEach(uid => {
        updates[`players/${uid}/status`] = 'acting'
      })
      await update(ref(rtdb, `rooms/crash/${room?.id}`), updates)
      return
    }

    // Single Player
    sounds.bet()
    const cp = generateCrashMultiplier(luck, houseEdge)
    setCrashPoint(cp)
    setMultiplier(1.00)
    setCashedAt(0)
    setState('running')
    startRef.current = Date.now()
    lastTickRef.current = 0
    animate(cp, startRef.current)
  }, [bet, balance, luck, houseEdge, state, isMulti, isHost, room?.id, animate])

  const cashOut = useCallback(() => {
    if (state !== 'running') return
    stopAnimation()
    sounds.cashOut()
    setCashedAt(multiplier)
    setState('cashed')
    const payout = Math.floor(bet * multiplier)
    // В мультиплеере мы не знаем crashPoint пока он не случится, 
    // поэтому в историю добавим только после краша или используем текущий если сингл
    if (isMulti) {
      multiplayer.updatePlayerStatus('stay')
    }
    onResult('win', payout, { crashPoint: isMulti ? 0 : crashPoint, cashedAt: multiplier })
  }, [state, multiplier, bet, crashPoint, onResult, stopAnimation, isMulti])

  // Синхронизация для мультиплеера
  useEffect(() => {
    if (isMulti && room?.status === 'playing' && room?.startTime && room?.crashPoint && state !== 'running' && state !== 'crashed' && state !== 'cashed') {
      setState('running')
      setMultiplier(1.00)
      setCashedAt(0)
      lastTickRef.current = 0
      animate(room.crashPoint, room.startTime)
    } else if (isMulti && room?.status === 'waiting' && (state === 'crashed' || state === 'cashed')) {
      // Готовимся к следующему раунду через некоторое время
      setTimeout(() => {
         if (room?.status === 'waiting') setState('idle')
      }, 3000)
    }
  }, [isMulti, room?.status, room?.startTime, room?.crashPoint, animate, state])

  // Раннее завершение, если все вышли (только для хоста)
  useEffect(() => {
    if (isMulti && isHost && room?.status === 'playing') {
      const players = Object.values(room.players || {})
      const activePlayers = players.filter(p => !p.status || p.status === 'acting')
      
      if (activePlayers.length === 0 && players.length > 0) {
        update(ref(rtdb, `rooms/crash/${room.id}`), {
          status: 'waiting',
          crashPoint: multiplier, // Форсируем краш на текущем значении
          startTime: null
        })
      }
    }
  }, [isMulti, isHost, room?.players, room?.status, room?.id, multiplier])

  useEffect(() => {
    return () => stopAnimation()
  }, [stopAnimation])

  const getColor = () => {
    if (state === 'crashed') return 'text-neon-red'
    if (state === 'cashed') return 'text-neon-green'
    if (multiplier > 5) return 'text-neon-purple'
    if (multiplier > 2) return 'text-gold'
    return 'text-foreground'
  }

  return (
    <div className="p-8 flex flex-col items-center">
      {/* Table Title if Multiplayer */}
      {isMulti && (
        <div className="mb-6 text-center">
           <h2 className="text-2xl font-serif text-gold flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             CRASH МУЛЬТИПЛЕЕР: СТОЛ #{room?.id?.slice(-4)}
           </h2>
           <p className="text-gold/60 text-xs mt-1 uppercase tracking-widest">
             Средняя удача стола: <span className="text-gold font-bold">{(luck * 100).toFixed(1)}%</span>
           </p>
        </div>
      )}

      {/* Graph area */}
      <div className="w-full max-w-2xl h-80 sm:h-96 rounded-xl bg-marble/40 border border-gold/20 flex items-center justify-center mb-6 relative overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-gold/30" style={{ top: `${(i + 1) * 20}%` }} />
          ))}
        </div>

        {state === 'idle' ? (
          <div className="text-center flex flex-col items-center gap-4">
             <div className="w-16 h-16 rounded-full border-4 border-gold/20 border-t-gold animate-spin mb-4" />
             <p className="text-gold/60 text-lg font-serif">Ожидание старта раунда...</p>
          </div>
        ) : (
          <motion.div animate={state === 'crashed' ? { scale: [1, 1.2, 0.9] } : {}} className="text-center">
            <p className={`text-7xl sm:text-9xl font-bold ${getColor()} transition-colors drop-shadow-[0_0_30px_rgba(212,175,55,0.3)]`}>
              {multiplier.toFixed(2)}×
            </p>
            {state === 'crashed' && <p className="text-red-500 text-2xl mt-4 font-black uppercase tracking-tighter animate-bounce">💥 БУМ! 💥</p>}
            {state === 'cashed' && (
              <p className="text-emerald-400 text-2xl mt-4 font-black uppercase tracking-tighter">
                ✅ +${Math.floor(bet * cashedAt).toLocaleString()}
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md mb-8">
        {isMulti && !room?.players?.[profile?.uid ?? ''] ? (
          <Button onClick={() => multiplayer.joinRoom(0)} className="w-full bg-gold hover:bg-gold-light text-velvet-dark font-bold py-8 text-xl">
             <Plus className="mr-2 h-6 w-6" /> ПРИСОЕДИНИТЬСЯ К ИГРЕ
          </Button>
        ) : (
          <div className="w-full">
            {state === 'idle' || state === 'crashed' || state === 'cashed' ? (
              <>
                 {isMulti ? (
                   isHost ? (
                     <Button onClick={start} size="xl" className="w-full bg-emerald-600 hover:bg-emerald-500 font-serif py-10 text-2xl shadow-lg">
                       🚀 НАЧАТЬ РАУНД
                     </Button>
                   ) : (
                     <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/40 italic">
                        Ожидание запуска следующего раунда хостом...
                     </div>
                   )
                 ) : (
                   <Button onClick={start} size="xl" disabled={bet > balance} className="w-full font-serif py-10 text-2xl">
                     🚀 СТАРТ
                   </Button>
                 )}
              </>
            ) : (
              <Button onClick={cashOut} disabled={state !== 'running'} size="xl" className="w-full bg-gold hover:bg-gold-light text-velvet-dark py-10 text-3xl font-black shadow-[0_0_30px_rgba(212,175,55,0.4)] animate-pulse">
                💰 ЗАБРАТЬ: ${(bet * multiplier).toFixed(0)}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center bg-black/40 p-3 rounded-full border border-gold/10">
          {history.map((h, i) => (
            <span key={i} className={`px-4 py-1 rounded-full text-xs font-black ${h < 2 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
