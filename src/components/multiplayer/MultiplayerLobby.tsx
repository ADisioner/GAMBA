import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

  useEffect(() => {
    const roomsRef = ref(rtdb, 'rooms')
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const allRooms: MultiplayerRoom[] = []
        
        Object.keys(data).forEach(gameType => {
          Object.keys(data[gameType]).forEach(roomId => {
            const roomData = data[gameType][roomId]
            const playersCount = Object.keys(roomData.players || {}).length
            const isOld = (Date.now() - (roomData.updatedAt || roomData.createdAt)) > 60000

            // Удаляем пустые комнаты более 1 минуты
            if (playersCount === 0 && isOld) {
               remove(ref(rtdb, `rooms/${gameType}/${roomId}`))
               return
            }

            allRooms.push({ id: roomId, ...roomData })
          })
        })
        setRooms(allRooms)
      } else {
        setRooms([])
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const createRoom = async (gameType: GameType) => {
    if (!profile) return
    try {
      const roomRef = push(ref(rtdb, `rooms/${gameType}`))
      const roomId = roomRef.key
      
      const newRoom: Partial<MultiplayerRoom> = {
        gameType,
        status: 'waiting',
        host: profile.nickname,
        players: {},
        minBet: 100,
        maxPlayers: 6,
        createdAt: Date.now()
      }
      
      await set(roomRef, newRoom)
      toast.success('Комната создана!')
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
          <Button variant="outline" size="sm" onClick={() => createRoom('blackjack')}>
            <Plus className="w-4 h-4 mr-1" /> Блэкджек
          </Button>
          <Button variant="outline" size="sm" onClick={() => createRoom('poker')}>
            <Plus className="w-4 h-4 mr-1" /> Покер
          </Button>
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
