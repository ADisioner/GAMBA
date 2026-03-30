/** Типы данных приложения GAMBA */

export interface UserProfile {
  uid: string               // ID из Firebase Auth
  nickname: string          // Уникальный никнейм (=логин)
  passwordHash?: string     // Хэш пароля (SHA-256)
  email?: string            // Почта из Google
  avatarUrl: string         // URL аватара (dicebear)
  balance: number
  luck: number              // 0.85–1.15, скрытый параметр
  totalGamesPlayed: number
  totalWon: number
  totalLost: number
  lastDailyBonus: number | null
  noBonusCooldown?: boolean // <--- Добавлено поле
  isBanned?: boolean        // <--- Новое поле для блокировки
  createdAt: number
  updatedAt: number
  bankDebt?: number         // Сумма долга в банке
  creditLimit?: number       // Доступный лимит кредитного плеча
}

export interface BankTransaction {
  id?: string
  userId: string            // nickname
  type: 'deposit' | 'withdraw' | 'credit_take' | 'credit_pay' | 'game'
  amount: number
  commission?: number       // Доход банка с этой операции
  balanceAfter: number
  description: string
  createdAt: number
}

export type GameType = 'slots' | 'blackjack' | 'crash' | 'poker'

export type GameResult = 'win' | 'lose' | 'push'

export interface GameRecord {
  id?: string
  userId: string            // nickname
  gameType: GameType
  bet: number
  result: GameResult
  payout: number
  details: Record<string, unknown>
  luckAtTime: number
  createdAt: number
}

export interface GameConfig {
  enabled: boolean
  order: number
  name: string
  description: string
  minBet: number
  maxBet: number
}

export interface GlobalSettings {
  startingBalance: number
  dailyBonus: number
  houseEdge: number
  adminNickname: string
  gamesConfig: Record<GameType, GameConfig>
  bankDepositBonus?: number      // % бонуса при депозите (0-100)
  bankTransferCommission?: number // % комиссии за перевод (0-100)
  bankCreditRate?: number      // % ставки по кредиту (0-100)
}

export interface ChatMessage {
  id?: string
  userId: string            // nickname
  nickname: string
  avatarUrl: string
  text: string
  type: 'user' | 'system' | 'broadcast'
  createdAt: number
}

export interface LeaderboardEntry {
  nickname: string
  avatarUrl: string
  totalWon: number
  balance: number
}

export interface LiveEvent {
  id?: string
  nickname: string
  avatarUrl: string
  game: string
  bet: number
  payout: number
  result: 'win' | 'lose' | 'push'
  createdAt: number
}

/** Мультиплеер */
export type RoomStatus = 'waiting' | 'betting' | 'playing' | 'dealerTurn' | 'ended'
export type PlayerStatus = 'ready' | 'betting' | 'acting' | 'stay' | 'bust' | 'folded'

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  value: string
  rank: number
}

export interface RoomPlayer {
  uid: string
  nickname: string
  avatarUrl: string
  seat: number
  bet: number
  cards: Card[]
  status: PlayerStatus
  lastSeen: number
  luck: number // <--- Добавлено
}

export interface MultiplayerRoom {
  id: string
  gameType: GameType
  status: RoomStatus
  host: string
  turn: string | null // никнейм игрока, который сейчас ходит
  timer: number | null // timestamp окончания хода
  deck?: string[] // колода
  dealer?: {
    cards: Card[]
    score: number
  }
  players: Record<string, RoomPlayer>
  minBet: number
  maxPlayers: number
  winNumber?: number | null // для рулетки
  crashPoint?: number | null // для краша
  startTime?: number | null // для синхронизации краша
  createdAt: number
}

