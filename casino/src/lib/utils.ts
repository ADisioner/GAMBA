import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Комбинирует классы Tailwind без конфликтов */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Форматирует число как баланс: 50000 → "$50,000" */
export function formatBalance(amount: number): string {
  return '$' + amount.toLocaleString('en-US')
}

/** Форматирует число в компактный вид: 1500000 → "$1.5 млн" */
export function formatCompactBalance(amount: number): string {
  const formatter = new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  })
  return '$' + formatter.format(amount).replace(' ', ' ') // Заменяем неразрывный пробел
}

/** Динамический формат: полное число до 100 млн, дальше - компактно */
export function formatDynamicBalance(amount: number): string {
  if (amount >= 100_000_000) return formatCompactBalance(amount)
  return formatBalance(amount)
}

/** Задержка в мс */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Генерирует случайное число в диапазоне [min, max] */
export function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/** Clamp значение в диапазон */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Генерирует случайный никнейм */
export function generateNickname(displayName: string | null): string {
  if (displayName) {
    return displayName.split(' ')[0] + Math.floor(Math.random() * 999)
  }
  return 'Player' + Math.floor(Math.random() * 9999)
}
