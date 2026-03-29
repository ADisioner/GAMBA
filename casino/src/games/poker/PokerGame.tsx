import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { applyLuck } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

type CardSuit = '♠' | '♥' | '♦' | '♣'
type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
interface Card { suit: CardSuit; value: CardValue; id: string }

const VALUES: CardValue[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const SUITS: CardSuit[] = ['♠', '♥', '♦', '♣']

const PAYOUTS = {
  royalFlush: 800,
  straightFlush: 50,
  fourOfAKind: 25,
  fullHouse: 9,
  flush: 6,
  straight: 4,
  threeOfAKind: 3,
  twoPair: 2,
  jacksOrBetter: 1,
}

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value, id: `${value}${suit}` })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function evaluateHand(cards: Card[]): keyof typeof PAYOUTS | null {
  if (cards.length !== 5) return null
  const values = cards.map(c => VALUES.indexOf(c.value)).sort((a, b) => a - b)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  let isStraight = true
  for (let i = 1; i < 5; i++) if (values[i] !== values[i-1] + 1) isStraight = false
  if (values.join(',') === '0,1,2,3,12') isStraight = true
  const counts: Record<number, number> = {}
  values.forEach(v => counts[v] = (counts[v] || 0) + 1)
  const countVals = Object.values(counts).sort((a, b) => b - a)

  if (isFlush && isStraight) {
    if (values[0] === 8 && values[4] === 12) return 'royalFlush'
    return 'straightFlush'
  }
  if (countVals[0] === 4) return 'fourOfAKind'
  if (countVals[0] === 3 && countVals[1] === 2) return 'fullHouse'
  if (isFlush) return 'flush'
  if (isStraight) return 'straight'
  if (countVals[0] === 3) return 'threeOfAKind'
  if (countVals[0] === 2 && countVals[1] === 2) return 'twoPair'
  if (countVals[0] === 2) {
    const pairValue = Object.keys(counts).find(k => counts[Number(k)] === 2)
    if (pairValue && Number(pairValue) >= 9) return 'jacksOrBetter'
  }
  return null
}

const HAND_NAMES: Record<keyof typeof PAYOUTS, string> = {
  royalFlush: 'Royal Flush',
  straightFlush: 'Straight Flush',
  fourOfAKind: 'Каре',
  fullHouse: 'Фулл Хаус',
  flush: 'Флеш',
  straight: 'Стрит',
  threeOfAKind: 'Тройка',
  twoPair: 'Две пары',
  jacksOrBetter: 'Валеты+'
}

