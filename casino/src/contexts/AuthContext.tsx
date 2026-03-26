import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, ADMIN_NICKNAME } from '@/lib/firebase'
import { getInitialLuck } from '@/lib/luck'
import type { UserProfile, GlobalSettings } from '@/types'

interface AuthContextType {
  profile: UserProfile | null
  settings: GlobalSettings | null
  loading: boolean
  isAdmin: boolean
  login: (nickname: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (nickname: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_SETTINGS: GlobalSettings = {
  startingBalance: 10000,
  dailyBonus: 500,
  houseEdge: 0.03,
  adminNickname: ADMIN_NICKNAME,
  gamesConfig: {
    slots: { enabled: true, order: 1, name: 'Golden Slots', description: 'Классические слоты', minBet: 10, maxBet: 5000 },
    roulette: { enabled: true, order: 2, name: 'Рулетка', description: 'Европейская рулетка', minBet: 10, maxBet: 10000 },
    blackjack: { enabled: true, order: 3, name: 'Блэкджек', description: 'Обыграй дилера', minBet: 25, maxBet: 5000 },
    crash: { enabled: true, order: 4, name: 'Crash', description: 'Успей забрать', minBet: 10, maxBet: 10000 },
    mines: { enabled: true, order: 5, name: 'Mines', description: 'Найди безопасные клетки', minBet: 10, maxBet: 5000 },
  },
}

/** Простой SHA-256 хэш строки */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '_gamba_salt_2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Генерация аватара через DiceBear */
function generateAvatar(nickname: string): string {
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(nickname)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = Boolean(profile && profile.nickname === (settings?.adminNickname || ADMIN_NICKNAME))

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'))
      if (snap.exists()) {
        setSettings(snap.data() as GlobalSettings)
      } else {
        await setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS)
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    }
  }

  async function loadProfile(nickname: string) {
    try {
      const snap = await getDoc(doc(db, 'users', nickname))
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile)
        return snap.data() as UserProfile
      }
    } catch { /* not found */ }
    return null
  }

  async function refreshProfile() {
    if (profile) await loadProfile(profile.nickname)
  }

  async function register(nickname: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (nickname.length < 2) return { ok: false, error: 'Никнейм минимум 2 символа' }
    if (password.length < 4) return { ok: false, error: 'Пароль минимум 4 символа' }

    const existing = await getDoc(doc(db, 'users', nickname))
    if (existing.exists()) return { ok: false, error: 'Никнейм занят' }

    const startBalance = settings?.startingBalance || DEFAULT_SETTINGS.startingBalance
    const newProfile: UserProfile = {
      nickname,
      passwordHash: await hashPassword(password),
      avatarUrl: generateAvatar(nickname),
      balance: startBalance,
      luck: getInitialLuck(),
      totalGamesPlayed: 0,
      totalWon: 0,
      totalLost: 0,
      lastDailyBonus: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await setDoc(doc(db, 'users', nickname), newProfile)
    setProfile(newProfile)
    localStorage.setItem('gamba_user', nickname)
    return { ok: true }
  }

  async function login(nickname: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const snap = await getDoc(doc(db, 'users', nickname))
    if (!snap.exists()) return { ok: false, error: 'Пользователь не найден' }

    const user = snap.data() as UserProfile
    const hash = await hashPassword(password)
    if (user.passwordHash !== hash) return { ok: false, error: 'Неверный пароль' }

    setProfile(user)
    localStorage.setItem('gamba_user', nickname)
    return { ok: true }
  }

  function logout() {
    setProfile(null)
    localStorage.removeItem('gamba_user')
  }

  useEffect(() => {
    (async () => {
      await loadSettings()
      // Авто-логин из localStorage
      const saved = localStorage.getItem('gamba_user')
      if (saved) await loadProfile(saved)
      setLoading(false)
    })()
  }, [])

  return (
    <AuthContext.Provider value={{ profile, settings, loading, isAdmin, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
