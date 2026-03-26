import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

type CardSuit = '♠' | '♥' | '♦' | '♣'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
interface Card { suit: CardSuit; value: CardValue; hidden?: boolean }

function createDeck(): Card[] {
  const suits: CardSuit[] = ['♠', '♥', '♦', '♣']
  const values: CardValue[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const deck: Card[] = []
  for (const suit of suits) for (const value of values) deck.push({ suit, value })
  // Перемешиваем
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardScore(cards: Card[]): number {
  let score = 0; let aces = 0
  for (const c of cards) {
    if (c.hidden) continue
    if (c.value === 'A') { score += 11; aces++ }
    else if (['J','Q','K'].includes(c.value)) score += 10
    else score += parseInt(c.value)
  }
  while (score > 21 && aces > 0) { score -= 10; aces-- }
  return score
}

function CardView({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  if (card.hidden) return (
    <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay }}
      className="w-16 h-24 rounded-lg bg-gradient-to-br from-velvet to-velvet-dark border border-gold/30 flex items-center justify-center text-gold/40 text-2xl">?</motion.div>
  )
  return (
    <motion.div initial={{ rotateY: 90, scale: 0.8 }} animate={{ rotateY: 0, scale: 1 }} transition={{ delay, type: 'spring' }}
      className="w-16 h-24 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center shadow-md">
      <span className={`text-sm font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.value}</span>
      <span className={`text-lg ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.suit}</span>
    </motion.div>
  )
}

export function BlackjackGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dealerTurn' | 'done'>('idle')
  const [message, setMessage] = useState('')

  const deal = useCallback(() => {
    if (bet > balance) return
    sounds.bet()
    const d = createDeck()
    const pH = [d.pop()!, d.pop()!]
    const dH = [d.pop()!, { ...d.pop()!, hidden: true }]
    setDeck(d); setPlayerHand(pH); setDealerHand(dH)
    setGameState('playing'); setMessage('')
    // Звук раздачи карт
    sounds.cardDeal(); setTimeout(() => sounds.cardDeal(), 150)
    setTimeout(() => sounds.cardDeal(), 300); setTimeout(() => sounds.cardDeal(), 450)

    // Проверка на блэкджек
    if (cardScore(pH) === 21) {
      dH[1].hidden = false; setDealerHand([...dH])
      sounds.cardFlip()
      if (cardScore(dH) === 21) {
        setMessage('Оба блэкджек — ничья!'); setGameState('done')
        onResult('push', bet, { player: pH, dealer: dH })
      } else {
        const payout = bet * 2.5
        setMessage(`Блэкджек! +${payout.toLocaleString()}`); setGameState('done')
        sounds.bigWin()
        onResult('win', payout, { player: pH, dealer: dH })
      }
    }
  }, [bet, balance, onResult])

  const hit = useCallback(() => {
    if (gameState !== 'playing') return
    sounds.cardDeal()
    const d = [...deck]; const card = d.pop()!
    const newHand = [...playerHand, card]
    setDeck(d); setPlayerHand(newHand)
    if (cardScore(newHand) > 21) {
      setMessage('Перебор! 💀'); setGameState('done')
      dealerHand[1].hidden = false; setDealerHand([...dealerHand])
      sounds.lose()
      onResult('lose', 0, { player: newHand, dealer: dealerHand })
    }
  }, [gameState, deck, playerHand, dealerHand, onResult])

  const stand = useCallback(async () => {
    if (gameState !== 'playing') return
    setGameState('dealerTurn')
    const d = [...deck]; const dH = [...dealerHand]
    dH[1].hidden = false
    sounds.cardFlip()

    // Дилер берёт карты до 17
    while (cardScore(dH) < 17) {
      await new Promise(r => setTimeout(r, 600))
      sounds.cardDeal()
      dH.push(d.pop()!); setDealerHand([...dH]); setDeck([...d])
    }

    const pScore = cardScore(playerHand)
    const dScore = cardScore(dH)

    if (dScore > 21) {
      setMessage(`Дилер перебрал! +${(bet * 2).toLocaleString()}`); setGameState('done')
      sounds.win()
      onResult('win', bet * 2, { player: playerHand, dealer: dH })
    } else if (pScore > dScore) {
      setMessage(`Вы выиграли! +${(bet * 2).toLocaleString()}`); setGameState('done')
      sounds.win()
      onResult('win', bet * 2, { player: playerHand, dealer: dH })
    } else if (pScore === dScore) {
      setMessage('Ничья!'); setGameState('done')
      onResult('push', bet, { player: playerHand, dealer: dH })
    } else {
      setMessage('Дилер выиграл 😞'); setGameState('done')
      sounds.lose()
      onResult('lose', 0, { player: playerHand, dealer: dH })
    }
  }, [gameState, deck, dealerHand, playerHand, bet, onResult])

  const doubleDown = useCallback(() => {
    if (gameState !== 'playing' || playerHand.length !== 2 || bet * 2 > balance) return
    const d = [...deck]; const card = d.pop()!
    const newHand = [...playerHand, card]
    setDeck(d); setPlayerHand(newHand)
    if (cardScore(newHand) > 21) {
      setMessage('Перебор на дабле! 💀'); setGameState('done')
      dealerHand[1].hidden = false; setDealerHand([...dealerHand])
      onResult('lose', 0, { player: newHand, dealer: dealerHand, doubled: true })
    } else {
      // Автоматически стоим после дабла
      stand()
    }
  }, [gameState, playerHand, deck, balance, bet, dealerHand, stand, onResult])

  return (
    <div className="p-8 flex flex-col items-center min-h-[400px]">
      {gameState === 'idle' ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-muted-foreground mb-6">Нажмите «Раздать» для начала</p>
          <Button onClick={deal} size="xl" disabled={bet > balance}>🃏 РАЗДАТЬ</Button>
        </div>
      ) : (
        <>
          {/* Dealer */}
          <div className="mb-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">Дилер {gameState === 'done' || gameState === 'dealerTurn' ? `(${cardScore(dealerHand)})` : ''}</p>
            <div className="flex gap-2 justify-center">{dealerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}</div>
          </div>

          {/* Message */}
          <AnimatePresence>{message && (
            <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xl font-bold text-gold mb-4 text-glow-gold">{message}</motion.p>
          )}</AnimatePresence>

          {/* Player */}
          <div className="mb-6 text-center">
            <div className="flex gap-2 justify-center mb-2">{playerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}</div>
            <p className="text-sm text-gold font-semibold">Вы ({cardScore(playerHand)})</p>
          </div>

          {/* Controls */}
          {gameState === 'playing' && (
            <div className="flex gap-3">
              <Button onClick={hit} variant="outline">Hit</Button>
              <Button onClick={stand}>Stand</Button>
              {playerHand.length === 2 && <Button onClick={doubleDown} variant="outline" disabled={bet * 2 > balance}>Double</Button>}
            </div>
          )}
          {gameState === 'done' && <Button onClick={deal} size="lg" className="mt-2">🃏 Раздать снова</Button>}
        </>
      )}
    </div>
  )
}
