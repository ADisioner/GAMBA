import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Users, Coins, Clover, Megaphone, History, Settings, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import type { UserProfile, GameRecord } from '@/types'
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore'
import { ref, push } from 'firebase/database'
import { db, rtdb } from '@/lib/firebase'
import { toast } from 'sonner'

type Tab = 'users' | 'history' | 'settings' | 'broadcast'

export function AdminPage() {
  const { profile, settings, refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [games, setGames] = useState<GameRecord[]>([])
  const [broadcastMsg, setBroadcastMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

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
    const clamped = Math.max(0.85, Math.min(1.15, newLuck))
    await updateDoc(doc(db, 'users', nickname), { luck: clamped, updatedAt: Date.now() })
    toast.success(`Luck ${nickname} = ${clamped.toFixed(2)}`)
    loadUsers()
  }

  async function resetAllBalances() {
    const starting = settings?.startingBalance || 10000
    for (const u of users) {
      await updateDoc(doc(db, 'users', u.nickname), { balance: starting, updatedAt: Date.now() })
    }
    toast.success('Балансы сброшены')
    loadUsers()
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

  const tabs = [
    { id: 'users' as Tab, icon: Users, label: 'Игроки' },
    { id: 'history' as Tab, icon: History, label: 'История' },
    { id: 'broadcast' as Tab, icon: Megaphone, label: 'Broadcast' },
    { id: 'settings' as Tab, icon: Settings, label: 'Настройки' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-neon-red" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Админ-панель</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} size="sm"
              onClick={() => { setTab(t.id); if (t.id === 'history') loadHistory() }}>
              <t.icon className="w-4 h-4" /> {t.label}
            </Button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Игроки ({users.length})</CardTitle>
                <Button variant="destructive" size="sm" onClick={resetAllBalances}>Сбросить балансы</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold/20 text-muted-foreground">
                      <th className="text-left py-2 px-3">Ник</th>
                      <th className="text-right py-2 px-3">Баланс</th>
                      <th className="text-right py-2 px-3">Luck</th>
                      <th className="text-right py-2 px-3">Игры</th>
                      <th className="text-right py-2 px-3">Выиграно</th>
                      <th className="text-center py-2 px-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <UserRow key={u.nickname} user={u} onBalance={updateBalance} onLuck={updateLuck} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>История игр ({games.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-gold/20 text-muted-foreground">
                      <th className="text-left py-2 px-3">Игрок</th>
                      <th className="text-left py-2 px-3">Игра</th>
                      <th className="text-right py-2 px-3">Ставка</th>
                      <th className="text-center py-2 px-3">Результат</th>
                      <th className="text-right py-2 px-3">Выплата</th>
                      <th className="text-right py-2 px-3">Luck</th>
                      <th className="text-right py-2 px-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map(g => (
                      <tr key={g.id} className="border-b border-gold/10 hover:bg-gold/5">
                        <td className="py-2 px-3">{g.userId}</td>
                        <td className="py-2 px-3">{g.gameType}</td>
                        <td className="py-2 px-3 text-right">{formatBalance(g.bet)}</td>
                        <td className={`py-2 px-3 text-center ${g.result === 'win' ? 'text-neon-green' : g.result === 'lose' ? 'text-neon-red' : 'text-gold'}`}>{g.result}</td>
                        <td className="py-2 px-3 text-right text-gold">{formatBalance(g.payout)}</td>
                        <td className="py-2 px-3 text-right">{g.luckAtTime.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground text-xs">{new Date(g.createdAt).toLocaleString('ru')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Broadcast */}
        {tab === 'broadcast' && (
          <Card>
            <CardHeader><CardTitle>Broadcast сообщение</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Текст сообщения..." />
                <Button onClick={sendBroadcast}>Отправить</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings placeholder */}
        {tab === 'settings' && (
          <Card>
            <CardHeader><CardTitle>Настройки сервера</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Стартовый баланс: {settings?.startingBalance}</p>
              <p className="text-muted-foreground">Дневной бонус: {settings?.dailyBonus}</p>
              <p className="text-muted-foreground">House Edge: {((settings?.houseEdge || 0.03) * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/** Строка пользователя с инлайн-редактированием */
function UserRow({ user, onBalance, onLuck }: {
  user: UserProfile
  onBalance: (nick: string, bal: number) => void
  onLuck: (nick: string, luck: number) => void
}) {
  const [editBal, setEditBal] = useState(false)
  const [editLuck, setEditLuck] = useState(false)
  const [newBal, setNewBal] = useState(user.balance.toString())
  const [newLuck, setNewLuck] = useState(user.luck.toFixed(2))

  return (
    <tr className="border-b border-gold/10 hover:bg-gold/5">
      <td className="py-2 px-3 flex items-center gap-2">
        <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full bg-marble" />
        {user.nickname}
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
            <Input value={newLuck} onChange={e => setNewLuck(e.target.value)} className="w-16 h-7 text-xs" />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { onLuck(user.nickname, +newLuck); setEditLuck(false) }}>✓</Button>
          </span>
        ) : (
          <span className="cursor-pointer hover:underline" onClick={() => setEditLuck(true)}>{user.luck.toFixed(2)}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">{user.totalGamesPlayed}</td>
      <td className="py-2 px-3 text-right text-gold">{formatBalance(user.totalWon)}</td>
      <td className="py-2 px-3 text-center text-muted-foreground text-xs">Click bal/luck</td>
    </tr>
  )
}
