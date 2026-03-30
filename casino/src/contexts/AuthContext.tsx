import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, onSnapshot } from 'firebase/firestore'
import { ref, push, onDisconnect, onValue, set, serverTimestamp } from 'firebase/database'
import { signInWithPopup, signInAnonymously } from 'firebase/auth'
import { db, ADMIN_NICKNAME, auth, googleProvider, rtdb } from '@/lib/firebase'
import { getInitialLuck } from '@/lib/luck'
import type { UserProfile, GlobalSettings, LiveEvent } from '@/types'

interface AuthContextType {
  profile: UserProfile | null
  settings: GlobalSettings | null
  loading: boolean
  isAdmin: boolean
  pendingGoogleUser: { email: string; photoURL: string; displayName: string } | null
  login: (nickname: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; error?: string }>
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string; needsNickname?: boolean }>
  completeGoogleRegistration: (nickname: string) => Promise<{ ok: boolean; error?: string }>
  cancelGoogleLogin: () => void
  register: (nickname: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  refreshProfile: () => Promise<void>
  addLiveEvent: (event: Omit<LiveEvent, 'id' | 'createdAt'>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_SETTINGS: GlobalSettings = {
  startingBalance: 10000,
  dailyBonus: 500,
  houseEdge: 0.12, // Увеличено преимущество казино до 12%
  adminNickname: ADMIN_NICKNAME,
  gamesConfig: {
    slots: { enabled: true, order: 1, name: 'Golden Slots', description: 'Классические слоты', minBet: 10, maxBet: 5000 },
    roulette: { enabled: true, order: 2, name: 'Рулетка', description: 'Американская рулетка', minBet: 10, maxBet: 10000 },
    blackjack: { enabled: true, order: 3, name: 'Блэкджек', description: 'Обыграй дилера', minBet: 25, maxBet: 5000 },
    crash: { enabled: true, order: 4, name: 'Crash', description: 'Успей забрать', minBet: 10, maxBet: 10000 },
    poker: { enabled: true, order: 5, name: 'Video Poker', description: 'Валеты или старше', minBet: 10, maxBet: 5000 },
  },
  bankDepositBonus: 10,
  bankTransferCommission: 20,
  bankCreditRate: 80,
}

/** Простой SHA-256 хэш строки на чистом JS (работает везде без HTTPS) */
async function hashPassword(password: string): Promise<string> {
  const msg = password + '_gamba_salt_2026'

  function sha256(s: string) {
    function safe_add(x: number, y: number) {
      const l = (x & 0xFFFF) + (y & 0xFFFF)
      const m = (x >> 16) + (y >> 16) + (l >> 16)
      return (m << 16) | (l & 0xFFFF)
    }
    const S = (X: number, n: number) => (X >>> n) | (X << (32 - n))
    const R = (X: number, n: number) => (X >>> n)
    const Ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z)
    const Maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z)
    const Sigma0256 = (x: number) => S(x, 2) ^ S(x, 13) ^ S(x, 22)
    const Sigma1256 = (x: number) => S(x, 6) ^ S(x, 11) ^ S(x, 25)
    const Gamma0256 = (x: number) => S(x, 7) ^ S(x, 18) ^ R(x, 3)
    const Gamma1256 = (x: number) => S(x, 17) ^ S(x, 19) ^ R(x, 10)

    const K = [
      0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
      0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
      0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
      0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
      0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
      0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
      0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
      0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
    ]
    const H = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]
    const W = new Array(64)
    const blocks: number[] = []
    const str = unescape(encodeURIComponent(s))
    for (let i = 0; i < str.length; i++) { blocks[i >> 2] |= (str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8) }
    blocks[str.length >> 2] |= 0x80 << (24 - (str.length % 4) * 8)
    blocks[(((str.length + 8) >> 6) << 4) + 15] = str.length * 8

    for (let i = 0; i < blocks.length; i += 16) {
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
      for (let j = 0; j < 64; j++) {
        if (j < 16) W[j] = blocks[j + i] || 0
        else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16])
        const T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j])
        const T2 = safe_add(Sigma0256(a), Maj(a, b, c))
        h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2)
      }
      H[0] = safe_add(a, H[0]); H[1] = safe_add(b, H[1]); H[2] = safe_add(c, H[2]); H[3] = safe_add(d, H[3])
      H[4] = safe_add(e, H[4]); H[5] = safe_add(f, H[5]); H[6] = safe_add(g, H[6]); H[7] = safe_add(h, H[7])
    }
    return H.map(h => (h >>> 0).toString(16).padStart(8, '0')).join('')
  }
  return sha256(msg)
}

