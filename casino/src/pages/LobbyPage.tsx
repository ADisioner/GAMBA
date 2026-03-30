import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, CircleDot, Spade, Bomb, TrendingUp, Play, Sparkles, Trophy, MessageSquare, Star, Club } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { formatBalance, formatDynamicBalance } from '@/lib/utils'
import { Header } from '@/components/layout/Header'
import { MultiplayerLobby } from '@/components/multiplayer/MultiplayerLobby'
import type { GameType, LeaderboardEntry, ChatMessage } from '@/types'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { ref, onValue, push } from 'firebase/database'
import { db, rtdb } from '@/lib/firebase'

const GAME_CARDS: { type: GameType; icon: React.ReactNode; gradient: string; badge?: string }[] = [
  { type: 'slots', icon: <Crown className="w-8 h-8" />, gradient: 'from-gold-dark via-gold to-gold-light', badge: 'HOT' },
  { type: 'blackjack', icon: <Spade className="w-8 h-8" />, gradient: 'from-gray-700 via-gray-600 to-gray-500' },
  { type: 'crash', icon: <TrendingUp className="w-8 h-8" />, gradient: 'from-emerald-700 via-emerald-500 to-emerald-400', badge: 'NEW' },
  { type: 'poker', icon: <Club className="w-8 h-8" />, gradient: 'from-violet-900 via-purple-600 to-fuchsia-400' },
]

