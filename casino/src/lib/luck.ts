import { clamp, randomInRange } from './utils'

/**
 * Система скрытой удачи (Hidden Luck System)
 *
 * Параметр luck влияет на вероятности выигрыша, но незаметен для игрока.
 * Диапазон: 0.85 (невезучий) – 1.15 (везучий), нейтраль = 1.0
 */

const LUCK_MIN = 0.85
const LUCK_MAX = 1.15
const LUCK_DEFAULT = 1.0
const LUCK_DRIFT = 0.02 // Максимальное изменение за обновление
const GAMES_PER_LUCK_UPDATE = 10 // Обновляем luck каждые N игр

/** Начальное значение luck для нового игрока */
export function getInitialLuck(): number {
  return LUCK_DEFAULT
}

/**
 * Обновляет luck после очередной порции игр.
 * Luck дрейфует случайно, медленно и незаметно.
 */
export function updateLuck(currentLuck: number, gamesPlayed: number): number {
  // Обновляем только каждые N игр
  if (gamesPlayed % GAMES_PER_LUCK_UPDATE !== 0) {
    return currentLuck
  }

  const drift = randomInRange(-LUCK_DRIFT, LUCK_DRIFT)
  return clamp(currentLuck + drift, LUCK_MIN, LUCK_MAX)
}

/**
 * Применяет luck к базовой вероятности.
 * Пример: baseChance = 0.3, luck = 1.1 → 0.33
 */
export function applyLuck(baseChance: number, luck: number): number {
  return clamp(baseChance * luck, 0, 1)
}

/**
 * Генерирует crash-множитель с учётом luck.
 * Чем выше luck, тем позже crash.
 */
export function generateCrashMultiplier(luck: number, houseEdge: number): number {
  const effectiveHouseEdge = houseEdge / luck
  const random = Math.random()

  // Формула: e / (1 - r * (1 - e)) где e — house edge
  if (random >= 1 - effectiveHouseEdge) {
    return 1.0 // Instant crash
  }

  return Math.max(1, (1 - effectiveHouseEdge) / (1 - random))
}

export { LUCK_MIN, LUCK_MAX, GAMES_PER_LUCK_UPDATE }
