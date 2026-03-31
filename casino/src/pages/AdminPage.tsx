import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Users, Coins, Clover, Megaphone, History, Settings, Download, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import type { UserProfile, GameRecord, GameType } from '@/types'
import { collection, getDocs, doc, updateDoc, query, orderBy, limit, deleteDoc, getDoc, setDoc, where, writeBatch } from 'firebase/firestore'
import { ref, push, onValue, remove } from 'firebase/database'
import { db, rtdb, auth } from '@/lib/firebase'
import { toast } from 'sonner'

type Tab = 'users' | 'history' | 'settings' | 'broadcast' | 'rooms'

export function AdminPage() {
  const { profile, settings, refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [games, setGames] = useState<GameRecord[]>([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [isClearing, setIsClearing] = useState(false)
  const [globalStats, setGlobalStats] = useState({ totalBets: 0, totalPayouts: 0, totalGames: 0, bankProfit: 0 })
  const [sessionBankProfit, setSessionBankProfit] = useState(0)
  const [activeRooms, setActiveRooms] = useState<any[]>([])

  const [isDeploying, setIsDeploying] = useState(false)
  useEffect(() => { 
    loadUsers()
    loadGlobalStats()
    
    const roomTypes = ['blackjack', 'roulette', 'crash']
    const subscribers = roomTypes.map(type => 
      onValue(ref(rtdb, `rooms/${type}`), (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const list = Object.entries(data).map(([id, val]: any) => ({ 
            id, 
            gameType: type,
            ...val, 
            playersCount: Object.keys(val.players || {}).length 
          }))
          setActiveRooms(prev => {
            const others = prev.filter(p => p.gameType !== type)
            return [...others, ...list]
          })
        } else {
          setActiveRooms(prev => prev.filter(p => p.gameType !== type))
        }
      })
    )

    return () => subscribers.forEach(unsub => unsub())
  }, []) // eslint-disable-line

  async function loadGlobalStats() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global_stats'))
      if (snap.exists()) setGlobalStats({ ...globalStats, ...snap.data() } as any)
      
      // Дополнительно считаем профит банка из транзакций (как просил юзер)
      const bankSnap = await getDocs(query(collection(db, 'bank_transactions'), where('commission', '>', 0)))
      const total = bankSnap.docs.reduce((acc, d) => acc + (d.data().commission || 0), 0)
      setSessionBankProfit(total)
    } catch (e) {
      console.error('Stats load error:', e)
    }
  }

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map(d => d.data() as UserProfile).sort((a, b) => b.balance - a.balance))
    } catch {}
  }

  async function loadHistory() {
    try {
      const snap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(100)))
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as GameRecord)))
    } catch {}
  }

  async function updateBalance(nickname: string, newBalance: number) {
    await updateDoc(doc(db, 'users', nickname), { balance: Math.max(0, newBalance), updatedAt: Date.now() })
    toast.success(`Баланс ${nickname} обновлён`)
    loadUsers()
  }

  async function updateLuck(nickname: string, newLuck: number) {
    try {
      if (isNaN(newLuck)) throw new Error('Некорректное число')
      const clamped = Math.max(-10, newLuck)
      await updateDoc(doc(db, 'users', nickname), { luck: clamped, updatedAt: Date.now() })
      toast.success(`Luck ${nickname} = ${clamped.toFixed(2)}`)
      loadUsers()
    } catch (e: any) {
      toast.error(`Ошибка обновления удачи: ${e.message}`)
    }
  }

  async function resetAllBalances() {
    const starting = settings?.startingBalance || 10000
    for (const u of users) {
      await updateDoc(doc(db, 'users', u.nickname), { balance: starting, updatedAt: Date.now() })
    }
    toast.success('Балансы сброшены')
    loadUsers()
  }

  async function resetAllTimers() {
    for (const u of users) {
      await updateDoc(doc(db, 'users', u.nickname), { lastDailyBonus: null, updatedAt: Date.now() })
    }
    toast.success('Таймеры сброшены — все могут забрать бонус')
    loadUsers()
  }

  async function resetTimer(nickname: string) {
    await updateDoc(doc(db, 'users', nickname), { lastDailyBonus: null, updatedAt: Date.now() })
    toast.success(`Таймер ${nickname} сброшен`)
    loadUsers()
  }

  async function forceCloseRoom(roomId: string, gameType: string) {
    try {
      if (!confirm(`Вы уверены, что хотите принудительно закрыть стол ${roomId} (${gameType})?`)) return
      await remove(ref(rtdb, `rooms/${gameType}/${roomId}`))
      toast.success(`Стол ${roomId} (${gameType}) принудительно закрыт`)
    } catch (e) {
      toast.error('Ошибка при закрытии стола')
    }
  }

  async function toggleNoCooldown(nickname: string, current: boolean) {
    await updateDoc(doc(db, 'users', nickname), { noBonusCooldown: !current, updatedAt: Date.now() })
    toast.success(current ? `Кулдаун включён для ${nickname}` : `Без КД включено для ${nickname}`)
    loadUsers()
  }

  async function resetUserStats(nickname: string) {
    if (!window.confirm(`Сбросить ВСЮ статистику игрока ${nickname}? (Баланс, игры, удача)`)) return
    const starting = settings?.startingBalance || 10000
    await updateDoc(doc(db, 'users', nickname), {
      balance: starting,
      totalGamesPlayed: 0,
      totalWon: 0,
      totalLost: 0,
      luck: 0,
      lastDailyBonus: null,
      updatedAt: Date.now()
    })
    toast.success(`Статистика ${nickname} сброшена`)
    loadUsers()
  }

  async function toggleBan(nickname: string, currentStatus: boolean) {
    await updateDoc(doc(db, 'users', nickname), { isBanned: !currentStatus, updatedAt: Date.now() })
    toast.success(currentStatus ? `Пользователь ${nickname} разблокирован` : `Пользователь ${nickname} ЗАБЛОКИРОВАН`)
    loadUsers()
  }

  async function deleteUser(nickname: string) {
    if (!window.confirm(`ВЫ УВЕРЕНЫ? Это удалит аккаунт ${nickname} навсегда!`)) return
    await deleteDoc(doc(db, 'users', nickname))
    toast.success(`Пользователь ${nickname} удалён`)
    loadUsers()
  }

  async function regenUid(nickname: string) {
    const newUid = 'gamba_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36)
    await updateDoc(doc(db, 'users', nickname), { uid: newUid, updatedAt: Date.now() })
    toast.success(`UID для ${nickname} сгенерирован`)
    loadUsers()
  }

  async function updateBankSetting(field: string, val: string | number) {
    if (!settings) return
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val
    if (isNaN(num)) return
    try {
      await updateDoc(doc(db, 'settings', 'global'), { [field]: num })
      toast.success('Настройка обновлена')
    } catch { toast.error('Ошибка сохранения') }
  }

  async function toggleGame(type: GameType, enabled: boolean) {
    if (!settings) return
    try {
      const config = settings.gamesConfig || {}
      const gameConfig = config[type] || { enabled: true, order: 0, name: type, description: '' }
      
      const newConfig = {
        ...config,
        [type]: { ...gameConfig, enabled }
      }

      await updateDoc(doc(db, 'settings', 'global'), { gamesConfig: newConfig })
      toast.success(`${enabled ? 'Включено' : 'Выключено'}: ${type}`)
    } catch (e) {
      console.error(e)
      toast.error('Ошибка обновления игры')
    }
  }

  async function resetAllStats() {
    if (!confirm('ВНИМАНИЕ! Это действие сбросит ВЕСЬ оборот казино и статистику ВСЕХ игроков! Вы уверены?')) return
    
    try {
      // 1. Сброс глобальной статистики
      await setDoc(doc(db, 'settings', 'global_stats'), {
        totalBets: 0,
        totalPayouts: 0,
        totalGames: 0,
        updatedAt: Date.now()
      })

      // 2. Сброс статистики всех пользователей (с учетом лимита батча 500)
      const snap = await getDocs(collection(db, 'users'))
      console.log(`Resetting stats for ${snap.docs.length} users...`)
      
      let batch = writeBatch(db)
      let count = 0
      
      for (const u of snap.docs) {
        batch.update(u.ref, {
          totalWon: 0,
          totalLost: 0,
          totalGamesPlayed: 0,
          luck: 0.0,
          bankDebt: 0, 
          updatedAt: Date.now()
        })
        count++
        
        if (count >= 490) {
          await batch.commit()
          batch = writeBatch(db)
          count = 0
        }
      }
      
      if (count > 0) {
        await batch.commit()
      }

      // 3. Полная очистка игровых логов (цикл по 500 до победного)
      let gamesRemaining = true
      while (gamesRemaining) {
        const gamesSnap = await getDocs(query(collection(db, 'games'), limit(500)))
        if (gamesSnap.empty) {
          gamesRemaining = false
        } else {
          const gamesBatch = writeBatch(db)
          gamesSnap.docs.forEach(d => gamesBatch.delete(d.ref))
          await gamesBatch.commit()
        }
      }

      // 4. Полная очистка банковских транзакций (цикл по 500)
      let txRemaining = true
      while (txRemaining) {
        const txSnap = await getDocs(query(collection(db, 'bank_transactions'), limit(500)))
        if (txSnap.empty) {
          txRemaining = false
        } else {
          const txBatch = writeBatch(db)
          txSnap.docs.forEach(d => txBatch.delete(d.ref))
          await txBatch.commit()
        }
      }
      
      setGlobalStats(prev => ({ ...prev, totalBets: 0, totalPayouts: 0, totalGames: 0 }))
      setSessionBankProfit(0)
      
      toast.success('Вся статистика успешно сброшена')
      loadUsers()
    } catch (e) {
      console.error(e)
      toast.error('Ошибка при сбросе статистики')
    }
  }

  async function clearGlobalHistory() {
    const ok = window.confirm('ВНИМАНИЕ! Это УДАЛИТ ВСЕ записи игр из базы данных навсегда. Вы уверены?')
    if (!ok) return
    
    setIsClearing(true)
    try {
      const snap = await getDocs(collection(db, 'games'))
      if (snap.empty) {
        toast.info('История и так пуста')
        setIsClearing(false)
        return
      }

      console.log(`Удаление ${snap.size} записей...`)
      const promises = snap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(promises)
      
      await setDoc(doc(db, 'settings', 'global_stats'), {
        totalBets: 0,
        totalPayouts: 0,
        totalGames: 0,
        updatedAt: Date.now(),
      })
      
      setGames([])
      setGlobalStats({ totalBets: 0, totalPayouts: 0, totalGames: 0, bankProfit: 0 })
      setSessionBankProfit(0)
      toast.success('Глобальная история и статистика полностью очищены')
    } catch (e: any) {
      console.error('Ошибка при очистке истории:', e)
      toast.error(`Ошибка: ${e.message || 'Недостаточно прав'}`)
    } finally {
      setIsClearing(false)
    }
  }

  async function sendBroadcast() {
    if (!broadcastMsg.trim() || !profile) return
    await push(ref(rtdb, 'chat'), {
      userId: profile.nickname, nickname: 'ADMIN', avatarUrl: profile.avatarUrl,
      text: broadcastMsg, type: 'broadcast', createdAt: Date.now(),
    })
    setBroadcastMsg('')
    toast.success('Broadcast отправлен')
  }

  function exportCSV() {
    const rows = [['User', 'Game', 'Bet', 'Result', 'Payout', 'Luck', 'Date'].join(',')]
    for (const g of games) {
      rows.push([g.userId, g.gameType, g.bet, g.result, g.payout, g.luckAtTime, new Date(g.createdAt).toISOString()].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'gamba_stats.csv'; a.click()
  }

  async function runDeploy() {
    if (!window.confirm('Вы уверены, что хотите обновить проект из GitHub? Это перезапустит сервер.')) return
    setIsDeploying(true)
    const t = toast.loading('Начало обновления...')
    try {
      // Получаем свежий токен Firebase для авторизации на бэкенде
      const idToken = await auth.currentUser?.getIdToken(true)
      if (!idToken) throw new Error('Не удалось получить токен авторизации')

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/deploy`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Проект успешно обновлен!', { id: t })
      } else {
        toast.error(`Ошибка обновления: ${data.details || data.error}`, { id: t })
      }
    } catch (e: any) {
      toast.error(e.message || 'Не удалось соединиться с сервером обновлений', { id: t })
    } finally {
      setIsDeploying(false)
    }
  }

  const tabs = [
    { id: 'users' as Tab, icon: Users, label: 'Игроки' },
    { id: 'history' as Tab, icon: History, label: 'История' },
    { id: 'broadcast' as Tab, icon: Megaphone, label: 'Broadcast' },
    { id: 'rooms' as Tab, icon: Clover, label: 'Мультиплеер' },
    { id: 'settings' as Tab, icon: Settings, label: 'Настройки' },
  ]

  const totalBets = games.reduce((acc, g) => acc + g.bet, 0)
  const totalPayouts = games.reduce((acc, g) => acc + g.payout, 0)
  const casinoProfit = totalBets - totalPayouts

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-neon-red" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Админ-панель (UPDATED)</h1>
          <div className="flex-1" />
          <Button 
            variant="outline" 
            size="sm" 
            className="border-gold/30 hover:bg-gold/10 text-gold"
            onClick={runDeploy}
            disabled={isDeploying}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isDeploying ? 'animate-spin' : ''}`} />
            {isDeploying ? 'Обновляется...' : 'Обновить из GitHub'}
          </Button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} size="sm"
              onClick={() => { setTab(t.id); if (t.id === 'history') loadHistory(); }}>
              <t.icon className="w-4 h-4" /> {t.label}
            </Button>
          ))}
        </div>

        {tab === 'users' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Игроки ({users.length})</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetAllTimers}>⏰ Сброс таймеров</Button>
                  <Button variant="destructive" size="sm" onClick={resetAllBalances}>Сброс балансов</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold/20 text-muted-foreground">
                      <th className="text-left py-2 px-3">Ник</th>
                      <th className="text-left py-2 px-3">UID (Internal)</th>
                      <th className="text-right py-2 px-3">🪙 Фишки</th>
                      <th className="text-right py-2 px-3">Luck</th>
                      <th className="text-right py-2 px-3">Игры</th>
                      <th className="text-right py-2 px-3">Выиграно</th>
                      <th className="text-center py-2 px-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <UserRow 
                        key={u.nickname} 
                        user={u} 
                        onBalance={updateBalance} 
                        onLuck={updateLuck} 
                        onResetTimer={resetTimer} 
                        onToggleCooldown={toggleNoCooldown} 
                        onResetStats={resetUserStats}
                        onToggleBan={toggleBan}
                        onDelete={deleteUser}
                        onRegenUid={regenUid}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'history' && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div>
                    <CardTitle>История игр (последние 100)</CardTitle>
                    <div className="mt-2 flex gap-4 text-xs font-medium">
                      <span className="text-muted-foreground">Ставки: <span className="text-foreground">{formatBalance(totalBets)}</span></span>
                      <span className="text-muted-foreground">Выплаты: <span className="text-gold">{formatBalance(totalPayouts)}</span></span>
                      <span className="text-muted-foreground">Профит: <span className={casinoProfit >= 0 ? "text-neon-green" : "text-neon-red"}>{casinoProfit > 0 && '+'}{formatBalance(casinoProfit)}</span></span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-gold/5 border border-gold/10 backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-widest text-gold font-bold mb-3 opacity-70">Глобальная статистика (всё время)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Всего ставок</p>
                        <p className="text-lg font-bold">{formatBalance(globalStats.totalBets)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Всего выплат</p>
                        <p className="text-lg font-bold text-gold">{formatBalance(globalStats.totalPayouts)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Чистый профит</p>
                        <p className={`text-lg font-bold ${globalStats.totalBets - globalStats.totalPayouts >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                          {globalStats.totalBets - globalStats.totalPayouts > 0 && '+'}{formatBalance(globalStats.totalBets - globalStats.totalPayouts)}
                        </p>
                      </div>
                      <div className="border-l border-gold/10 pl-4">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">🏦 Профит Банка</p>
                        <p className="text-lg font-bold text-violet-400">
                          {formatBalance(sessionBankProfit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Игр сыграно</p>
                        <p className="text-lg font-bold">{globalStats.totalGames}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCSV} disabled={isClearing}><Download className="w-4 h-4" /> CSV</Button>
                  <Button variant="destructive" size="sm" onClick={clearGlobalHistory} disabled={isClearing}>
                    {isClearing ? '⏳ Удаление...' : '🔥 Сброс всё'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-lg border border-gold/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-gold/20 text-muted-foreground bg-marble-light/90 backdrop-blur-md">
                      <th className="text-left py-3 px-3">Игрок</th>
                      <th className="text-left py-3 px-3">Игра</th>
                      <th className="text-right py-3 px-3">Ставка</th>
                      <th className="text-center py-3 px-3">Результат</th>
                      <th className="text-right py-3 px-3">Выплата</th>
                      <th className="text-right py-3 px-3">Luck</th>
                      <th className="text-right py-3 px-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map(g => (
                      <tr key={g.id} className="border-b border-gold/5 hover:bg-gold/5 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{g.userId}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold tracking-wider opacity-60">{g.gameType}</td>
                        <td className="py-2.5 px-3 text-right">{formatBalance(g.bet)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            g.result === 'win' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 
                            g.result === 'lose' ? 'bg-neon-red/10 text-neon-red border border-neon-red/20' : 
                            'bg-gold/10 text-gold border border-gold/20'
                          }`}>
                            {g.result === 'win' ? 'W' : g.result === 'lose' ? 'L' : 'P'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gold font-semibold">{formatBalance(g.payout)}</td>
                        <td className="py-2.5 px-3 text-right opacity-60">{g.luckAtTime.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground text-[10px]">{new Date(g.createdAt).toLocaleString('ru')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'broadcast' && (
          <Card>
            <CardHeader><CardTitle>Broadcast сообщение</CardTitle><p className="text-xs text-muted-foreground">Сообщение увидят все игроки в онлайн-чате</p></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Текст сообщения..." className="bg-marble/30" />
                <Button onClick={sendBroadcast} className="bg-gold hover:bg-gold-dark text-primary-foreground">Отправить</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'rooms' && (
          <Card>
            <CardHeader>
              <CardTitle>Активные комнаты (Multiplayer)</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeRooms.map(room => (
                    <div key={room.id} className="p-4 rounded-xl border border-gold/20 bg-emerald-950/20 backdrop-blur-sm">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <h4 className="font-bold text-gold-light">Стол: {room.id}</h4>
                             <p className="text-[10px] text-gold font-bold uppercase opacity-60">{room.gameType}</p>
                             <p className="text-xs text-muted-foreground">Хост: {room.host}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${room.status === 'playing' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                             {room.status === 'playing' ? 'Игра идет' : 'Ожидание'}
                          </span>
                       </div>
                       
                       <div className="space-y-2 mb-6">
                          <div className="flex justify-between text-xs">
                             <span className="text-muted-foreground">Игроков:</span>
                             <span className="font-bold">{room.playersCount} / 6</span>
                          </div>
                          <div className="flex justify-between text-xs">
                             <span className="text-muted-foreground">Мин. ставка:</span>
                             <span className="font-bold text-gold">{formatBalance(room.minBet || 100)}</span>
                          </div>
                       </div>

                       <Button variant="destructive" size="sm" className="w-full text-xs" onClick={() => forceCloseRoom(room.id, room.gameType)}>
                          ❌ ПРИНУДИТЕЛЬНО ЗАКРЫТЬ
                       </Button>
                    </div>
                  ))}
                  {activeRooms.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground opacity-50">
                       Нет активных столов
                    </div>
                  )}
               </div>
            </CardContent>
          </Card>
        )}

        {tab === 'settings' && (
          <Card>
            <CardHeader><CardTitle>Настройки сервера</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-marble/20 border border-gold/10">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Стартовые фишки</p>
                  <p className="text-2xl font-serif text-gold">{formatBalance(settings?.startingBalance || 0)}</p>
                </div>
                <div className="p-4 rounded-xl bg-marble/20 border border-gold/10">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Дневной бонус</p>
                  <p className="text-2xl font-serif text-gold">{formatBalance(settings?.dailyBonus || 0)}</p>
                </div>
                <div className="p-4 rounded-xl bg-marble/20 border border-gold/10">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">House Edge</p>
                  <p className="text-2xl font-serif text-neon-red">{((settings?.houseEdge || 0.03) * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-serif font-bold text-gold flex items-center gap-2">
                   🎮 Игровой зал (Вкл/Выкл)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {(['slots', 'roulette', 'blackjack', 'crash', 'mines', 'poker'] as GameType[]).map(gt => {
                    const isEnabled = settings?.gamesConfig?.[gt]?.enabled !== false;
                    return (
                      <div key={gt} className={`p-3 rounded-xl border transition-all ${isEnabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/5 border-red-500/10 opacity-60'}`}>
                        <div className="flex flex-col gap-2 items-center text-center">
                          <span className="text-[10px] uppercase font-bold tracking-wider">{gt}</span>
                          <Button 
                            variant={isEnabled ? 'default' : 'outline'} 
                            size="sm" 
                            className={`h-7 w-full text-[10px] ${isEnabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-950/40 text-red-500 border-red-500/30'}`}
                            onClick={() => toggleGame(gt, !isEnabled)}
                          >
                            {isEnabled ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-serif font-bold text-gold flex items-center gap-2">
                   🏦 Настройки GAMBA Bank
                </h3>
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Бонус Депозита (%)</label>
                    <div className="flex gap-2">
                      <Input defaultValue={settings?.bankDepositBonus || 10} type="number" className="bg-marble/30 h-8" id="in_dep_bonus" />
                      <Button size="sm" className="h-8" onClick={() => updateBankSetting('bankDepositBonus', (document.getElementById('in_dep_bonus') as HTMLInputElement).value)}>OK</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Комиссия P2P (%)</label>
                    <div className="flex gap-2">
                      <Input defaultValue={settings?.bankTransferCommission || 20} type="number" className="bg-marble/30 h-8" id="in_trans_comm" />
                      <Button size="sm" className="h-8" onClick={() => updateBankSetting('bankTransferCommission', (document.getElementById('in_trans_comm') as HTMLInputElement).value)}>OK</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Ставка Кредита (%)</label>
                    <div className="flex gap-2">
                      <Input defaultValue={settings?.bankCreditRate || 80} type="number" className="bg-marble/30 h-8" id="in_cred_rate" />
                      <Button size="sm" className="h-8" onClick={() => updateBankSetting('bankCreditRate', (document.getElementById('in_cred_rate') as HTMLInputElement).value)}>OK</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-neon-red/20 space-y-4">
                <h3 className="text-lg font-serif font-bold text-neon-red flex items-center gap-2">
                   ⚠️ Опасная зона
                </h3>
                <div className="p-6 rounded-2xl bg-neon-red/5 border border-neon-red/20">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="font-bold text-foreground">Сбросить все игровые данные</h4>
                      <p className="text-sm text-muted-foreground mt-1">Очистка всех игровых счетчиков, тоталов и личной статистики игроков (Won/Lost/Games). Фишки затронуты не будут.</p>
                    </div>
                    <Button variant="destructive" className="bg-neon-red hover:bg-red-600 shadow-glow-red font-bold px-8" onClick={resetAllStats}>
                       СБРОСИТЬ ВСЁ
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function UserRow({ user, onBalance, onLuck, onResetTimer, onToggleCooldown, onResetStats, onToggleBan, onDelete, onRegenUid }: {
  user: UserProfile
  onBalance: (nick: string, bal: number) => void
  onLuck: (nick: string, luck: number) => void
  onResetTimer: (nick: string) => void
  onToggleCooldown: (nick: string, current: boolean) => void
  onResetStats: (nick: string) => void
  onToggleBan: (nick: string, current: boolean) => void
  onDelete: (nick: string) => void
  onRegenUid: (nick: string) => void
}) {
  const [editBal, setEditBal] = useState(false)
  const [editLuck, setEditLuck] = useState(false)
  const [newBal, setNewBal] = useState(user.balance.toString())
  const [newLuck, setNewLuck] = useState(user.luck.toFixed(2))

  return (
    <tr className={`border-b border-gold/10 hover:bg-gold/5 transition-colors ${user.isBanned ? 'bg-neon-red/5 opacity-80' : ''}`}>
      <td className="py-2 px-3 flex items-center gap-2">
        <div className="relative">
          <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full bg-marble" />
          {user.isBanned && <div className="absolute -top-1 -right-1 bg-neon-red text-white rounded-full p-0.5"><Shield className="w-2 h-2" /></div>}
        </div>
        <span className={user.isBanned ? 'text-neon-red line-through' : ''}>{user.nickname}</span>
      </td>
      <td className="py-2 px-3 text-left">
        <code className="text-[10px] opacity-40 hover:opacity-100 cursor-help" title={user.uid}>
          {user.uid?.substring(0, 8)}...
        </code>
      </td>
      <td className="py-2 px-3 text-right">
        {editBal ? (
          <span className="flex items-center gap-1 justify-end">
            <Input value={newBal} onChange={e => setNewBal(e.target.value)} className="w-24 h-7 text-xs" />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { onBalance(user.nickname, +newBal); setEditBal(false) }}>✓</Button>
          </span>
        ) : (
          <span className="cursor-pointer text-gold hover:underline" onClick={() => setEditBal(true)}>{formatBalance(user.balance)}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {editLuck ? (
          <span className="flex items-center gap-1 justify-end">
            <Input type="number" step="0.1" value={newLuck} onChange={e => setNewLuck(e.target.value)} className="w-16 h-7 text-xs" />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { onLuck(user.nickname, parseFloat(newLuck.replace(',', '.'))); setEditLuck(false) }}>✓</Button>
          </span>
        ) : (
          <span className="cursor-pointer hover:underline" onClick={() => setEditLuck(true)}>{user.luck.toFixed(2)}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">{user.totalGamesPlayed}</td>
      <td className="py-2 px-3 text-right text-gold">{formatBalance(user.totalWon)}</td>
      <td className="py-2 px-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
            <input type="checkbox" checked={user.noBonusCooldown || false} onChange={() => onToggleCooldown(user.nickname, !!user.noBonusCooldown)} className="cursor-pointer" />
            Без КД
          </label>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" title="Сбросить бонус" onClick={() => onResetTimer(user.nickname)}>⏰</Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-neon-red hover:bg-neon-red/10" title="Сбросить статистику" onClick={() => onResetStats(user.nickname)}>🔄</Button>
          <div className="w-[1px] h-3 bg-gold/20 mx-1" />
          <Button variant="ghost" size="sm" className={`h-6 px-2 text-[10px] ${user.isBanned ? 'text-neon-green hover:bg-neon-green/10' : 'text-neon-red hover:bg-neon-red/10'}`} title={user.isBanned ? 'Разбанить' : 'Забанить'} onClick={() => onToggleBan(user.nickname, !!user.isBanned)}>
            {user.isBanned ? '🔓' : '🚫'}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-neon-red hover:bg-neon-red/10" title="Удалить" onClick={() => onDelete(user.nickname)}>🗑️</Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-violet-400" title="Реген UID" onClick={() => onRegenUid(user.nickname)}>🆔</Button>
        </div>
      </td>
    </tr>
  )
}
