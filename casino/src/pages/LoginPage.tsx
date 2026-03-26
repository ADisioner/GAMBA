import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Dice1, Crown, UserPlus, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || !password) return
    setLoading(true)

    const result = mode === 'login'
      ? await login(nickname.trim(), password)
      : await register(nickname.trim(), password)

    if (!result.ok) {
      toast.error(result.error || 'Ошибка')
    } else if (mode === 'register') {
      toast.success('Аккаунт создан! 🎉')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Фоновые эффекты */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-velvet/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-neon-purple/5 rounded-full blur-[100px]" />
      </div>

      <div className="absolute top-10 left-10 text-gold/10">
        <Dice1 className="w-32 h-32 animate-spin-slow" />
      </div>
      <div className="absolute bottom-10 right-10 text-gold/10">
        <Crown className="w-28 h-28 animate-float" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }} className="relative z-10 text-center px-4 w-full max-w-md">

        {/* Логотип */}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }} className="mb-8">
          <h1 className="font-serif text-7xl sm:text-8xl font-bold tracking-wider">
            <span className="bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(212,175,55,0.4)]">
              GAMBA
            </span>
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-gold" />
            <Sparkles className="w-5 h-5 text-gold animate-pulse" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-gold" />
          </div>
          <p className="text-muted-foreground mt-4 text-lg font-display">Premium Casino Experience</p>
        </motion.div>

        {/* Карточка входа */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-card/60 backdrop-blur-xl border border-gold/20 rounded-2xl p-8 glow-gold-sm">

          <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === 'login' ? 'Введите никнейм и пароль' : 'Придумайте никнейм и пароль'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="Никнейм" autoComplete="username" maxLength={20}
            />
            <Input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Пароль" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <Button type="submit" size="lg" className="w-full relative overflow-hidden group" disabled={loading}>
              {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </Button>
          </form>

          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="mt-4 text-sm text-gold hover:text-gold-light transition-colors">
            {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
          </button>

          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
            <span>18+</span>
            <div className="w-[1px] h-3 bg-gold/30" />
            <span>Только симулятор</span>
            <div className="w-[1px] h-3 bg-gold/30" />
            <span>Без реальных денег</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
