/** Типы данных приложения GAMBA */

export interface UserProfile {
  nickname: string          // Уникальный никнейм (=логин)
  passwordHash: string      // Хэш пароля (SHA-256)
  avatarUrl: string         // URL аватара (dicebear)
  balance: number
  luck: number              // 0.85–1.15, скрытый параметр
  totalGamesPlayed: number
  totalWon: number
  totalLost: number
  lastDailyBonus: number | null
  createdAt: number
  updatedAt: number
}

export type GameType = 'slots' | 'roulette' | 'blackjack' | 'crash' | 'mines'

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
