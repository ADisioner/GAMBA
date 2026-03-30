import { useState, useEffect, useRef } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { sounds } from '@/lib/sounds'
import { EPIC_SYMBOLS } from './paylines'
import type { SymbolType as SymType } from './paylines'

interface EpicReelProps {
  spinning: boolean;
  finalSymbols: SymType[]; 
  delay: number;
  onStop: () => void;
  index: number;
  highlightedRows?: number[]; // [0, 1, 2]
}

/** Генерирует случайный стрип из 30 символов с финальными на позициях 25-27 */
function buildStrip(finalSymbols: SymType[]): SymType[] {
  const strip = Array(30).fill(null).map(() =>
    EPIC_SYMBOLS[Math.floor(Math.random() * EPIC_SYMBOLS.length)]
  ) as SymType[]
  strip[25] = finalSymbols[0]
  strip[26] = finalSymbols[1]
  strip[27] = finalSymbols[2]
  return strip
}

function getSymbolHeight() {
  return typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 110
}

export function EpicReel({ spinning, finalSymbols, delay, onStop, index, highlightedRows = [] }: EpicReelProps) {
  const controls = useAnimationControls()
  const [isStopping, setIsStopping] = useState(false)
  const [strip, setStrip] = useState<SymType[]>(() => buildStrip(finalSymbols))
  const prevSpinningRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const yFinalOffset = -25 * getSymbolHeight()

  // Позиционируем на финальных символах при mount
  useEffect(() => {
    controls.set({ y: yFinalOffset })
  }, [])

  useEffect(() => {
    const wasSpinning = prevSpinningRef.current
    prevSpinningRef.current = spinning

    // Очистка предыдущего цикла при каждом изменении
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    // Ловим переход false → true (начало нового спина)
    if (spinning && !wasSpinning) {
      setIsStopping(false)

      // Новый стрип с финальными символами
      const newStrip = buildStrip(finalSymbols)
      setStrip(newStrip)

      // Мгновенно перемещаем на старт, затем запускаем анимацию прокрутки
      controls.set({ y: 0 })
      controls.start({
        y: [0, -2500],
        transition: { duration: 1, ease: 'linear', repeat: Infinity }
      })

      // Звуковые тики
      const tickInterval = setInterval(() => {
        sounds.slotTick()
      }, 120)

      // Остановка через delay
      const stopTimeout = setTimeout(() => {
        clearInterval(tickInterval)
        setIsStopping(true)
        sounds.slotStop()

        // Плавная остановка на финальных символах
        controls.start({
          y: yFinalOffset,
          transition: { type: 'spring', damping: 12, stiffness: 60, mass: 1 }
        })

        setTimeout(onStop, 600)
      }, 1000 + delay)

      cleanupRef.current = () => {
        clearInterval(tickInterval)
        clearTimeout(stopTimeout)
      }
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [spinning, finalSymbols, delay, onStop, controls, yFinalOffset])

  return (
    <div className="relative w-20 sm:w-32 h-[240px] sm:h-[330px] overflow-hidden rounded-xl bg-black/60 shadow-inner border-x border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/10 to-black/90 z-20 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]" />
      
      <motion.div
        animate={controls}
        className="flex flex-col items-center"
      >
        {strip.map((sym, i) => {
          const rowIdx = i - 25; // 0, 1, 2 для видимой области
          const isHighlighted = highlightedRows.includes(rowIdx);
          
          return (
            <div 
              key={i} 
              className={`w-20 sm:w-32 h-[80px] sm:h-[110px] flex items-center justify-center text-4xl sm:text-6xl select-none transition-all duration-300 ${
                isHighlighted ? 'scale-125 z-30' : ''
              }`}
            >
              <span className={`
                transition-all duration-500
                ${isStopping && i >= 25 && i <= 27 ? 'drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]' : 'opacity-40 grayscale-[0.5]'}
                ${isHighlighted ? '!opacity-100 !grayscale-0 brightness-150 drop-shadow-[0_0_30px_#facc15]' : ''}
              `}>
                {sym === '🃏' ? <span className="text-yellow-400 drop-shadow-[0_0_15px_#facc15]">{sym}</span> : sym}
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  )
}