function GameCard({ type, icon, gradient, badge, config }: {
  type: GameType; icon: React.ReactNode; gradient: string; badge?: string
  config?: { name: string; description: string; enabled: boolean }
}) {
  const navigate = useNavigate()
  if (config && !config.enabled) return null
  return (
    <motion.div whileHover={{ scale: 1.03, y: -4 }} transition={{ type: 'spring', stiffness: 300 }}
      className="group relative cursor-pointer" onClick={() => navigate(`/game/${type}`)}>
      <div className="absolute -inset-0.5 bg-gradient-to-r from-gold/0 via-gold/30 to-gold/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      <div className="relative h-full bg-marble-light/50 backdrop-blur-sm rounded-xl border border-gold/20 overflow-hidden group-hover:border-gold/50 transition-all duration-500">
        <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />
        {badge && <div className="absolute top-4 right-4"><span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${badge === 'VIP' ? 'bg-gradient-to-r from-gold-dark to-gold text-primary-foreground' : badge === 'NEW' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-marble text-gold border border-gold/30'}`}>{badge}</span></div>}
        <div className="p-6">
          <div className="relative w-16 h-16 mb-4">
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-20`} />
            <div className="relative w-full h-full rounded-xl bg-marble/50 border border-gold/20 flex items-center justify-center">
              <div className="text-gold group-hover:text-gold-light transition-colors">{icon}</div>
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-gold opacity-0 group-hover:opacity-100 animate-pulse" />
          </div>
          <h3 className="font-serif text-xl font-semibold text-foreground group-hover:text-gold-light transition-colors mb-1">{config?.name || type}</h3>
          <p className="text-sm text-muted-foreground mb-6">{config?.description || ''}</p>
          <Button variant="outline" className="w-full" size="sm"><Play className="w-4 h-4 fill-current" /> Играть</Button>
        </div>
      </div>
    </motion.div>
  )
}

function ChatPanel() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')

  useEffect(() => {
    try {
      const chatRef = ref(rtdb, 'chat')
      console.log('Connecting to chat RTDB...')
      return onValue(chatRef, (snap) => {
        const d = snap.val()
        if (!d) {
          setMessages([])
          return
        }
        const msgs = Object.entries(d).map(([id, m]) => ({ id, ...(m as Omit<ChatMessage, 'id'>) }))
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(-50)
        setMessages(msgs)
      }, (error) => {
        console.error('Chat RTDB Error:', error)
        toast.error('Ошибка подключения к чату')
      })
    } catch (e) {
      console.error('Chat Init Error:', e)
    }
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim()) return
    if (!profile) {
      toast.error('Войдите в систему, чтобы писать в чат')
      return
    }
    try {
      await push(ref(rtdb, 'chat'), { 
        userId: profile.nickname, 
        nickname: profile.nickname, 
        avatarUrl: profile.avatarUrl, 
        text: newMsg.trim(), 
        type: 'user', 
        createdAt: Date.now() 
      })
      setNewMsg('')
    } catch (e: any) {
      console.error('Send message error:', e)
      toast.error('Не удалось отправить сообщение')
    }
  }

  return (
    <Card className="h-[400px] flex flex-col">
      <div className="p-4 border-b border-gold/20 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-gold" /><h3 className="font-serif text-sm font-semibold">Чат</h3></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-2 items-start ${m.type === 'broadcast' ? 'bg-gold/10 p-2 rounded' : ''}`}>
            {m.type === 'user' && <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0 bg-marble" />}
            <div className="min-w-0">{m.type === 'broadcast' ? <p className="text-xs text-gold font-semibold">📢 {m.text}</p> : m.type === 'system' ? <p className="text-xs text-muted-foreground italic">{m.text}</p> : <><span className="text-xs font-semibold text-gold">{m.nickname}: </span><span className="text-xs text-foreground/80 break-words">{m.text}</span></>}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-3 border-t border-gold/20 flex gap-2">
        <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Сообщение..." className="h-8 text-xs" maxLength={200} />
        <Button type="submit" size="sm" variant="outline" className="h-8 px-3">→</Button>
      </form>
    </Card>
  )
}

function LeaderboardList() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  useEffect(() => {
    (async () => { try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('balance', 'desc'), limit(10)))
      setLeaders(snap.docs.map(d => ({ nickname: d.data().nickname, avatarUrl: d.data().avatarUrl, totalWon: d.data().totalWon || 0, balance: d.data().balance || 0 })))
    } catch {} })()
  }, [])
  
  return (
    <div className="p-3 space-y-2">
      {leaders.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Пока пусто</p> : leaders.map((l, i) => (
        <div key={l.nickname} className="flex items-center gap-3 py-1.5">
          <span className={`text-xs font-bold w-5 text-center ${i < 3 ? 'text-gold' : 'text-muted-foreground'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
          <img src={l.avatarUrl} alt="" className="w-6 h-6 rounded-full bg-marble" />
          <span className="text-xs font-medium flex-1 truncate">{l.nickname}</span>
          <span className="text-xs text-gold font-semibold">{formatDynamicBalance(l.balance)}</span>
        </div>))}
    </div>
  )
}

function OnlineList() {
  const [online, setOnline] = useState<{nickname: string; avatarUrl: string}[]>([])
  
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'status'), (snap) => {
      if (!snap.exists()) {
        setOnline([])
        return
      }
      const data = snap.val()
      const users = Object.values(data) as any[]
      setOnline(users)
    })
    return () => unsub()
  }, [])
  
  return (
    <div className="p-3 space-y-2">
      {online.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Никого нет</p> : online.map((u, i) => (
        <div key={u.nickname} className="flex items-center gap-3 py-1.5 animate-in fade-in zoom-in duration-300" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="relative">
            <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-marble border border-emerald-500/30" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-background shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>
          <span className="text-sm font-medium flex-1 truncate tracking-tight">{u.nickname}</span>
        </div>))}
    </div>
  )
}

function SidebarPanels() {
  const [tab, setTab] = useState<'leaderboard' | 'online'>('leaderboard')
  
  return (
    <Card className="flex flex-col min-h-[300px] overflow-hidden">
      <div className="flex bg-marble-light/20">
        <button 
          onClick={() => setTab('leaderboard')}
          className={`flex-1 p-3 text-[11px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${tab === 'leaderboard' ? 'bg-gold/10 text-gold shadow-[inset_0_-2px_0_rgba(255,215,0,1)]' : 'text-muted-foreground hover:bg-gold/5'}`}
        >
          <Trophy className="w-3.5 h-3.5" /> Топ 10
        </button>
        <button 
          onClick={() => setTab('online')}
          className={`flex-1 p-3 text-[11px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${tab === 'online' ? 'bg-emerald-500/10 text-emerald-400 shadow-[inset_0_-2px_0_rgba(16,185,129,1)]' : 'text-muted-foreground hover:bg-emerald-500/5'}`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" /> Онлайн
        </button>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {tab === 'leaderboard' ? <LeaderboardList /> : <OnlineList />}
      </div>
    </Card>
  )
}

export function LobbyPage() {
  const { settings } = useAuth()
  const [lobbyTab, setLobbyTab] = useState<'all' | 'multiplayer'>('all')

  const sorted = GAME_CARDS.filter(g => { const c = settings?.gamesConfig?.[g.type]; return !c || c.enabled })
    .sort((a, b) => (settings?.gamesConfig?.[a.type]?.order ?? 99) - (settings?.gamesConfig?.[b.type]?.order ?? 99))

  return (
    <div className="min-h-screen">
      <Header />
      <div className="fixed inset-0 pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[150px]" /><div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-velvet/10 rounded-full blur-[120px]" /></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3"><Star className="w-5 h-5 text-gold" /><span className="text-sm text-gold font-medium uppercase tracking-widest">Премиум коллекция</span><Star className="w-5 h-5 text-gold" /></div>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-3">
            {lobbyTab === 'all' ? 'Испытай удачу' : 'За общим столом'}
          </h2>
          
          <div className="flex justify-center gap-4 mt-6">
            <button 
              onClick={() => setLobbyTab('all')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${lobbyTab === 'all' ? 'bg-gold text-velvet-dark shadow-glow-gold' : 'bg-marble/20 text-muted-foreground hover:bg-marble/40'}`}
            >
              Все игры
            </button>
            <button 
              onClick={() => setLobbyTab('multiplayer')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${lobbyTab === 'multiplayer' ? 'bg-gold text-velvet-dark shadow-glow-gold' : 'bg-marble/20 text-muted-foreground hover:bg-marble/40'}`}
            >
              Мультиплеер
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {lobbyTab === 'all' ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sorted.map((g, i) => (
                  <motion.div key={g.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <GameCard {...g} config={settings?.gamesConfig?.[g.type]} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <MultiplayerLobby />
            )}
          </div>
          <div className="space-y-5"><SidebarPanels /><ChatPanel /></div>
        </div>
      </div>
    </div>
  )
}
