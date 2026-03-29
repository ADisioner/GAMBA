import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance, formatDynamicBalance } from '@/lib/utils'
import { doc, updateDoc, addDoc, collection, setDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import { updateLuck } from '@/lib/luck'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import type { GameType, GameResult } from '@/types'
import { SlotsGame } from '@/games/slots/SlotsGame'
import { RouletteGame } from '@/games/roulette/RouletteGame'
import { BlackjackGame } from '@/games/blackjack/BlackjackGame'
import { CrashGame } from '@/games/crash/CrashGame'
import { MinesGame } from '@/games/mines/MinesGame'
import { PokerGame } from '@/games/poker/PokerGame'

const GAME_TITLES: Record<GameType, string> = {
  slots: 'Golden Slots',
  roulette: 'Рулетка',
  blackjack: 'Блэкджек',
  crash: 'Crash',
  mines: 'Mines',
  poker: 'Poker',
}

export function GamePage() {
  const { type } = useParams<{ type: string }>()
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('room')
  const navigate = useNavigate()
  const { profile, settings, refreshProfile, addLiveEvent } = useAuth()
  const [bet, setBet] = useState(100)

  const gameType = type as GameType
  const { room, loading: roomLoading, averageLuck, joinRoom, leaveRoom, placeBet, updatePlayerStatus } = useMultiplayerRoom(gameType, roomId)

  if (!profile || !['slots', 'roulette', 'blackjack', 'crash', 'mines', 'poker'].includes(gameType)) {
    return <div className="min-h-screen flex items-center justify-center"><p>Игра не найдена</p></div>
  }

  const isEnabled = settings?.gamesConfig?.[gameType]?.enabled !== false
  if (!isEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 mb-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Minus className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Игра временно недоступна</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          Администрация временно ограничила доступ к игре <span className="text-gold font-bold">{GAME_TITLES[gameType]}</span> для проведения технических работ или обновлений.
        </p>
        <Button onClick={() => navigate('/lobby')} className="bg-gold text-primary-foreground hover:bg-gold-light px-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться в лобби
        </Button>
      </div>
    )
  }

  const configMinBet = settings?.gamesConfig?.[gameType]?.minBet || 10
  const effectiveMinBet = room ? (room.minBet || configMinBet) : configMinBet

  useEffect(() => {
    if (room && room.minBet) {
      setBet(room.minBet)
    }
  }, [room?.id])

  const takeBet = useCallback(async (amount: number) => {
    if (!profile || profile.balance < amount) {
      toast.error('Недостаточно средств')
      return false
    }
    
    try {
      await updateDoc(doc(db, 'users', profile.nickname), {
        balance: increment(-amount),
        updatedAt: Date.now()
      })
      return true
    } catch (e) {
      console.error('Take bet error:', e)
      toast.error('Ошибка при списании ставки')
      return false
    }
  }, [profile])

  const recordGameResult = useCallback(async (result: GameResult, payout: number, details: Record<string, unknown>) => {
    if (!profile) return

    // ВАЖНО: ставка уже списана через takeBet(), поэтому тут только начисляем выгоду
    const balanceChange = result === 'win' ? payout : result === 'push' ? bet : 0
    
    addLiveEvent({
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      game: GAME_TITLES[gameType],
      bet,
      payout: result === 'win' ? payout : (result === 'push' ? 0 : -bet),
      result
    })

    await updateDoc(doc(db, 'users', profile.nickname), {
      balance: increment(balanceChange),
      totalGamesPlayed: increment(1),
      totalWon: result === 'win' ? increment(payout) : increment(0),
      totalLost: result === 'lose' ? increment(bet) : increment(0),
      updatedAt: Date.now(),
    })

    await addDoc(collection(db, 'games'), {
      userId: profile.nickname,
      gameType,
      bet,
      result,
      payout: result === 'win' ? payout : 0,
      details,
      createdAt: Date.now(),
    })

    await setDoc(doc(db, 'settings', 'global_stats'), {
      totalBets: increment(bet),
      totalPayouts: increment(result === 'win' ? payout : 0),
      totalGames: increment(1),
      updatedAt: Date.now(),
    }, { merge: true })

  }, [profile, bet, gameType, addLiveEvent])

  function adjustBet(delta: number) {
    setBet(prev => Math.max(effectiveMinBet, Math.min(profile?.balance || 0, prev + delta)))
  }

  const gameProps = {
    bet, 
    luck: room ? averageLuck : profile.luck, 
    houseEdge: settings?.houseEdge || 0.03,
    balance: profile.balance,
    onResult: recordGameResult,
    takeBet,
    multiplayer: roomId ? {
      room,
      joinRoom,
      leaveRoom,
      placeBet: async (amount: number) => {
        const success = await takeBet(amount)
        if (success) {
          await placeBet(amount)
          toast.success(`Ставка ${amount} принята`)
        }
      },
      updatePlayerStatus
    } : undefined
  }

  if (roomId && roomLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gold">Загрузка игрового стола...</div>
  }

  if (roomId && !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-bold text-destructive">Стол #{roomId.slice(-4)} не найден или был закрыт</p>
        <Button onClick={() => navigate('/lobby')}>Вернуться в лобби</Button>
      </div>
    )
  }

  const handleBack = () => {
    if (roomId) leaveRoom()
    navigate('/lobby')
  }

  const isRoulette = gameType === 'roulette'

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 shrink-0">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="bg-marble/80 backdrop-blur-xl border-b border-gold/20 h-16">
          <div className="max-w-screen 2xl:max-w-[2000px] mx-auto px-6 h-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="flex items-center gap-2 text-gold hover:text-gold-light transition-colors font-medium text-sm">
                <ArrowLeft className="w-4 h-4" /> Лобби
              </button>
            </div>
            
            <h1 className="font-serif text-lg font-bold text-foreground tracking-tight">{GAME_TITLES[gameType]}</h1>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-marble-light/50 border border-gold/30">
                <Coins className="w-3.5 h-3.5 text-gold" />
                <span className="text-sm font-semibold text-gold-light">{formatDynamicBalance(profile.balance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${isRoulette ? 'max-w-full' : 'max-w-6xl'} mx-auto px-4 py-4 md:py-6`}>
        {/* Компактное управление ставками */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 mb-6">
          
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" className="h-10 w-10 border-gold/10" onClick={() => adjustBet(-100)} disabled={bet <= effectiveMinBet}>
              <Minus className="w-4 h-4" />
            </Button>
            
            <div className="flex flex-col items-center justify-center px-6 py-2 rounded-2xl bg-black/40 border-[1.5px] border-gold/40 min-w-[180px] shadow-[0_0_20px_rgba(212,175,55,0.15)] group relative overflow-hidden transition-all hover:border-gold/60">
               <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
               <span className="text-[9px] text-gold/50 font-black uppercase tracking-[0.25em] mb-0.5">Bet Amount</span>
               <div className="flex items-center gap-2.5">
                 <Coins className="w-5 h-5 text-gold" />
                 <span className="text-xl 2xl:text-2xl font-black text-gold-light tracking-widest">{formatBalance(bet)}</span>
               </div>
               <button onClick={() => setBet(effectiveMinBet)} className="mt-0.5 text-[8px] text-white/30 hover:text-white/60 uppercase tracking-widest underline decoration-dotted underline-offset-4">Reset</button>
            </div>
            
            <Button variant="outline" size="icon" className="h-10 w-10 border-gold/10" onClick={() => adjustBet(100)} disabled={bet >= (profile?.balance || 0)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[10, 50, 100, 500, 1000].map(v => (
              <Button key={v} variant="outline" size="sm" onClick={() => setBet(v)}
                className="text-xs h-8 px-3.5 border-gold/10 bg-black/10 hover:border-gold/40 hover:bg-gold/10 transition-all text-gold/80 active:scale-95">
                {v >= 1000 ? `${v/1000}K` : v}
              </Button>
            ))}
            
            <div className="w-[1px] h-6 bg-gold/10 mx-2 self-center" />
            
            <Button variant="outline" size="sm" onClick={() => setBet(prev => Math.min(profile?.balance || 0, prev * 2))} className="h-8 px-4 border-gold/20 text-gold/80 hover:text-gold hover:bg-gold/10 font-bold text-xs uppercase active:scale-95">X2</Button>
            <Button variant="outline" size="sm" onClick={() => setBet(prev => Math.max(effectiveMinBet, Math.floor(prev / 2)))} className="h-8 px-4 border-gold/20 text-gold/80 hover:text-gold hover:bg-gold/10 font-bold text-xs uppercase active:scale-95">1/2</Button>
            <Button variant="outline" size="sm" onClick={() => setBet(profile?.balance || 0)} className="h-8 px-5 border-emerald-500/30 text-emerald-500/90 hover:bg-emerald-500/10 font-bold text-[10px] uppercase tracking-wider active:scale-95">All-in</Button>
          </div>
        </motion.div>

        <div className={`rounded-3xl ${isRoulette ? 'bg-transparent border-none' : 'border border-gold/20 bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50'}`}>
          {gameType === 'slots' && <SlotsGame {...gameProps} />}
          {gameType === 'roulette' && <RouletteGame {...gameProps} />}
          {gameType === 'blackjack' && <BlackjackGame {...gameProps} />}
          {gameType === 'crash' && <CrashGame {...gameProps} />}
          {gameType === 'mines' && <MinesGame {...gameProps} />}
          {gameType === 'poker' && <PokerGame {...gameProps} />}
        </div>
      </div>
    </div>
  )
}
