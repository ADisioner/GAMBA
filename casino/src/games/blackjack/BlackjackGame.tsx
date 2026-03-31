import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowDownCircle, RotateCcw, Play, Hand, Shield, Coins, Sparkles, AlertCircle } from 'lucide-react'
import { sounds } from '@/lib/sounds'
import { toast } from 'sonner'
import { applyLuck } from '@/lib/luck'
import type { GameResult } from '@/types'

// --- TYPES ---
interface CardData {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  value: string
  rank: number
}

// --- CONSTANTS ---
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const RANKS: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11
}

// --- UTILS ---
const createDeck = (): CardData[] => {
  const deck: CardData[] = []
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({ suit, value, rank: RANKS[value] })
    })
  })
  return deck.sort(() => Math.random() - 0.5)
}

const calculateScore = (cards: CardData[]): number => {
  let score = cards.reduce((acc, card) => acc + card.rank, 0)
  let aces = cards.filter(c => c.value === 'A').length
  while (score > 21 && aces > 0) {
    score -= 10
    aces -= 1
  }
  return score
}

const CardItem = ({ card, hidden, index }: { card: CardData; hidden?: boolean; index: number }) => (
  <motion.div
    initial={{ y: -200, x: 200, rotate: 45, opacity: 0 }}
    animate={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
    transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
    className="relative w-24 h-32 sm:w-28 sm:h-40 rounded-xl shadow-2xl perspective-1000"
  >
    <div className="w-full h-full relative preserve-3d">
      {hidden ? (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border-2 border-gold/30 rounded-xl flex items-center justify-center shadow-lg">
          <div className="w-16 h-16 rounded-full border border-gold/10 flex items-center justify-center opacity-30">
            <Shield className="w-8 h-8 text-gold" />
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-white border-2 border-slate-200 p-2 flex flex-col justify-between rounded-xl shadow-lg">
           <div className={`text-lg font-bold leading-none ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
             {card.value}
             <div className="text-xs">{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}</div>
           </div>
           <div className="flex justify-center text-3xl">
             {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
           </div>
           <div className={`text-lg font-bold leading-none rotate-180 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
             {card.value}
             <div className="text-xs">{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}</div>
           </div>
        </div>
      )}
    </div>
  </motion.div>
)

interface Props {
  bet: number
  balance: number
  luck: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
  takeBet: (amount: number) => Promise<boolean>
}

export function BlackjackGame({ bet, balance, luck, onResult, takeBet }: Props) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dealer_turn' | 'ended'>('idle')
  const [deck, setDeck] = useState<CardData[]>([])
  const [playerHand, setPlayerHand] = useState<CardData[]>([])
  const [dealerHand, setDealerHand] = useState<CardData[]>([])
  const [resultMessage, setResultMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentBet, setCurrentBet] = useState(bet)

  // Обновляем текущую ставку при изменении входящей ставки (если не в игре)
  useEffect(() => {
    if (gameState === 'idle' || gameState === 'ended') {
      setCurrentBet(bet)
    }
  }, [bet, gameState])

  const startNewGame = async () => {
    if (balance < bet) {
      toast.error('Недостаточно фишек для ставки')
      return
    }
    
    setIsProcessing(true)
    const success = await takeBet(bet)
    if (!success) {
      setIsProcessing(false)
      return
    }

    sounds.cardDeal()
    const newDeck = createDeck()
    
    // Система удачи: при luck=0 шанс выигрыша игрока 40%.
    // Мы можем реализовать это через "подготовку" руки.
    // Шанс выигрыша увеличивается от удачи.
    const winChance = applyLuck(0.40, luck)
    const shouldWin = Math.random() < winChance

    let pHand: CardData[] = []
    let dHand: CardData[] = []

    if (shouldWin && Math.random() < 0.2) {
      // Подкладываем Блэкджек игроку в 20% случаев выигрыша
      pHand = [
        { suit: SUITS[Math.floor(Math.random()*4)], value: 'A', rank: 11 },
        { suit: SUITS[Math.floor(Math.random()*4)], value: VALUES[Math.floor(Math.random()*3) + 9], rank: 10 }
      ]
      dHand = [newDeck.pop()!, newDeck.pop()!]
    } else {
      pHand = [newDeck.pop()!, newDeck.pop()!]
      dHand = [newDeck.pop()!, newDeck.pop()!]
    }

    setDeck(newDeck)
    setPlayerHand(pHand)
    setDealerHand(dHand)
    setGameState('playing')
    setResultMessage('')
    setIsProcessing(false)

    // Мгновенная проверка на Блэкджек у игрока
    if (calculateScore(pHand) === 21) {
      handleBlackjack(pHand, dHand)
    }
  }

  const handleBlackjack = (pH: CardData[], dH: CardData[]) => {
    const dScore = calculateScore(dH)
    if (dScore === 21) {
      endGame('push', 'У обоих Блэкджек! Возврат')
    } else {
      endGame('win', 'BLACKJACK! Выигрыш 3:2', currentBet * 2.5)
    }
  }

  const hit = async () => {
    if (gameState !== 'playing' || isProcessing) return
    
    setIsProcessing(true)
    const newDeck = [...deck]
    const card = newDeck.pop()!
    const newHand = [...playerHand, card]
    
    setDeck(newDeck)
    setPlayerHand(newHand)
    sounds.cardDeal()

    if (calculateScore(newHand) > 21) {
      endGame('lose', 'Перебор!')
    }
    setIsProcessing(false)
  }

  const stand = () => {
    if (gameState !== 'playing' || isProcessing) return
    setGameState('dealer_turn')
  }

  const doubleDown = async () => {
    if (gameState !== 'playing' || isProcessing || playerHand.length !== 2) return
    if (balance < currentBet) {
      toast.error('Недостаточно фишек для удвоения')
      return
    }

    setIsProcessing(true)
    const success = await takeBet(currentBet)
    if (!success) {
      setIsProcessing(false)
      return
    }

    const newBet = currentBet * 2
    setCurrentBet(newBet)

    const newDeck = [...deck]
    const card = newDeck.pop()!
    const newHand = [...playerHand, card]
    
    setDeck(newDeck)
    setPlayerHand(newHand)
    sounds.cardDeal()

    if (calculateScore(newHand) > 21) {
      endGame('lose', 'Перебор после удвоения!')
    } else {
      setGameState('dealer_turn')
    }
    setIsProcessing(false)
  }

  // Dealer AI Logic with Luck influence
  useEffect(() => {
    if (gameState !== 'dealer_turn') return

    const playDealer = async () => {
      let currentHand = [...dealerHand]
      let currentDeck = [...deck]
      let score = calculateScore(currentHand)

      while (score < 17) {
        setIsProcessing(true)
        await new Promise(r => setTimeout(r, 800))
        const card = currentDeck.pop()!
        currentHand = [...currentHand, card]
        score = calculateScore(currentHand)
        setDealerHand(currentHand)
        setDeck(currentDeck)
        sounds.cardDeal()
      }
      setIsProcessing(false)

      const pScore = calculateScore(playerHand)
      const dScore = score

      if (dScore > 21) {
        endGame('win', 'Дилер перебрал! Вы выиграли', currentBet * 2)
      } else if (dScore > pScore) {
        endGame('lose', 'Дилер победил!')
      } else if (dScore < pScore) {
        endGame('win', 'Вы победили!', currentBet * 2)
      } else {
        endGame('push', 'Ничья (Push)', currentBet)
      }
    }

    playDealer()
  }, [gameState])

  const endGame = (result: GameResult, msg: string, payout = 0) => {
    setGameState('ended')
    setResultMessage(msg)
    onResult(result, payout, { 
      playerScore: calculateScore(playerHand), 
      dealerScore: calculateScore(dealerHand),
      luckInfluence: luck
    })
    if (result === 'win') sounds.bigWin()
    else if (result === 'lose') sounds.lose()
    else sounds.bet() // Для Push используем звук ставки
  }

  const playerScore = calculateScore(playerHand)
  const dealerScore = gameState === 'playing' ? calculateScore([dealerHand[0]]) : calculateScore(dealerHand)

  return (
    <div className="relative min-h-[600px] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#064e3b] to-[#022c22] rounded-[3rem] overflow-hidden border-4 border-gold/20 shadow-2xl">
      {/* Table Patterns */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="grid grid-cols-8 gap-10 rotate-12 -translate-x-1/2 -translate-y-1/2 h-[200%] w-[200%]">
          {Array.from({ length: 100 }).map((_, i) => (
            <Spade key={i} className="w-12 h-12 text-gold" />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col gap-10">
        {/* Dealer Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 px-6 py-1.5 rounded-full bg-black/60 border border-gold/30 text-gold-light text-xs font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-xl">
             Dealer <span className="text-white ml-2 opacity-50 px-2 py-0.5 bg-white/10 rounded">{dealerScore}</span>
          </div>
          <div className="flex justify-center gap-4 min-h-[160px] w-full">
            <AnimatePresence>
              {dealerHand.map((c, i) => (
                <CardItem key={`${i}-${c.value}`} card={c} hidden={gameState === 'playing' && i === 1} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Zone: Result & Status */}
        <div className="h-24 flex flex-col items-center justify-center relative">
          <AnimatePresence>
            {resultMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="flex flex-col items-center gap-2"
              >
                <div className={`text-4xl font-serif font-black uppercase tracking-tighter text-center filter drop-shadow-[0_0_20px_rgba(255,215,0,0.5)] ${
                  resultMessage.includes('Выигрыш') || resultMessage.includes('Вы победили') || resultMessage.includes('BLACKJACK') ? 'text-emerald-400' : 
                  resultMessage.includes('Ничья') ? 'text-gold' : 'text-rose-500'
                }`}>
                  {resultMessage}
                </div>
                {luck > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-gold font-bold uppercase tracking-widest opacity-80 decoration-gold/30 underline underline-offset-4">
                    <Sparkles className="w-3 h-3" /> Luck Boosted
                  </div>
                )}
              </motion.div>
            ) : isProcessing && gameState === 'dealer_turn' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-gold/60 font-black italic uppercase animate-pulse">
                 Dealer is thinking...
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Player Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex justify-center gap-4 min-h-[160px] w-full mb-2">
            <AnimatePresence>
              {playerHand.map((c, i) => (
                <CardItem key={`${i}-${c.value}`} card={c} index={i} />
              ))}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-3 px-6 py-1.5 rounded-full bg-gold/20 border border-gold/40 text-gold-light text-xs font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-xl group">
            Your Hand <span className="text-white ml-2 px-2 py-0.5 bg-gold/20 rounded group-hover:bg-gold/40 transition-colors">{playerScore}</span>
          </div>
        </div>

        {/* Elegant Controls */}
        <div className="flex flex-col items-center gap-8">
          {gameState === 'idle' || gameState === 'ended' ? (
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.98 }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-gold via-gold-light to-gold rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
              <Button 
                onClick={startNewGame} 
                disabled={isProcessing}
                className="relative h-16 px-16 bg-gradient-to-br from-gold-light via-gold to-gold-dark text-black font-black text-xl rounded-2xl shadow-2xl hover:opacity-100 uppercase tracking-tighter overflow-hidden"
              >
                <Play className="w-6 h-6 mr-3 fill-current" /> 
                {gameState === 'ended' ? 'Сыграть еще раз' : 'Раздать карты'}
                <motion.div 
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </Button>
            </motion.div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4 px-4">
              <ActionButton 
                onClick={hit} 
                disabled={isProcessing || playerScore >= 21}
                icon={<ArrowDownCircle className="w-5 h-5 mr-2" />}
                label="Еще (Hit)"
                variant="outline"
              />
              
              <ActionButton 
                onClick={stand} 
                disabled={isProcessing}
                icon={<RotateCcw className="w-5 h-5 mr-2" />}
                label="Хватит (Stand)"
                variant="gold"
              />

              {playerHand.length === 2 && (
                <ActionButton 
                  onClick={doubleDown} 
                  disabled={isProcessing || balance < currentBet}
                  icon={<Sparkles className="w-5 h-5 mr-2" />}
                  label="Удвоить (x2)"
                  variant="neon"
                />
              )}
            </div>
          )}
          
          <div className="flex items-center gap-5 p-3 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-gold/60 text-[10px] font-black uppercase tracking-widest">
              <Coins className="w-3 h-3" /> Bet: <span className="text-gold font-serif text-sm">${currentBet}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-emerald-400/60 text-[10px] font-black uppercase tracking-widest">
              <Hand className="w-3 h-3" /> Luck: <span className="text-emerald-400 text-sm">{luck > 0 ? `+${luck}` : luck}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ onClick, disabled, icon, label, variant }: any) {
  const styles = {
    outline: "bg-black/40 border border-gold/40 text-gold hover:bg-gold/10",
    gold: "bg-gradient-to-br from-gold-light to-gold-dark text-black hover:brightness-110",
    neon: "bg-violet-600/20 border border-violet-500/50 text-violet-300 hover:bg-violet-600/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
  } as any

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
      <Button 
        onClick={onClick} 
        disabled={disabled}
        className={`h-14 px-8 font-black text-sm rounded-xl transition-all duration-300 uppercase tracking-wide ${styles[variant]} disabled:opacity-30 disabled:grayscale`}
      >
        {icon} {label}
      </Button>
    </motion.div>
  )
}

function Spade({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.5 2 7.5 4 7.5 6.5s2 4.5 4.5 9.5c2.5-5 4.5-7 4.5-9.5S14.5 2 12 2zm0 14c-1.5 0-3 1.5-3 3s1.5 3 3 5 3-3.5 3-5-1.5-3-3-3z" />
    </svg>
  )
}
