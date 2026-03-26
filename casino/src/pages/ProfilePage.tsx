import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Save, History, Trophy, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance } from '@/lib/utils'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [newNickname, setNewNickname] = useState('')

  if (!profile) return null

  async function updateNickname() {
    if (!newNickname.trim() || newNickname.trim().length < 2 || !profile) return
    // Внимание: смена никнейма — сложная операция (нужно создать новый doc и удалить старый)
    // Для MVP пока оставляем без смены
    toast.error('Смена никнейма временно недоступна')
  }

  const stats = [
    { label: 'Баланс', value: formatBalance(profile.balance), icon: <Trophy className="w-5 h-5 text-gold" /> },
    { label: 'Всего игр', value: profile.totalGamesPlayed.toString(), icon: <History className="w-5 h-5 text-gold" /> },
    { label: 'Выиграно', value: formatBalance(profile.totalWon), icon: <TrendingDown className="w-5 h-5 text-neon-green" /> },  
    { label: 'Проиграно', value: formatBalance(profile.totalLost), icon: <TrendingDown className="w-5 h-5 text-neon-red" /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-gold/5 rounded-full blur-[150px]" />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Avatar + Name */}
          <div className="text-center mb-8">
            <img src={profile.avatarUrl} alt={profile.nickname}
              className="w-24 h-24 rounded-full border-2 border-gold/40 mx-auto mb-4 bg-marble glow-gold-sm" />
            <h1 className="font-serif text-3xl font-bold text-foreground">{profile.nickname}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Участник с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {stats.map(s => (
              <Card key={s.label} className="text-center p-4">
                <div className="flex justify-center mb-2">{s.icon}</div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-gold" /> Настройки профиля
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Никнейм</label>
                <div className="flex gap-2">
                  <Input value={newNickname} onChange={e => setNewNickname(e.target.value)}
                    placeholder={profile.nickname} maxLength={20} />
                  <Button onClick={updateNickname} size="sm" variant="outline">
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
