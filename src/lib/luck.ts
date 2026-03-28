import { clamp } from './utils'

/**
 * Новая масштабируемая система удачи (Luck 0 - 10+)
 *
 * luck = 0: обычный рандом (честная или базовая игра с houseEdge)
 * luck = 10: почти 100% шанс выигрыша
 * luck < 0: отрицательная удача (подкрутка против игрока)
 */

const LUCK_MIN = -10.0
const LUCK_MAX = 50.0
const LUCK_DEFAULT = 0.0

export function getInitialLuck(): number {
  return LUCK_DEFAULT
}

export function updateLuck(currentLuck: number, _gamesPlayed: number): number {
  return currentLuck
}

/**
 * Применяет luck к базовой вероятности.
 * Формула: 
 * При luck >= 0 -> finalChance = baseChance + (1 - baseChance) * (luck / 10)
 * При luck < 0  -> finalChance = baseChance - baseChance * (|luck| / 10)
 */
export function applyLuck(baseChance: number, luck: number): number {
  if (luck < 0) {
    // Подкрутка против игрока в 2 раза сильнее (теперь 100% проигрыш при luck = -5)
    const penalty = clamp(Math.abs(luck) / 5, 0, 1)
    return clamp(baseChance - baseChance * penalty, 0, 1)
  }
  
  // Подкрутка за игрока в 2 раза слабее (теперь 100% выигрыш при luck = 20)
  const bonus = clamp(luck / 20, 0, 1)
  return clamp(baseChance + (1 - baseChance) * bonus, 0, 1)
}

/** 
 * Генерирует crash-множитель с учётом макро-удачи.
 * При 0 — стандартный график.
 * При 10 — множитель будет космическим.
 */
export function generateCrashMultiplier(luck: number, houseEdge: number): number {
  // Коэффициент удачи для краша теперь тоже слабее/сильнее
  const bonus = luck > 0 ? clamp(luck / 20, 0, 1) : clamp(luck / 5, -1, 0)
  const effectiveHouseEdge = clamp(houseEdge - houseEdge * bonus, 0, 0.99)
  
  const random = Math.random()
  if (random >= 1 - effectiveHouseEdge) return 1.0
  
  let mult = Math.max(1, (1 - effectiveHouseEdge) / (1 - random))
  
  // Дополнительный множитель от удачи (ослаблен в 2 раза для позитивной)
  if (luck > 0) {
    mult += (luck * mult * Math.random() * 0.25)
  } else if (luck < 0) {
    mult *= clamp(1 - (Math.abs(luck) / 5), 0.05, 1)
  }
  
  return mult
}

export { LUCK_MIN, LUCK_MAX }
