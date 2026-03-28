import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Dice1, Crown, UserPlus, LogIn, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export function LoginPage() {
  const { login, register, loginWithGoogle, pendingGoogleUser, completeGoogleRegistration, cancelGoogleLogin } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nickname, setNickname] = useState('')
  const [newGoogleNick, setNewGoogleNick] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || !password) return
    setLoading(true)

    const result = mode === 'login'
      ? await login(nickname.trim(), password, rememberMe)
      : await register(nickname.trim(), password, rememberMe)

    if (!result.ok) {
      toast.error(result.error || 'Ошибка')
    } else if (mode === 'register') {
      toast.success('Аккаунт создан! 🎉')
    }
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setLoading(true)
    const result = await loginWithGoogle()
    if (!result.ok) {
      toast.error(result.error || 'Ошибка Google Auth')
    } else if (result.needsNickname) {
      toast.info('Пожалуйста, выберите никнейм')
    } else {
      toast.success('Успешный вход через Google! 🚀')
    }
    setLoading(false)
  }

  async function handleFinishGoogle() {
    if (!newGoogleNick.trim()) return
    setLoading(true)
    const result = await completeGoogleRegistration(newGoogleNick.trim())
    if (!result.ok) {
      toast.error(result.error || 'Ошибка')
    } else {
      toast.success('Добро пожаловать в GAMBA! 🎉')
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

          {pendingGoogleUser ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-2">
                <div className="relative">
                   <img src={pendingGoogleUser.photoURL} alt="" className="w-20 h-20 rounded-full border-2 border-gold shadow-lg" />
                   <div className="absolute -bottom-1 -right-1 bg-gold text-velvet-dark rounded-full p-1"><Sparkles className="w-4 h-4" /></div>
                </div>
                <div className="text-center">
                  <h2 className="font-serif text-2xl font-semibold text-foreground">Почти готово!</h2>
                  <p className="text-muted-foreground text-xs">{pendingGoogleUser.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-foreground/80 px-2 leading-relaxed">
                  Похоже, вы у нас впервые. Придумайте себе уникальный игровой никнейм:
                </p>
                <Input
                  value={newGoogleNick} onChange={e => setNewGoogleNick(e.target.value)}
                  placeholder="Ваш никнейм" maxLength={15}
                  className="text-center text-lg font-bold tracking-wide border-gold/30 bg-gold/5 focus:border-gold h-12"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1 opacity-50 hover:opacity-100" onClick={cancelGoogleLogin} disabled={loading}>
                    Отмена
                  </Button>
                  <Button className="flex-[2] bg-gold hover:bg-gold-dark text-velvet-dark font-bold py-6 shadow-glow-gold" onClick={handleFinishGoogle} disabled={loading || !newGoogleNick.trim()}>
                    {loading ? 'Создание...' : 'Играть сейчас'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                
                <div 
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 cursor-pointer text-sm text-foreground/80 hover:text-gold transition-colors w-fit"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-gold border-gold text-velvet-dark' : 'border-gold/30 bg-transparent'}`}>
                    {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="select-none">Запомнить меня</span>
                </div>

                <Button type="submit" size="lg" className="w-full relative overflow-hidden group" disabled={loading}>
                  {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </Button>
              </form>

              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="mt-4 text-xs text-gold hover:text-gold-light transition-colors block mx-auto">
                {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gold/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <span className="bg-[#1a1a1a] px-3">ИЛИ</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                type="button" 
                onClick={handleGoogleLogin} 
                className="w-full border-gold/10 hover:border-gold/30 bg-white/5 hover:bg-white/10 text-foreground transition-all duration-300"
                disabled={loading}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 mr-3" alt="Google" />
                Продолжить с Google
              </Button>
            </>
          )}

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