/** Генерация аватара через DiceBear */
function generateAvatar(nickname: string): string {
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(nickname)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string; photoURL: string; displayName: string } | null>(null)

  const isAdmin = Boolean(profile && profile.nickname === (settings?.adminNickname || ADMIN_NICKNAME))

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'))
      if (snap.exists()) {
        const data = snap.data() as GlobalSettings
        const mergedGamesConfig = { ...DEFAULT_SETTINGS.gamesConfig, ...data.gamesConfig }
        setSettings({ ...DEFAULT_SETTINGS, ...data, gamesConfig: mergedGamesConfig })
      } else {
        await setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS)
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    }
  }

  const [currentNick, setCurrentNick] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    const saved = localStorage.getItem('gamba_user') || sessionStorage.getItem('gamba_user')
    if (saved) setCurrentNick(saved)
    else setLoading(false)
  }, [])

  useEffect(() => {
    if (!currentNick) {
      setProfile(null)
      return
    }

    const unsub = onSnapshot(doc(db, 'users', currentNick), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile
        if (data.isBanned) {
          logout()
        } else {
          // Restore Auth if needed
          if (!auth.currentUser) {
            try { await signInAnonymously(auth) } catch (e) { console.error(e) }
          }
          setProfile(data)
        }
      } else {
        logout()
      }
      setLoading(false)
    }, (err) => {
      console.error('Profile listener error:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [currentNick])

  useEffect(() => {
    if (!profile?.nickname) return
    
    // RTDB Presence tracking
    const userStatusRef = ref(rtdb, `status/${profile.nickname}`)
    const connectedRef = ref(rtdb, '.info/connected')

    const unsubStatus = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(userStatusRef).remove().then(() => {
          set(userStatusRef, {
            nickname: profile.nickname,
            avatarUrl: profile.avatarUrl,
            lastActive: serverTimestamp()
          })
        })
      }
    })

    return () => {
      unsubStatus()
      // Optional manual clear when component unmounts (e.g. logout)
      set(userStatusRef, null).catch(() => {})
    }
  }, [profile?.nickname, profile?.avatarUrl])

  async function refreshProfile() {
    // onSnapshot handles this now, but we keep the method for compatibility
  }

  async function register(nickname: string, password: string, rememberMe = false): Promise<{ ok: boolean; error?: string }> {
    if (nickname.length < 2) return { ok: false, error: 'Никнейм минимум 2 символа' }
    if (password.length < 4) return { ok: false, error: 'Пароль минимум 4 символа' }

    const existing = await getDoc(doc(db, 'users', nickname))
    if (existing.exists()) return { ok: false, error: 'Никнейм занят' }

    let uid = ''
    try {
      const authResult = await signInAnonymously(auth)
      uid = authResult.user.uid
    } catch (e: any) {
      console.error('Registration auth error:', e)
      if (e.code === 'auth/admin-only-operation') {
        return { ok: false, error: 'Ошибка сервера: Анонимный вход выключен в консоли Firebase (Enable Anonymous Auth)' }
      }
      return { ok: false, error: 'Ошибка Firebase Auth: ' + e.message }
    }

    const startBalance = settings?.startingBalance || DEFAULT_SETTINGS.startingBalance
    const newProfile: UserProfile = {
      uid,
      nickname,
      passwordHash: await hashPassword(password),
      avatarUrl: generateAvatar(nickname),
      balance: startBalance,
      luck: 0,
      totalGamesPlayed: 0,
      totalWon: 0,
      totalLost: 0,
      lastDailyBonus: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await setDoc(doc(db, 'users', nickname), newProfile)
    if (rememberMe) {
      localStorage.setItem('gamba_user', nickname)
    } else {
      sessionStorage.setItem('gamba_user', nickname)
    }
    setCurrentNick(nickname)
    return { ok: true }
  }

  async function login(nickname: string, password: string, rememberMe = false): Promise<{ ok: boolean; error?: string }> {
    const snap = await getDoc(doc(db, 'users', nickname))
    if (!snap.exists()) return { ok: false, error: 'Пользователь не найден' }

    const user = snap.data() as UserProfile
    if (user.isBanned) return { ok: false, error: 'Ваш аккаунт заблокирован администратором' }

    const hash = await hashPassword(password)
    if (user.passwordHash !== hash) return { ok: false, error: 'Неверный пароль' }

    // Обеспечиваем наличие UID если его еще нет (для старых аккаунтов)
    if (!user.uid) {
      const authResult = await signInAnonymously(auth)
      user.uid = authResult.user.uid
      await updateDoc(doc(db, 'users', nickname), { uid: user.uid })
    } else if (!auth.currentUser) {
      await signInAnonymously(auth)
    }

    if (rememberMe) {
      localStorage.setItem('gamba_user', nickname)
    } else {
      sessionStorage.setItem('gamba_user', nickname)
    }
    setCurrentNick(nickname)
    return { ok: true }
  }

  async function loginWithGoogle(): Promise<{ ok: boolean; error?: string; needsNickname?: boolean }> {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const gUser = result.user
      if (!gUser.email) return { ok: false, error: 'Email не найден' }

      // Ищем профиль по email
      const q = query(collection(db, 'users'), where('email', '==', gUser.email))
      const snap = await getDocs(q)

      if (!snap.empty) {
        // Пользователь найден
        const existingProfile = snap.docs[0].data() as UserProfile

        if (existingProfile.isBanned) {
          return { ok: false, error: 'Ваш аккаунт заблокирован администратором' }
        }

        localStorage.setItem('gamba_user', existingProfile.nickname)
        setCurrentNick(existingProfile.nickname)
        return { ok: true }
      } else {
        // Профиля нет — просим выбрать ник
        setPendingGoogleUser({
          email: gUser.email,
          photoURL: gUser.photoURL || '',
          displayName: gUser.displayName || ''
        })
        return { ok: true, needsNickname: true }
      }
    } catch (e: any) {
      console.error('Google Auth Error:', e)
      return { ok: false, error: 'Ошибка входа через Google' }
    }
  }

  async function completeGoogleRegistration(nickname: string): Promise<{ ok: boolean; error?: string }> {
    if (!pendingGoogleUser) return { ok: false, error: 'Сессия Google истекла' }
    if (nickname.length < 2) return { ok: false, error: 'Никнейм слишком короткий' }

    const nickCheck = await getDoc(doc(db, 'users', nickname))
    if (nickCheck.exists()) return { ok: false, error: 'Этот никнейм уже занят' }

    const startBalance = settings?.startingBalance || DEFAULT_SETTINGS.startingBalance
    const newProfile: UserProfile = {
      uid: auth.currentUser?.uid || '',
      nickname: nickname.trim(),
      email: pendingGoogleUser.email,
      avatarUrl: generateAvatar(nickname.trim()),
      balance: startBalance,
      luck: 0,
      totalGamesPlayed: 0,
      totalWon: 0,
      totalLost: 0,
      lastDailyBonus: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await setDoc(doc(db, 'users', nickname), newProfile)
    setPendingGoogleUser(null)
    localStorage.setItem('gamba_user', nickname)
    setCurrentNick(nickname)
    return { ok: true }
  }

  function cancelGoogleLogin() {
    setPendingGoogleUser(null)
  }

  function logout() {
    setCurrentNick(null)
    localStorage.removeItem('gamba_user')
    sessionStorage.removeItem('gamba_user')
  }


  function addLiveEvent(event: Omit<LiveEvent, 'id' | 'createdAt'>) {
    try {
      push(ref(rtdb, 'live_events'), {
        ...event,
        createdAt: Date.now()
      })
    } catch (e) {
      console.error('Failed to add live event:', e)
    }
  }

  return (
    <AuthContext.Provider value={{
      profile, settings, loading, isAdmin, pendingGoogleUser,
      login, loginWithGoogle, completeGoogleRegistration, cancelGoogleLogin,
      register, logout, refreshProfile, addLiveEvent
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
