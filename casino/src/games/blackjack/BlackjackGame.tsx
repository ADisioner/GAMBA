import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'
import { ref, update } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import { sounds } from '@/lib/sounds'
import { applyLuck } from '@/lib/luck'
import { toast } from 'sonner'
import type { GameResult, MultiplayerRoom, PlayerStatus, RoomPlayer } from '@/types'

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

type CardSuit = '♠' | '♥' | '♦' | '♣'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
interface Card { suit: CardSuit; value: CardValue; hidden?: boolean }

function createDeck(): Card[] {
  const suits: CardSuit[] = ['♠', '♥', '♦', '♣']
  const values: CardValue[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const deck: Card[] = []
  for (const suit of suits) for (const value of values) deck.push({ suit, value })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardScore(cards: Card[]): number {
  let score = 0; let aces = 0
  if (!cards) return 0
  for (const c of cards) {
    if (c.hidden) continue
    if (c.value === 'A') { score += 11; aces++ }
    else if (['J','Q','K'].includes(c.value)) score += 10
    else {
      const val = Number(c.value)
      if (!isNaN(val)) score += val
    }
  }
  while (score > 21 && aces > 0) { score -= 10; aces-- }
  return score
}

function CardView({ card, delay = 0, size = 'md' }: { card: Card; delay?: number; size?: 'sm' | 'md' }) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const sizeClasses = size === 'sm' ? 'w-12 h-18 text-xs' : 'w-24 h-36 text-lg'
  const suitClasses = size === 'sm' ? 'text-lg' : 'text-2xl'
  
  if (card.hidden) return (
    <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay }}
      className={`${sizeClasses} rounded-lg bg-gradient-to-br from-velvet to-velvet-dark border border-gold/30 flex items-center justify-center text-gold/40`}>?</motion.div>
  )
  return (
    <motion.div initial={{ rotateY: 90, scale: 0.8 }} animate={{ rotateY: 0, scale: 1 }} transition={{ delay, type: 'spring' }}
      className={`${sizeClasses} rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center shadow-lg`}>
      <span className={`font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.value}</span>
      <span className={`${suitClasses} ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.suit}</span>
    </motion.div>
  )
}

