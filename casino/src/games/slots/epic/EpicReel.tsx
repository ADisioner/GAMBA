import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { EPIC_SYMBOLS } from './paylines'
import type { SymbolType } from './paylines'

interface EpicReelProps {
  spinning: boolean;
  finalSymbols: SymbolType[]; // 3 symbols for this column
  delay: number;
  onStop: () => void;
  index: number;
}

export function EpicReel({ spinning, finalSymbols, delay, onStop, index }: EpicReelProps) {
  const [internalSpinning, setInternalSpinning] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  
  // Мы будем анимировать ленту. Каждый символ ~100px высотой.
  // Всего в ленте 24 символа (за 5 секунд успеет прокрутиться много раз).
  // Финальные 3 символа будут на позициях 20, 21, 22.
  const [strip, setStrip] = useState<SymbolType[]>(
    Array(3).fill('?').map(() => EPIC_SYMBOLS[Math.floor(Math.random() * EPIC_SYMBOLS.length)])
  )

  useEffect(() => {
    if (spinning) {
      setInternalSpinning(true)
      setIsStopping(false)
      
      const newStrip = Array(30).fill('?').map(() => EPIC_SYMBOLS[Math.floor(Math.random() * EPIC_SYMBOLS.length)])
      // Задаем выигрышные символы. В CSS сетке они будут видны в "окне" 3x1.
      newStrip[25] = finalSymbols[0] // Верх
      newStrip[26] = finalSymbols[1] // Центр
      newStrip[27] = finalSymbols[2] // Низ
      setStrip(newStrip)

      const stopTimeout = setTimeout(() => {
        setIsStopping(true)
        setInternalSpinning(false)
        setTimeout(onStop, 600) // Резиновая остановка
      }, 1000 + delay)

      return () => clearTimeout(stopTimeout)
    }
  }, [spinning, finalSymbols, delay, onStop])

  // Высота одного символа для мобилок и десктопов
  const getSymbolHeight = () => typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 110;

  // Рассчитываем конечный отступ, чтобы 25-27 индексы были по центру
  // В контейнере высотой в 3 символа, первый видимый должен быть под номером 25.
  // Смещение = -25 * высота символа
  const yFinalOffset = -25 * getSymbolHeight();

  return (
    <div className="relative w-20 sm:w-28 h-[240px] sm:h-[330px] overflow-hidden rounded-lg bg-black/60 shadow-inner border-x border-white/5">
      {/* Стекло над барабаном */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 z-20 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" />
      
      <motion.div
        animate={
          internalSpinning 
          ? { 
              y: [0, -2500], 
              transition: { duration: 1.2, ease: "linear", repeat: Infinity } 
            } 
          : isStopping 
          ? { 
              y: yFinalOffset,
              transition: { type: "spring", damping: 14, stiffness: 80, mass: 0.8 } 
            } 
          : { y: 0 }
        }
        className="flex flex-col items-center"
        initial={{ y: 0 }}
      >
        {strip.map((sym, i) => (
          <div 
            key={i} 
            className="w-20 sm:w-28 h-[80px] sm:h-[110px] flex items-center justify-center text-4xl sm:text-5xl select-none"
          >
            <span className={isStopping && i >= 25 && i <= 27 ? 'drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]' : 'opacity-60 grayscale-[0.3]'}>
              {sym === '🃏' ? <span className="text-yellow-400 drop-shadow-[0_0_10px_#facc15]">{sym}</span> : sym}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