/** Карта в стиле казино — тёмный фон, gold акценты */
function CardView({ card, index, held, toggleHold, disabled, size = 'md' }: {
  card: Card; index: number; held?: boolean; toggleHold?: (i: number) => void; disabled?: boolean; size?: 'sm' | 'md'
}) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const suitColor = isRed ? 'text-red-600' : 'text-slate-900'
  const isLarge = size === 'md'

  return (
    <motion.div
      initial={{ rotateY: 90, scale: 0.8 }}
      animate={{ rotateY: 0, scale: held ? 1.05 : 1, y: held ? -10 : 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
      whileHover={!disabled ? { scale: held ? 1.1 : 1.05, y: held ? -12 : -4 } : {}}
      onClick={() => !disabled && toggleHold?.(index)}
      className={`relative rounded-lg flex flex-col items-center justify-center select-none transition-all duration-200 ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      } ${isLarge ? 'w-24 h-34 sm:w-28 sm:h-40' : 'w-16 h-24 sm:w-20 sm:h-28'} ${
        held
          ? 'bg-white border-2 border-gold shadow-[0_0_15px_rgba(212,175,55,0.4)]'
          : 'bg-white border-2 border-slate-200 shadow-md'
      }`}
    >
      <span className={`absolute top-1 left-1.5 text-xs font-black ${suitColor}`}>{card.value}</span>
      <span className={`absolute top-3.5 left-1.5 text-[10px] ${suitColor}`}>{card.suit}</span>
      <span className={`text-4xl ${suitColor}`}>{card.suit}</span>
      
      <AnimatePresence>
        {held && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-velvet-dark text-[8px] font-black px-2 py-0.5 rounded-full tracking-tighter shadow-lg z-20"
          >
            УДЕРЖАТЬ
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function PokerGame({ bet, luck, houseEdge, balance, onResult, multiplayer }: Props & { multiplayer?: any }) {
  const isMulti = !!multiplayer?.room
  const room = multiplayer?.room
  const { profile } = useAuth()
  
  const [deck, setDeck] = useState<Card[]>([])
  const [hand, setHand] = useState<Card[]>([])
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false])
  const [gameState, setGameState] = useState<'idle' | 'dealt' | 'done'>('idle')
  const [resultMessage, setResultMessage] = useState('')
  const [lastWin, setLastWin] = useState<number | null>(null)

  const deal = useCallback(() => {
    if (bet > balance || gameState === 'dealt') return
    sounds.bet()
    setResultMessage('')
    setLastWin(null)
    
    let d = createDeck()
    const newHand: Card[] = []
    
    // Подкрутка на первую раздачу (увеличивает шанс хороших карт)
    const dealChance = applyLuck(0.05, luck)
    if (Math.random() < dealChance) {
      // Пытаемся дать сразу Пару или Тройку высоких карт
      const highValue = VALUES[Math.floor(Math.random() * (VALUES.length - 8)) + 8] // от 9 до A
      const matching = d.filter(c => c.value === highValue)
      if (matching.length >= 3) {
        newHand.push(matching[0], matching[1], matching[2])
        d = d.filter(c => !newHand.includes(c))
      }
    }
    
    // Добираем остальные карты честно
    while (newHand.length < 5) {
      newHand.push(d.pop()!)
    }

    setDeck(d); setHand(newHand)
    setHeld([false, false, false, false, false])
    setGameState('dealt')
    sounds.cardDeal()
    setTimeout(() => sounds.cardDeal(), 120)
    setTimeout(() => sounds.cardDeal(), 240)
  }, [bet, balance, gameState, luck])

  const draw = useCallback(() => {
    if (gameState !== 'dealt') return
    let d = [...deck]; const newHand = [...hand]
    let drew = false

    // Подкрутка: добор нужных карт (собираем комбинацию к held картам)
    const improveChance = applyLuck(0, luck)
    if (Math.random() < improveChance) {
      const heldCards = newHand.filter((_, i) => held[i])
      if (heldCards.length > 0) {
        const targetValue = heldCards[0].value
        const matchingInDeck = d.filter(c => c.value === targetValue)
        for (let i = 0; i < 5; i++) {
          if (!held[i] && matchingInDeck.length > 0) {
            const c = matchingInDeck.pop()!
            newHand[i] = c
            d = d.filter(card => card.id !== c.id)
          }
        }
      }
    }

    for (let i = 0; i < 5; i++) {
      if (!held[i]) { 
        if (newHand[i] === hand[i]) newHand[i] = d.pop()!
        drew = true 
      }
    }

    if (drew) sounds.cardDeal()
    setDeck(d)
    setHand(newHand); setGameState('done')
    const evalResult = evaluateHand(newHand)
    let gameResult: GameResult = 'lose'
    let payout = 0
    if (evalResult) {
      gameResult = 'win'
      payout = bet * PAYOUTS[evalResult]
      setResultMessage(`${HAND_NAMES[evalResult]}!`)
      setLastWin(payout)
      if (PAYOUTS[evalResult] >= 6) sounds.bigWin()
      else sounds.win()
    } else {
      setResultMessage('Нет комбинации')
      sounds.lose()
    }
    onResult(gameResult, payout, { hand: newHand, combination: evalResult })
  }, [gameState, deck, hand, held, bet, onResult])

  const toggleHold = (index: number) => {
    if (gameState !== 'dealt') return
    sounds.click()
    setHeld(prev => { const n = [...prev]; n[index] = !n[index]; return n })
  }

  // MULTIPLAYER ACTIONS
  const handleJoinSeat = (seat: number) => {
    if (!profile) return
    if (isMulti && multiplayer) {
      multiplayer.joinRoom(seat)
    }
  }

  const myPlayer = (room?.players && profile) ? (
    room.players[profile.uid] || 
    Object.values(room.players).find((p: any) => p.uid === profile.uid || p.nickname === profile.nickname)
  ) : null

  return (
    <div className="relative p-4 flex flex-col items-center min-h-[600px] w-full bg-emerald-950/20 overflow-hidden">
      {/* Table Structure */}
      <div className="absolute inset-0 border-[16px] border-emerald-950/60 rounded-3xl pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-emerald-900/40 to-transparent" />
      
      {/* Central Felt Design */}
      <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] border-4 border-gold/5 rounded-[200px] pointer-events-none flex flex-col items-center justify-center">
         <div className="text-gold/5 font-serif text-7xl font-bold tracking-[0.3em] mb-4 select-none">VIDEO POKER</div>
         <div className="text-gold/5 font-serif text-2xl font-bold tracking-[0.5em] border-t border-gold/5 pt-6 uppercase select-none">Jacks or Better · Pays 800 to 1</div>
      </div>

      {/* Players Seats (Semi-circle) */}
      <div className="absolute inset-0 pointer-events-none">
         {[1,2,3,4,5,6].map(seatNum => {
            const playersArr = Object.values(room?.players || {})
            const player = playersArr.find((p: any) => p.seat === seatNum) as any
            const isMe = player?.uid === profile?.uid
            
            // Расстановка по дуге (аналогично Блэкджеку)
            const angle = (seatNum - 1) * (180 / 5) - 180
            const radiusX = 420
            const radiusY = 160
            const x = Math.cos((angle * Math.PI) / 180) * radiusX
            const y = Math.sin((angle * Math.PI) / 180) * radiusY

            return (
              <div key={seatNum} className="absolute left-1/2 bottom-20 -translate-x-1/2 pointer-events-auto" 
                style={{ transform: `translate(calc(-50% + ${x}px), ${y}px)` }}>
                <div className="flex flex-col items-center gap-2">
                   {player ? (
                     <div className={`flex flex-col items-center p-2 rounded-xl border transition-all min-w-[90px] ${isMe ? 'border-gold bg-gold/10 shadow-glow-gold' : 'border-gold/20 bg-black/40'}`}>
                        <div className="flex gap-0.5 mb-1">
                           {(player.cards || []).slice(0, 5).map((c: any, i: number) => (
                             <div key={i} className="w-4 h-6 bg-white rounded-[2px] border border-black/10 flex items-center justify-center text-[8px] font-bold text-slate-900">
                               {c.suit}
                             </div>
                           ))}
                           {(!player.cards || player.cards.length === 0) && Array(5).fill(0).map((_, i) => (
                             <div key={i} className="w-4 h-6 bg-gold/5 border border-gold/10 rounded-[2px]" />
                           ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                           <img src={player.avatarUrl} className="w-5 h-5 rounded-full border border-gold/40" />
                           <span className="text-[9px] font-black text-foreground truncate max-w-[50px] uppercase tracking-tighter">{player.nickname}</span>
                        </div>
                        <span className="text-[10px] text-neon-green font-mono mt-0.5">${(player.bet || 0).toLocaleString()}</span>
                     </div>
                   ) : (
                     <button onClick={() => isMulti && handleJoinSeat(seatNum)} className="w-12 h-12 rounded-full border-2 border-dashed border-gold/10 hover:border-gold/40 hover:bg-gold/5 flex flex-col items-center justify-center group transition-all">
                        <span className="text-[7px] text-gold/30 font-black uppercase group-hover:text-gold">МЕСТО</span>
                     </button>
                   )}
                </div>
              </div>
            )
         })}
      </div>

      {/* Payouts Table - Floating at top */}
      <div className="grid grid-cols-5 gap-1 w-full max-w-4xl z-10 bg-black/40 backdrop-blur-md p-1 rounded-lg border border-gold/20 mb-8">
        {Object.entries(PAYOUTS).map(([key, mult]) => (
          <div key={key} className={`flex flex-col items-center justify-center p-2 rounded transition-all ${
            resultMessage.includes(HAND_NAMES[key as keyof typeof PAYOUTS]) 
              ? 'bg-gold text-velvet-dark scale-105 shadow-glow-gold' 
              : 'text-gold/50'
          }`}>
            <span className="text-[9px] font-black uppercase text-center leading-tight h-5 overflow-hidden">{HAND_NAMES[key as keyof typeof PAYOUTS]}</span>
            <span className="text-sm font-bold mt-1">x{mult}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full relative">
        <AnimatePresence mode="wait">
          {resultMessage && (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
              className="absolute top-[-40px] z-30 text-center pointer-events-none">
                <div className={`text-4xl font-serif font-black uppercase tracking-widest drop-shadow-lg ${lastWin ? 'text-gold text-glow-gold' : 'text-slate-400 opacity-50'}`}>
                  {resultMessage}
                </div>
                {lastWin && <div className="text-2xl font-black text-neon-green mt-2 animate-bounce">+${lastWin.toLocaleString()}</div>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center gap-10">
           {/* Card Slots Design */}
           <div className="flex gap-4 p-6 rounded-3xl bg-black/20 border border-gold/10 shadow-inner min-w-[500px] justify-center relative">
             <div className="absolute inset-0 opacity-10 pointer-events-none flex justify-center items-center">
                <div className="w-24 h-34 border border-gold/40 rounded-lg mx-2" />
                <div className="w-24 h-34 border border-gold/40 rounded-lg mx-2" />
                <div className="w-24 h-34 border border-gold/40 rounded-lg mx-2" />
                <div className="w-24 h-34 border border-gold/40 rounded-lg mx-2" />
                <div className="w-24 h-34 border border-gold/40 rounded-lg mx-2" />
             </div>

             {gameState !== 'idle' ? (
               <div className="flex gap-4">
                 {hand.map((card, i) => (
                  <CardView key={`${card.id}-${gameState}`} card={card} index={i} held={held[i]} 
                    toggleHold={toggleHold} disabled={gameState !== 'dealt'} size="md" />
                 ))}
               </div>
             ) : (
               <div className="h-40 flex items-center justify-center opacity-30 italic text-gold animate-pulse text-2xl font-serif tracking-widest leading-relaxed text-center px-10">
                 РАЗМЕСТИТЕ СТАВКУ<br/><span className="text-sm tracking-[0.4em] uppercase opacity-50 font-sans">Чтобы начать игру</span>
               </div>
             )}
           </div>

           {/* Controls Section */}
           <div className="flex flex-col items-center gap-4">
              {isMulti ? (
                <div className="flex gap-4">
                  {/* Multiplayer Bet Button */}
                  {room.status === 'waiting' && myPlayer?.status === 'ready' && (
                    <Button onClick={() => multiplayer.placeBet(bet)} size="xl"
                      className="w-64 bg-gold hover:bg-gold-light text-velvet-dark font-black py-8 shadow-glow-gold rounded-2xl text-xl animate-pulse">
                      ПОСТАВИТЬ {bet}$
                    </Button>
                  )}
                  
                  {/* Game actions if already playing in multi (simplified for now) */}
                  {gameState === 'dealt' && (
                    <Button onClick={draw} size="xl" className="w-64 bg-neon-green/80 hover:bg-neon-green text-emerald-950 font-black py-8 rounded-2xl text-xl">
                      ЗАМЕНИТЬ
                    </Button>
                  )}
                </div>
              ) : (
                gameState === 'idle' || gameState === 'done' ? (
                  <Button onClick={deal} size="xl" disabled={bet > balance} 
                    className="w-64 bg-gold hover:bg-gold-light text-velvet-dark font-black py-8 shadow-glow-gold rounded-2xl text-xl transition-all hover:scale-105 active:scale-95">
                    {gameState === 'done' ? 'НОВАЯ ИГРА' : 'РАЗДАТЬ КАРТЫ'}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-gold/60 text-xs font-serif uppercase tracking-[0.3em] animate-pulse">Выберите карты для удержания</div>
                    <Button onClick={draw} size="xl"
                      className="w-64 bg-neon-green/80 hover:bg-neon-green text-emerald-950 font-black py-8 shadow-[0_0_30px_rgba(74,222,128,0.3)] rounded-2xl text-xl animate-pulse">
                      ЗАМЕНИТЬ (DRAW)
                    </Button>
                  </div>
                )
              )}
           </div>
        </div>
      </div>
      
      {/* Decorative Table Bottom */}
      <div className="absolute bottom-0 w-[120%] h-32 bg-gradient-to-t from-emerald-950 to-transparent border-t border-gold/20 rounded-[50%] -translate-y-[-50px]" />
    </div>
  )
}
