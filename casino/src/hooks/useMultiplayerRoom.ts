import { useState, useEffect } from 'react'
import { ref, onValue, set, update, push, onDisconnect, remove } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import type { MultiplayerRoom, RoomPlayer, GameType, PlayerStatus } from '@/types'

export function useMultiplayerRoom(gameType: GameType, roomId: string | null) {
  const { profile } = useAuth()
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [averageLuck, setAverageLuck] = useState<number>(1.0)

  useEffect(() => {
    if (!roomId || !profile) {
      setRoom(null)
      setLoading(false)
      return
    }

    const roomRef = ref(rtdb, `rooms/${gameType}/${roomId}`)
    
    // Подписка на изменения комнаты
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as MultiplayerRoom
        setRoom(data)
        
        // Считаем среднюю удачу
        const players = Object.values(data.players || {})
        if (players.length > 0) {
          const sum = players.reduce((acc, p) => acc + (p.luck || 1.0), 0)
          setAverageLuck(sum / players.length)
        } else {
          setAverageLuck(1.0)
        }
        
        setError(null)
      } else {
        setRoom(null)
        setAverageLuck(1.0)
        setError('Комната не найдена')
      }
      setLoading(false)
    }, (err) => {
      console.error('Room sync error:', err)
      setError(err.message)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [gameType, roomId, profile])

  const joinRoom = async (seat: number) => {
    if (!roomId || !profile || !profile.uid) return
    try {
      const playerRef = ref(rtdb, `rooms/${gameType}/${roomId}/players/${profile.uid}`)
      
      const playerData: RoomPlayer = {
        uid: profile.uid,
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        seat,
        bet: 0,
        cards: [],
        status: 'ready',
        lastSeen: Date.now(),
        luck: profile.luck // <--- Сохраняем удачу
      }

      await set(playerRef, playerData)
      onDisconnect(playerRef).remove()
      toast.success(`Вы заняли место №${seat}`)
    } catch (err: any) {
      console.error('Join room error:', err)
      toast.error('Не удалось занять место: ' + err.message)
    }
  }

  const leaveRoom = async () => {
    if (!roomId || !profile || !profile.uid) return
    const roomRef = ref(rtdb, `rooms/${gameType}/${roomId}`)
    const playerRef = ref(rtdb, `rooms/${gameType}/${roomId}/players/${profile.uid}`)
    
    // Если мы последний игрок в комнате - удаляем её целиком
    const playersCount = room?.players ? Object.keys(room.players).length : 0
    if (playersCount <= 1) {
      await remove(roomRef)
    } else {
      await remove(playerRef)
    }
  }

  const updatePlayerStatus = async (status: PlayerStatus) => {
    if (!roomId || !profile || !profile.uid) return
    const playerRef = ref(rtdb, `rooms/${gameType}/${roomId}/players/${profile.uid}`)
    await update(playerRef, { status, lastSeen: Date.now() })
  }

  const placeBet = async (bet: number) => {
    if (!roomId || !profile || !profile.uid) return
    const playerRef = ref(rtdb, `rooms/${gameType}/${roomId}/players/${profile.uid}`)
    await update(playerRef, { bet, status: 'betting', lastSeen: Date.now() })
  }

  return {
    room,
    loading,
    error,
    averageLuck, // <--- Возвращаем среднюю удачу
    joinRoom,
    leaveRoom,
    updatePlayerStatus,
    placeBet
  }
}
