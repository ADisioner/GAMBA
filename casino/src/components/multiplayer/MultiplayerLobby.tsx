import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ref, onValue, push, set, remove } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Plus, Play, Sword } from 'lucide-react'
import type { MultiplayerRoom, GameType } from '@/types'
import { toast } from 'sonner'

export function MultiplayerLobby() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<MultiplayerRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [minBetInput, setMinBetInput] = useState('100')
  const [selectedGameType, setSelectedGameType] = useState<GameType>('blackjack')

  useEffect(() => {
    const roomsRef = ref(rtdb, 'rooms')
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const roomsMap: Record<string, MultiplayerRoom> = {}

        Object.keys(data).forEach(key => {
          const item = data[key]
          if (!item || typeof item !== 'object') return

          if ('host' in item && 'status' in item) {
            processRoom(key, item)
          } else {
            Object.keys(item).forEach(roomId => {
              const roomData = item[roomId]
              if (roomData && typeof roomData === 'object' && 'host' in roomData) {
                processRoom(roomId, roomData, key)
              }
            })
          }
        })

        function processRoom(roomId: string, roomData: any, gType?: string) {
          const gameType = gType || roomData.gameType || 'blackjack'
          const playersCount = Object.keys(roomData.players || {}).length
          const isOld = (Date.now() - (roomData.updatedAt || roomData.createdAt)) > 120000

          if (playersCount === 0 && isOld) {
            remove(ref(rtdb, gType ? `rooms/${gType}/${roomId}` : `rooms/${roomId}`))
            return
          }

          roomsMap[roomId] = { id: roomId, ...roomData, gameType }
        }
        setRooms(Object.values(roomsMap))
      } else {
        setRooms([])
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleCreateClick = () => {
    setIsPromptOpen(true)
  }

  const confirmCreate = async () => {
    const gameType = selectedGameType
    const amt = parseInt(minBetInput)
    if (isNaN(amt) || amt < 1) {
      toast.error('Введите корректную ставку')
      return
    }
    if (!profile) return

    try {
      const roomRef = push(ref(rtdb, `rooms/${gameType}`))
      const roomId = roomRef.key
      
      const newRoom: Partial<MultiplayerRoom> = {
        id: roomId!,
        gameType,
        status: 'waiting',
        host: profile.nickname,
        players: {},
        minBet: amt,
        maxPlayers: 6,
        createdAt: Date.now()
      }
      
      await set(roomRef, newRoom)
      toast.success('Комната создана!')
      setIsPromptOpen(false)
      navigate(`/game/${gameType}?room=${roomId}`)
    } catch (e) {
      toast.error('Ошибка при создании комнаты')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl font-bold flex items-center gap-2">
          <Sword className="w-6 h-6 text-gold" /> Активные столы
        </h3>
        <div className="flex gap-2">
          {isPromptOpen ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 items-center bg-marble/20 p-1.5 rounded-lg border border-gold/20">
              <select 
                value={selectedGameType}
                onChange={e => setSelectedGameType(e.target.value as GameType)}
                className="bg-velvet border border-gold/30 text-[10px] font-bold text-gold rounded px-2 h-8 outline-none"
              >

                <option value="blackjack">BLACKJACK</option>
                <option value="roulette">ROULETTE</option>
                <option value="crash">CRASH</option>
              </select>

              <div className="flex items-center gap-1 px-2 border-l border-gold/20">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Мин:</span>
                <input 
                  type="number" 
                  value={minBetInput}
                  onChange={e => setMinBetInput(e.target.value)}
                  className="w-16 h-8 bg-transparent border-none text-xs font-bold text-gold focus:ring-0 appearance-none"
                />
              </div>

              <Button size="sm" className="h-8 bg-gold hover:bg-gold-light text-velvet-dark font-bold px-4" onClick={confirmCreate}>СОЗДАТЬ</Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setIsPromptOpen(false)}>×</Button>
            </motion.div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleCreateClick} className="bg-gold/5 border-gold/20 text-gold hover:bg-gold hover:text-velvet-dark">
              <Plus className="w-4 h-4 mr-1" /> Создать комнату
            </Button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {loading ? (
           <div className="col-span-full py-20 text-center text-muted-foreground">Загрузка комнат...</div>
        ) : rooms.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gold/10 rounded-xl">
             <Users className="w-12 h-12 text-gold/20 mx-auto mb-3" />
             <p className="text-muted-foreground">Пока нет активных столов. Создай свой!</p>
          </div>
        ) : rooms.map(room => (
          <Card key={room.id} className="p-4 bg-marble-light/30 border-gold/20 hover:border-gold/40 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold font-bold">{room.gameType}</span>
                <h4 className="font-serif font-bold text-lg">Стол #{room.id.slice(-4)}</h4>
                <p className="text-xs text-muted-foreground">Хост: {room.host}</p>
              </div>
              <div className="flex items-center gap-1 bg-gold/10 px-2 py-1 rounded text-gold text-xs font-bold">
                <Users className="w-3 h-3" />
                {Object.keys(room.players || {}).length}/{room.maxPlayers}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Мин. ставка: {room.minBet}</span>
              <Button size="sm" className="bg-gold hover:bg-gold-light text-velvet-dark font-bold"
                onClick={() => navigate(`/game/${room.gameType}?room=${room.id}`)}>
                Войти <Play className="w-3 h-3 ml-1 fill-current" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
