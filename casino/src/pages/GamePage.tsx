import { useParams, useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { applyLuck, updateLuck, generateCrashMultiplier } from '@/lib/luck'
import type { GameType, GameResult } from '@/types'
import { toast } from 'sonner'
import { SlotsGame } from '@/games/slots/SlotsGame'
import { RouletteGame } from '@/games/roulette/RouletteGame'
import { BlackjackGame } from '@/games/blackjack/BlackjackGame'
import { CrashGame } from '@/games/crash/CrashGame'
import { MinesGame } from '@/games/mines/MinesGame'

const GAME_TITLES: Record<GameType, string> = {
  slots: 'Golden Slots',
  roulette: 'Рулетка',
  blackjack: 'Блэкджек',
  crash: 'Crash',
  mines: 'Mines',
}

export function GamePage() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const { profile, settings, refreshProfile } = useAuth()
  const [bet, setBet] = useState(100)

  const gameType = type as GameType
  if (!profile || !['slots', 'roulette', 'blackjack', 'crash', 'mines'].includes(gameType)) {
    return <div className="min-h-screen flex items-center justify-center"><p>Игра не найдена</p></div>
  }

  const config = settings?.gamesConfig?.[gameType]
  const minBet = config?.minBet || 10
  const maxBet = config?.maxBet || 5000

  /** Записать результат игры в Firestore и обновить баланс */
  const recordGameResult = useCallback(async (result: GameResult, payout: number, details: Record<string, unknown>) => {
    if (!profile) return

    const balanceChange = result === 'win' ? payout - bet : result === 'push' ? 0 : -bet
    const newBalance = Math.max(0, profile.balance + balanceChange)
    const newGamesPlayed = profile.totalGamesPlayed + 1
    const newLuck = updateLuck(profile.luck, newGamesPlayed)

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
      luckAtTime: profile.luck,
      createdAt: Date.now(),
    })

    await refreshProfile()
  }, [profile, bet, gameType, refreshProfile])

  function adjustBet(delta: number) {
    setBet(prev => Math.max(minBet, Math.min(maxBet, Math.min(profile.balance, prev + delta))))
  }

  const gameProps = {
    bet, luck: profile.luck, houseEdge: settings?.houseEdge || 0.03,
    balance: profile.balance, onResult: recordGameResult,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-marble/80 backdrop-blur-xl border-b border-gold/20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-gold hover:text-gold-light transition-colors">
            <ArrowLeft className="w-5 h-5" /> Лобби
          </button>
          <h1 className="font-serif text-xl font-bold text-foreground">{GAME_TITLES[gameType]}</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-marble-light/50 border border-gold/30">
            <Coins className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold text-gold-light">{formatBalance(profile.balance)}</span>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Bet controls */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => adjustBet(-50)} disabled={bet <= minBet}>
            <Minus className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-gold/30 min-w-[160px] justify-center">
            <Coins className="w-5 h-5 text-gold" />
            <span className="text-xl font-bold text-gold-light">{formatBalance(bet)}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => adjustBet(50)} disabled={bet >= Math.min(maxBet, profile.balance)}>
            <Plus className="w-4 h-4" />
          </Button>
          <div className="flex gap-1 ml-2">
            {[minBet, 100, 500, 1000].map(v => (
              <Button key={v} variant="ghost" size="sm" onClick={() => setBet(Math.min(v, profile.balance))}
                className={`text-xs ${bet === v ? 'text-gold border-gold/50' : ''}`}>
                {v >= 1000 ? `${v/1000}K` : v}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setBet(Math.min(maxBet, profile.balance))} className="text-xs">MAX</Button>
          </div>
        </motion.div>

        {/* Game component */}
        <div className="rounded-2xl border border-gold/20 bg-card/50 backdrop-blur-sm overflow-hidden">
          {gameType === 'slots' && <SlotsGame {...gameProps} />}
          {gameType === 'roulette' && <RouletteGame {...gameProps} />}
          {gameType === 'blackjack' && <BlackjackGame {...gameProps} />}
          {gameType === 'crash' && <CrashGame {...gameProps} />}
          {gameType === 'mines' && <MinesGame {...gameProps} />}
        </div>
      </div>
    </div>
  )
}
