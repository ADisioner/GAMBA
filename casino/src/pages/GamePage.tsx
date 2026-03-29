import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance, formatDynamicBalance } from '@/lib/utils'
import { doc, updateDoc, addDoc, collection, setDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { applyLuck, updateLuck, generateCrashMultiplier } from '@/lib/luck'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import type { GameType, GameResult } from '@/types'
import { toast } from 'sonner'
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

  const configMinBet = settings?.gamesConfig?.[gameType]?.minBet || 10
  const effectiveMinBet = room ? (room.minBet || configMinBet) : configMinBet

  // Синхронизация ставки при загрузке комнаты
  useEffect(() => {
    if (room && room.minBet) {
      setBet(room.minBet)
    }
  }, [room?.id]) // eslint-disable-line


  /** Записать результат игры в Firestore и обновить баланс */
  const recordGameResult = useCallback(async (result: GameResult, payout: number, details: Record<string, unknown>) => {
    if (!profile) return

    const balanceChange = result === 'win' ? payout - bet : result === 'push' ? 0 : -bet
    const newBalance = Math.max(0, profile.balance + balanceChange)
    const newGamesPlayed = profile.totalGamesPlayed + 1
    
    // В мультиплеере используем среднюю удачу для истории, но личная удача меняется как обычно
    const currentLuck = room ? averageLuck : profile.luck
    const newLuck = updateLuck(profile.luck, newGamesPlayed)

    // Добавляем в живую ленту
    addLiveEvent({
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      game: GAME_TITLES[gameType],
      bet,
      payout: result === 'win' ? payout : -bet,
      result
    })

    // Обновляем профиль
    await updateDoc(doc(db, 'users', profile.nickname), {
      balance: newBalance,
      totalGamesPlayed: newGamesPlayed,
      totalWon: result === 'win' ? profile.totalWon + payout : profile.totalWon,
      totalLost: result === 'lose' ? profile.totalLost + bet : profile.totalLost,
      luck: newLuck,
      updatedAt: Date.now(),
    })

    // Записываем историю
    await addDoc(collection(db, 'games'), {
      userId: profile.nickname,
      gameType,
      bet,
      result,
      payout: result === 'win' ? payout : 0,
      details,
      luckAtTime: currentLuck,
      createdAt: Date.now(),
    })

    // Обновляем глобальную статистику за всё время
    await setDoc(doc(db, 'settings', 'global_stats'), {
      totalBets: increment(bet),
      totalPayouts: increment(result === 'win' ? payout : 0),
      totalGames: increment(1),
      updatedAt: Date.now(),
    }, { merge: true })

    await refreshProfile()
  }, [profile, bet, gameType, refreshProfile, addLiveEvent])

  function adjustBet(delta: number) {
    setBet(prev => Math.max(effectiveMinBet, Math.min(profile?.balance || 0, prev + delta)))
  }

  const gameProps = {
    bet, 
    luck: room ? averageLuck : profile.luck, 
    houseEdge: settings?.houseEdge || 0.03,
    balance: profile.balance,
    onResult: recordGameResult,
    multiplayer: roomId ? {
      room,
      joinRoom,
      leaveRoom,
      placeBet,
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

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-50 shrink-0">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="bg-marble/80 backdrop-blur-xl border-b border-gold/20 h-20">
          <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="flex items-center gap-2 text-gold hover:text-gold-light transition-colors font-medium">
                <ArrowLeft className="w-5 h-5" /> Лобби
              </button>
              {roomId && (
                <div className="h-6 w-px bg-gold/20 flex shrink-0" />
              )}
              {roomId && (
                <div className="flex flex-col">
                  <span className="text-[10px] text-gold font-bold uppercase tracking-tighter">Стол #{roomId.slice(-4)}</span>
                  <span className="text-xs text-muted-foreground leading-none">{GAME_TITLES[gameType]}</span>
                </div>
              )}
            </div>
            
            {!roomId && <h1 className="font-serif text-xl font-bold text-foreground tracking-tight">{GAME_TITLES[gameType]}</h1>}
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-marble-light/50 border border-gold/30">
                <Coins className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold text-gold-light">{formatDynamicBalance(profile.balance)}</span>
              </div>
              {roomId && (
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleBack}>
                  Выйти
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className={`${roomId ? 'max-w-7xl' : 'max-w-5xl'} mx-auto px-4 py-6`}>
        {/* Bet controls */}
        {true && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={() => adjustBet(-50)} disabled={bet <= effectiveMinBet}>
              <Minus className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-gold/30 min-w-[160px] justify-center">
              <Coins className="w-5 h-5 text-gold" />
              <span className="text-xl font-bold text-gold-light">{formatBalance(bet)}</span>
            </div>
            <Button variant="outline" size="icon" onClick={() => adjustBet(50)} disabled={bet >= (profile?.balance || 0)}>
              <Plus className="w-4 h-4" />
            </Button>
            <div className="flex flex-wrap gap-1 ml-2 justify-center">
              {[effectiveMinBet, 100, 500, 1000].map(v => (
                <Button key={v} variant="ghost" size="sm" onClick={() => setBet(Math.min(v, profile?.balance || 0))}
                  className={`text-xs px-2 ${bet === v ? 'text-gold border border-gold/50' : ''}`}>
                  {v >= 1000 ? `${v/1000}K` : v}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setBet(Math.max(effectiveMinBet, Math.floor((profile?.balance || 0) * 0.1)))} className="text-xs px-2">10%</Button>
              <Button variant="ghost" size="sm" onClick={() => setBet(Math.max(effectiveMinBet, Math.floor((profile?.balance || 0) * 0.33)))} className="text-xs px-2">33%</Button>
              <Button variant="ghost" size="sm" onClick={() => setBet(profile?.balance || 0)} className="text-xs px-2 font-bold text-emerald-400">All-in</Button>
            </div>
          </motion.div>
        )}

        {/* Game component */}
        <div className={`rounded-2xl border border-gold/20 bg-card/50 backdrop-blur-sm overflow-hidden ${roomId ? 'min-h-[600px]' : ''}`}>
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
