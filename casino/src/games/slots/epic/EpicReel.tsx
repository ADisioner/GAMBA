import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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

export function EpicReel({ spinning, finalSymbols, delay, onStop, index, highlightedRows = [] }: EpicReelProps) {
  const [internalSpinning, setInternalSpinning] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  
  // Инициализируем strip сразу из 28 элементов, чтобы при y=-2750 (позиция 25-27) были видны символы
  const [strip, setStrip] = useState<SymType[]>(() => {
    const initial = Array(28).fill('?').map(() => EPIC_SYMBOLS[Math.floor(Math.random() * EPIC_SYMBOLS.length)]) as SymType[]
    initial[25] = finalSymbols[0]
    initial[26] = finalSymbols[1]
    initial[27] = finalSymbols[2]
    return initial
  })

  useEffect(() => {
    if (spinning) {
      setInternalSpinning(true)
      setIsStopping(false)
      
      const newStrip = Array(30).fill('?').map(() => EPIC_SYMBOLS[Math.floor(Math.random() * EPIC_SYMBOLS.length)]) as SymType[]
      newStrip[25] = finalSymbols[0] 
      newStrip[26] = finalSymbols[1] 
      newStrip[27] = finalSymbols[2] 
      setStrip(newStrip)

      // Sound ticking
      const tickInterval = setInterval(() => {
        sounds.slotTick()
      }, 120)

      const stopTimeout = setTimeout(() => {
        clearInterval(tickInterval)
        setIsStopping(true)
        setInternalSpinning(false)
        sounds.slotStop() // Final stop sound
        setTimeout(onStop, 600) 
      }, 1000 + delay)

      return () => {
        clearInterval(tickInterval)
        clearTimeout(stopTimeout)
      }
    }
  }, [spinning, finalSymbols, delay, onStop])

  const getSymbolHeight = () => typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 110;
  const yFinalOffset = -25 * getSymbolHeight();

  return (
    <div className="relative w-20 sm:w-32 h-[240px] sm:h-[330px] overflow-hidden rounded-xl bg-black/60 shadow-inner border-x border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/10 to-black/90 z-20 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]" />
      
      <motion.div
        animate={
          internalSpinning 
          ? { 
              y: [0, -2500], 
              transition: { duration: 1, ease: "linear", repeat: Infinity } 
            } 
          : isStopping 
          ? { 
              y: yFinalOffset,
              transition: { type: "spring", damping: 12, stiffness: 60, mass: 1 } 
            } 
          : { y: yFinalOffset || 0 }
        }
        className="flex flex-col items-center"
        initial={false}  // false = не анимировать mount, сразу показать animate-значение
      >
        {strip.map((sym, i) => {
          const rowIdx = i - 25; // 0, 1, 2 for visible area
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
