import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, User, LayoutGrid, LogOut, Shield, Gift, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { formatBalance, formatDynamicBalance } from '@/lib/utils'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

function BonusButton({ profile, onClaim, className }: { profile: any, onClaim: () => void, className?: string }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!profile || profile.noBonusCooldown) {
      setTimeLeft(null)
      return
    }

    const timer = setInterval(() => {
      const now = Date.now()
      const last = profile.lastDailyBonus || 0
      const cooldown = 30 * 60 * 1000
      const diff = cooldown - (now - last)

      if (diff <= 0) {
        setTimeLeft(null)
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [profile])

  return (
    <Button variant="outline" size="sm" onClick={onClaim} className={className} disabled={!!timeLeft && !profile.noBonusCooldown}>
      <Gift className="w-3.5 h-3.5" /> {timeLeft ? timeLeft : 'Бонус'}
    </Button>
  )
}


export function Header() {
  const navigate = useNavigate()
  const { profile, isAdmin, logout, settings, refreshProfile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function claimDailyBonus() {
    if (!profile) return
    const now = Date.now()
    const lastBonus = profile.lastDailyBonus || 0
    const cooldownMs = 30 * 60 * 1000 // 30 минут

    // Если у пользователя нет привилегии "Без КД", проверяем таймер
    if (!profile.noBonusCooldown && now - lastBonus < cooldownMs) {
      const minsLeft = Math.ceil((cooldownMs - (now - lastBonus)) / 60000)
      toast.error(`Бонус будет через ${minsLeft} мин.`)
      return
    }

    // Случайная сумма от 500 до 35000
    const bonus = Math.floor(Math.random() * (35000 - 500 + 1)) + 500
    await updateDoc(doc(db, 'users', profile.nickname), {
      balance: profile.balance + bonus,
      lastDailyBonus: now,
      updatedAt: now,
    })
    await refreshProfile()
    toast.success(`+${formatBalance(bonus)} 🎉`)
  }

  if (!profile) return null

  return (
    <header className="sticky top-0 z-50 shrink-0">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
      <nav className="bg-marble/80 backdrop-blur-xl border-b border-gold/20 h-16 sm:h-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <Link to="/lobby" className="flex-shrink-0">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-wider">
                <span className="bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">GAMBA</span>
              </h1>
            </Link>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/lobby" className="group px-3 py-2 text-sm font-medium text-foreground/80 hover:text-gold transition-colors flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-gold/70" /> Лобби
              </Link>
              <Link to="/profile" className="group px-3 py-2 text-sm font-medium text-foreground/80 hover:text-gold transition-colors flex items-center gap-2">
                <User className="w-4 h-4 text-gold/70" /> Профиль
              </Link>
              {isAdmin && (
                <Link to="/admin" className="px-3 py-2 text-sm font-medium text-neon-red hover:text-neon-red/80 transition-colors flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Админ
                </Link>
              )}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <BonusButton profile={profile} onClaim={claimDailyBonus} className="text-xs w-24" />
              <button 
                onClick={() => navigate('/bank')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-marble-light/50 border border-gold/30 hover:border-gold/50 transition-all cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">$</span>
                </div>
                <span className="text-sm font-semibold text-gold-light">{formatDynamicBalance(profile.balance)}</span>
              </button>
              <div className="flex items-center gap-2">
                <img src={profile.avatarUrl} alt={profile.nickname} className="w-8 h-8 rounded-full border border-gold/30 bg-marble" />
                <span className="text-sm text-foreground/80">{profile.nickname}</span>
                <button onClick={logout} className="p-1.5 text-muted-foreground hover:text-gold transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-2">
              <button 
                onClick={() => navigate('/bank')}
                className="flex items-center gap-1 px-2 py-1 rounded bg-marble-light/50 border border-gold/30"
              >
                <Coins className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-gold-light">{formatDynamicBalance(profile.balance)}</span>
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gold">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden bg-marble/95 backdrop-blur-xl border-t border-gold/20">
            <div className="px-4 py-3 space-y-1">
              <Link to="/lobby" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full px-4 py-3 text-foreground/80 hover:text-gold rounded-lg"><LayoutGrid className="w-5 h-5 text-gold/70" /> Лобби</Link>
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full px-4 py-3 text-foreground/80 hover:text-gold rounded-lg"><User className="w-5 h-5 text-gold/70" /> Профиль</Link>
              {isAdmin && <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full px-4 py-3 text-neon-red rounded-lg"><Shield className="w-5 h-5" /> Админ</Link>}
              <div className="px-4 py-2 space-y-2">
                <BonusButton profile={profile} onClaim={claimDailyBonus} className="w-full justify-start py-6" />
              </div>
              <button onClick={() => { logout(); setMobileMenuOpen(false) }} className="flex items-center gap-3 w-full px-4 py-3 text-foreground/80 hover:text-neon-red rounded-lg"><LogOut className="w-5 h-5" /> Выход</button>
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  )
}