export function BlackjackGame({ bet, luck, houseEdge, balance, onResult, multiplayer }: Props) {
  const { profile } = useAuth()
  const isMulti = !!multiplayer?.room
  const room = multiplayer?.room
  
  // Гибкий поиск игрока для совместимости (UID или Никнейм)
  const myPlayer = (room?.players && profile) ? (
    room.players[profile.uid] || 
    Object.values(room.players).find((p: any) => p.uid === profile.uid || p.nickname === profile.nickname)
  ) : null

  // --- SINGLE PLAYER STATE ---
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dealerTurn' | 'done'>('idle')
  const [message, setMessage] = useState('')

  // --- SINGLE PLAYER LOGIC ---
  const deal = useCallback(() => {
    if (bet > balance || isMulti) return
    sounds.bet()
    let d = createDeck()
    let pH = [d.pop()!, d.pop()!]
    let dH = [d.pop()!, { ...d.pop()!, hidden: true }]
    const winChance = applyLuck(0.12, luck)
    if (Math.random() < winChance) {
      const highCards = d.filter(c => ['10','J','Q','K','A'].includes(c.value))
      if (highCards.length >= 2) {
        pH = [highCards[0], highCards[1]]
        d = d.filter(c => c !== pH[0] && c !== pH[1])
        const lowCards = d.filter(c => ['4','5','6'].includes(c.value))
        if (lowCards.length >= 2) {
          dH = [lowCards[0], { ...lowCards[1], hidden: true }]
          d = d.filter(c => c !== dH[0] && c !== lowCards[1])
        }
      }
    }
    setDeck(d); setPlayerHand(pH); setDealerHand(dH)
    setGameState('playing'); setMessage('')
    sounds.cardDeal(); setTimeout(() => sounds.cardDeal(), 150)
    setTimeout(() => sounds.cardDeal(), 300); setTimeout(() => sounds.cardDeal(), 450)
    if (cardScore(pH) === 21) {
      dH[1].hidden = false; setDealerHand([...dH])
      sounds.cardFlip()
      if (cardScore(dH) === 21) {
        setMessage('Оба блэкджек — ничья!'); setGameState('done')
        onResult('push', bet, { player: pH, dealer: dH })
      } else {
        const payout = bet * 2.5
        setMessage(`Блэкджек! +${payout.toLocaleString()}`); setGameState('done')
        sounds.bigWin(); onResult('win', payout, { player: pH, dealer: dH })
      }
    }
  }, [bet, balance, luck, onResult, isMulti])

  const hit = useCallback(() => {
    if (gameState !== 'playing' || isMulti) return
    sounds.cardDeal()
    let d = [...deck]; let card = d.pop()!
    const saveChance = applyLuck(0, luck)
    if (Math.random() < saveChance) {
      const safeCards = d.filter(c => cardScore([...playerHand, c]) <= 21)
      if (safeCards.length > 0) {
        card = safeCards[Math.floor(Math.random() * safeCards.length)]
        d = d.filter(c => c !== card)
      }
    }
    const newHand = [...playerHand, card]
    setDeck(d); setPlayerHand(newHand)
    if (cardScore(newHand) > 21) {
      setMessage('Перебор! 💀'); setGameState('done')
      dealerHand[1].hidden = false; setDealerHand([...dealerHand])
      sounds.lose(); onResult('lose', 0, { player: newHand, dealer: dealerHand })
    }
  }, [gameState, deck, playerHand, dealerHand, luck, onResult, isMulti])

  const stand = useCallback(async (currentHand?: Card[]) => {
    if (gameState !== 'playing' || isMulti) return
    setGameState('dealerTurn')
    const finalPlayerHand = currentHand || playerHand
    let d = [...deck]; const dH = [...dealerHand]
    dH[1].hidden = false; sounds.cardFlip()
    while (cardScore(dH) < 17) {
      await new Promise(r => setTimeout(r, 600))
      sounds.cardDeal()
      let nextCard = d.pop()!
      const bustChance = applyLuck(0, luck)
      if (Math.random() < bustChance) {
        const bustCards = d.filter(c => cardScore([...dH, c]) > 21)
        if (bustCards.length > 0) {
          nextCard = bustCards[Math.floor(Math.random() * bustCards.length)]
          d = d.filter(c => c !== nextCard)
        }
      }
      dH.push(nextCard); setDealerHand([...dH]); setDeck([...d])
    }
    const pScore = cardScore(finalPlayerHand); const dScore = cardScore(dH)
    console.log('Result check:', { pScore, dScore, finalPlayerHand, dH })
    
    if (dScore > 21) {
      setMessage(`Дилер перебрал! +${(bet * 2).toLocaleString()}`); setGameState('done')
      sounds.win(); onResult('win', bet * 2, { player: finalPlayerHand, dealer: dH })
    } else if (pScore > dScore) {
      setMessage(`Вы выиграли! +${(bet * 2).toLocaleString()}`); setGameState('done')
      sounds.win(); onResult('win', bet * 2, { player: finalPlayerHand, dealer: dH })
    } else if (Math.floor(pScore) === Math.floor(dScore)) {
      setMessage('Ничья!'); setGameState('done')
      onResult('push', bet, { player: finalPlayerHand, dealer: dH })
    } else {
      setMessage('Дилер выиграл 😞'); setGameState('done')
      sounds.lose(); onResult('lose', 0, { player: finalPlayerHand, dealer: dH })
    }
  }, [gameState, deck, dealerHand, playerHand, bet, luck, onResult, isMulti])

  const doubleDown = useCallback(() => {
    if (gameState !== 'playing' || playerHand.length !== 2 || bet * 2 > balance || isMulti) return
    const d = [...deck]; const card = d.pop()!
    const newHand = [...playerHand, card]
    setDeck(d); setPlayerHand(newHand)
    if (cardScore(newHand) > 21) {
      setMessage('Перебор на дабле! 💀'); setGameState('done')
      dealerHand[1].hidden = false; setDealerHand([...dealerHand])
      onResult('lose', 0, { player: newHand, dealer: dealerHand, doubled: true })
    } else {
      stand(newHand)
    }
  }, [gameState, playerHand, deck, balance, bet, dealerHand, stand, onResult, isMulti])

  // --- MULTIPLAYER ROOM LOGIC ---
  useEffect(() => {
    if (!isMulti || !room || !profile) return
    
    // ДОСТУПНО ВСЕМ ИГРОКАМ: Логика завершения раунда и обновления баланса
    if (room.status === 'ended' && myPlayer && myPlayer.bet > 0 && !message) {
      const dScore = cardScore(room.dealer?.cards as any)
      const myCards = myPlayer.cards as any[]
      const pScore = cardScore(myCards)
      const myBet = myPlayer.bet
      
      let res: GameResult = 'lose'
      let payout = 0

      if (pScore > 21) {
        res = 'lose'; payout = 0; setMessage('Перебор! 💀')
      } else if (dScore > 21) {
        res = 'win'; payout = myBet * 2; setMessage('Дилер перебрал! 🎉')
      } else if (pScore > dScore) {
        res = 'win'; payout = myBet * 2; setMessage('Вы выиграли! 💸')
      } else if (pScore === dScore) {
        res = 'push'; payout = myBet; setMessage('Ничья! 🤝')
      } else {
        res = 'lose'; payout = 0; setMessage('Дилер выиграл 😞')
      }

      // ВАЖНО: Вызываем onResult один раз за раунд
      onResult(res, payout, { player: myCards, dealer: room.dealer?.cards, multi: true })
      
      setTimeout(() => setMessage(''), 4500)
    }

    // ТОЛЬКО ДЛЯ ХОСТА: Управление столом
    if (room.host !== profile.nickname) return
    
    const playersArr = Object.values(room.players || {})
    const activePlayers = playersArr.filter(p => (p as any).status !== 'ready')

    // 1. Старт игры, когда все поставили
    if (room.status === 'waiting' && activePlayers.length > 0 && playersArr.every(p => (p as any).status === 'betting')) {
      // Все игроки поставили, начинаем раздачу
      const d = createDeck()
      const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
      
      const updates: any = {
        status: 'playing',
        deck: d.map(c => `${c.value}${c.suit}`),
        dealer: {
          cards: [d.pop(), { ...d.pop(), hidden: true }],
        },
        turn: activePlayers[0].uid
      }

      // Раздаем по 2 карты каждому активному
      activePlayers.forEach(p => {
        updates[`players/${p.uid}/cards`] = [d.pop(), d.pop()]
        updates[`players/${p.uid}/status`] = 'acting'
      })

      update(roomRef, updates)
    }

    // 2. Переход хода или ход дилера
    if (room?.status === 'playing' && room?.turn) {
       const currentPlayer = room.players[room.turn]
       if (currentPlayer && (currentPlayer.status === 'stay' || currentPlayer.status === 'bust' || cardScore(currentPlayer.cards as any) >= 21)) {
          // Игрок закончил ход, ищем следующего
          const readyPlayers = playersArr.filter(p => (p as any).status === 'acting')
          const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
          
          if (readyPlayers.length > 0) {
            update(roomRef, { turn: (readyPlayers[0] as RoomPlayer).uid })
          } else {
            // Больше некому ходить -> Ход дилера
            update(roomRef, { status: 'dealerTurn', turn: null })
          }
       }
    }

    // 3. Логика дилера (dealerTurn)
    if (room?.status === 'dealerTurn') {
       // Дилер открывает карту и добирает до 17
       const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
       const dH = [...(room.dealer?.cards || [])] as any[]
       dH[1].hidden = false
       
       const runDealer = async () => {
         let currentDeck = room.deck ? room.deck.map(s => ({ value: s.slice(0, -1), suit: s.slice(-1) })) : createDeck()
         while (cardScore(dH) < 17) {
            dH.push(currentDeck.pop())
            await new Promise(r => setTimeout(r, 800))
         }
         update(roomRef, { 
           'dealer/cards': dH,
           status: 'ended'
         })
       }
       // Только хост (первый игрок) управляет дилером
       if (playersArr[0]?.uid === profile.uid) {
         runDealer()
       }
    }

    // 4. Сброс стола хостом
    if (room?.status === 'ended' && room.host === profile.nickname) {
       setTimeout(() => {
          if (!room?.id) return
          const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
          const resetUpdates: any = { status: 'waiting', turn: null, dealer: null }
          Object.values(room.players || {}).forEach((p: any) => {
            resetUpdates[`players/${p.uid}/cards`] = []
            resetUpdates[`players/${p.uid}/status`] = 'ready'
            resetUpdates[`players/${p.uid}/bet`] = 0
          })
          update(roomRef, resetUpdates)
       }, 5000)
    }

    // ... (стальные условия сброса стола)
  }, [isMulti, room, profile?.nickname])

  // MULTIPLAYER ACTIONS
  const handleJoinSeat = (seat: number) => {
    if (!profile) {
      toast.error('Сначала войдите в аккаунт')
      return
    }
    if (myPlayer) {
      toast.info('Вы уже заняли место за столом')
      return
    }
    if (isMulti && multiplayer) {
      multiplayer.joinRoom(seat)
    } else {
      toast.error('Ошибка инициализации мультиплеера')
    }
  }

  const handleMultiBet = () => {
    if (isMulti && bet <= balance) {
      multiplayer!.placeBet(bet)
      sounds.bet()
    }
  }

  const handleMultiHit = async () => {
    if (!isMulti || !myPlayer || room?.turn !== profile?.uid || !room?.id) return
    const currentCards = [...(myPlayer.cards || [])]
    const currentDeck = room.deck ? room.deck.map(s => ({ value: s.slice(0, -1), suit: s.slice(-1) })) : []
    const newCard = currentDeck.pop()
    
    if (!room?.id || !profile?.uid) return
    const playerRef = ref(rtdb, `rooms/blackjack/${room.id}/players/${profile.uid}`)
    const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
    
    await update(playerRef, { cards: [...currentCards, newCard] })
    await update(roomRef, { deck: currentDeck.map(c => `${c.value}${c.suit}`) })
    sounds.cardDeal()
  }

  const handleMultiStand = async () => {
    if (!isMulti || !myPlayer || room?.turn !== profile?.uid) return
    multiplayer!.updatePlayerStatus('stay')
  }

  const handleForceStart = async () => {
    if (!isMulti || !room || room.host !== profile?.nickname) return
    const playersArr = Object.values(room.players || {})
    const bettingPlayers = playersArr.filter(p => (p as any).status === 'betting')
    
    if (bettingPlayers.length === 0) {
      toast.error('Никто еще не сделал ставку!')
      return
    }

    const d = createDeck()
    const roomRef = ref(rtdb, `rooms/blackjack/${room.id}`)
    const updates: any = {
      status: 'playing',
      deck: d.map(c => `${c.value}${c.suit}`),
      dealer: {
        cards: [d.pop(), { ...d.pop(), hidden: true }],
      },
      turn: bettingPlayers[0].uid
    }

    bettingPlayers.forEach(p => {
      updates[`players/${p.uid}/cards`] = [d.pop(), d.pop()]
      updates[`players/${p.uid}/status`] = 'acting'
    })

    // Игроков без ставок можно либо оставить в ready, либо кикнуть. Оставим в ready.
    await update(roomRef, updates)
    toast.success('Игра началась!')
  }

  return (
    <div className="relative p-4 flex flex-col items-center h-[750px] bg-emerald-900/30 overflow-hidden rounded-3xl border-2 border-gold/10 shadow-inner">
      {/* Table Background Decoration */}
      <div className="absolute inset-8 border-[12px] border-emerald-950/40 rounded-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1000px] h-[550px] border-2 border-gold/5 rounded-[275px] pointer-events-none" />

      {!isMulti ? (
        // --- EXISTING SINGLE PLAYER RENDER ---
        <div className="flex-1 flex flex-col items-center justify-between w-full py-8">
           <div className="text-center">
             <p className="text-sm text-muted-foreground mb-2">Дилер {gameState === 'done' || gameState === 'dealerTurn' ? `(${cardScore(dealerHand)})` : ''}</p>
             <div className="flex gap-2 justify-center">{dealerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}</div>
           </div>

           <AnimatePresence>{message && (
             <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xl font-bold text-gold my-4 text-glow-gold">{message}</motion.p>
           )}</AnimatePresence>

           <div className="text-center">
             <div className="flex gap-2 justify-center mb-2">{playerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}</div>
             <p className="text-sm text-gold font-semibold">Вы ({cardScore(playerHand)})</p>
           </div>

           <div className="mt-8">
             {gameState === 'idle' ? (
               <Button onClick={deal} size="xl" disabled={bet > balance}>🃏 РАЗДАТЬ</Button>
             ) : gameState === 'playing' ? (
               <div className="flex gap-3">
                 <Button onClick={hit} variant="outline">Hit</Button>
                 <Button onClick={() => stand()}>Stand</Button>
                 {playerHand.length === 2 && <Button onClick={doubleDown} variant="outline" disabled={bet * 2 > balance}>Double</Button>}
               </div>
             ) : (
               <Button onClick={deal} size="lg">🃏 Раздать снова</Button>
             )}
           </div>
        </div>
      ) : room && (
        // --- MULTIPLAYER TABLE RENDER ---
        <div className="flex-1 w-full flex flex-col items-center justify-between py-6">
          {/* Dealer Area */}
          <div className="text-center">
            <div className="mb-2">
               <span className="text-[10px] text-gold/60 uppercase font-bold tracking-widest">Dealer</span>
               <div className="text-gold font-bold text-xl">{room.dealer ? cardScore(room.dealer.cards as any) : ''}</div>
            </div>
            <div className="flex gap-2 justify-center">
               {(room.dealer?.cards || [{suit:'♠', value:'?', hidden:true}]).map((c: any, i: number) => (
                 <CardView key={i} card={c} size="sm" />
               ))}
            </div>
          </div>

          <div className="text-center py-4">
            <AnimatePresence>
              {room.status === 'betting' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gold font-bold animate-pulse">Делайте ваши ставки...</motion.p>}
            </AnimatePresence>
          </div>

          {/* Player Seats (Semi-circle) */}
          <div className="relative w-full h-64 mt-auto">
             {[1,2,3,4,5,6].map(seatNum => {
                const players = Object.values(room.players || {})
                const player = players.find((p: any) => p.seat === seatNum)
                const isMe = player?.nickname === profile?.nickname
                
                // Сбалансированный полукруг
                const totalSeats = 6
                const angle = (seatNum - 1) * (140 / (totalSeats - 1)) + 20 // 20 to 160
                const radiusX = 380
                const radiusY = 160
                // Позиционируем игроков в нижней половине стола
                const x = Math.cos((angle * Math.PI) / 180) * radiusX
                const y = Math.sin((angle * Math.PI) / 180) * radiusY

                return (
                  <div key={seatNum} className="absolute left-1/2 top-14 -translate-x-1/2" 
                    style={{ transform: `translate(${-x}px, ${y}px)` }}>
                    <div className="flex flex-col items-center gap-2">
                       {player ? (
                         <div className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all min-w-[100px] ${isMe ? 'border-gold bg-gold/5 shadow-glow-gold' : 'border-gold/20 bg-marble/10'}`}>
                            <div className="flex gap-1 mb-2">
                               {(player.cards || []).map((c: any, i: number) => <CardView key={i} card={c} size="sm" />)}
                            </div>
                            <div className="flex items-center gap-2">
                               <img src={player.avatarUrl} className="w-6 h-6 rounded-full border border-gold/30" />
                               <span className="text-[10px] font-bold text-foreground truncate max-w-[60px]">{player.nickname}</span>
                            </div>
                            <span className="text-[10px] text-gold-light font-mono mt-1">{formatBalance(player.bet || 0)}</span>
                            {room.turn === player.uid && room.status === 'playing' && <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-gold rounded-full animate-ping" />}
                         </div>
                       ) : (
                         <Button variant="ghost" className="w-16 h-16 rounded-full border-2 border-dashed border-gold/10 hover:border-gold/30 hover:bg-gold/5 flex flex-col items-center justify-center p-0 group"
                            onClick={() => handleJoinSeat(seatNum)}>
                            <Plus className="w-4 h-4 text-gold/20 group-hover:text-gold/60 transition-colors" />
                            <span className="text-[8px] text-gold/20 group-hover:text-gold/60 uppercase">Занять</span>
                         </Button>
                       )}
                    </div>
                  </div>
                )
             })}
          </div>

          {/* Centered Action Controls - Inside the Table */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 z-50">
            {myPlayer && (
              <div className="flex gap-4 px-8 py-4 bg-black/60 backdrop-blur-xl rounded-full border border-gold/30 shadow-[0_0_50px_rgba(0,0,0,0.7)] transform scale-110">
                 {room.status === 'waiting' && myPlayer.status === 'ready' && (
                   <Button onClick={handleMultiBet} className="bg-gold hover:bg-gold-light text-velvet-dark font-black px-10 py-6 text-lg shadow-glow-gold rounded-full transition-all active:scale-95">
                      СТАВКА {formatBalance(bet)}
                   </Button>
                 )}
                 {room.status === 'waiting' && room.host === profile?.nickname && (
                   <Button onClick={handleForceStart} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-6 text-lg border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all rounded-full">
                      🚀 СТАРТ
                   </Button>
                 )}
                 {room.turn === profile?.uid && room.status === 'playing' && (
                   <div className="flex gap-4">
                      <Button onClick={handleMultiHit} variant="outline" className="border-gold text-gold hover:bg-gold/10 px-10 py-6 text-lg font-bold rounded-full">Ещё (Hit)</Button>
                      <Button onClick={handleMultiStand} className="bg-gold text-velvet-dark font-black px-10 py-6 text-lg rounded-full shadow-glow-gold">Хватит (Stand)</Button>
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>

      )}
    </div>
  )
}

