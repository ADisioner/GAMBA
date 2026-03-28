import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const SUITS = ['♠', '♥', '♣', '♦']

interface Particle {
  id: number
  x: number
  size: number
  duration: number
  delay: number
  isSuit: boolean
  suit: string
  opacityPulse: number
}

export function ParticleBackground() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    // Генерируем частицы только на клиенте
    const newParticles: Particle[] = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // %
      size: Math.random() * 4 + 1, // px
      duration: Math.random() * 25 + 25, // сек
      delay: Math.random() * -30, // старт со сдвигом, чтобы экран не был пустым
      isSuit: i % 5 === 0, // Каждая 5-я частица - это масть
      suit: SUITS[Math.floor(Math.random() * SUITS.length)],
      opacityPulse: Math.random() * 0.3 + 0.1 // 0.1 - 0.4
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Лёгкое центральное свечение */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12)_0%,transparent_80%)]" />
      
      {/* Частицы */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className={`absolute ${p.isSuit ? 'text-gold flex items-center justify-center font-serif leading-none' : 'bg-gold rounded-full blur-[1px]'}`}
          style={{
            left: `${p.x}vw`,
            bottom: `-10vh`,
            width: p.isSuit ? 'auto' : p.size,
            height: p.isSuit ? 'auto' : p.size,
            fontSize: p.isSuit ? `${p.size * 15 + 20}px` : 'inherit',
          }}
          animate={{
            y: [0, '-120vh'], // Плывут снизу вверх
            x: [0, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50], // Легкое покачивание
            rotate: p.isSuit ? [0, 180, 360] : 0, // Вращение карт
            opacity: p.isSuit ? [0, 0.15, 0] : [0, p.opacityPulse * 1.5, 0] // Плавное появление и затухание
          }}
          transition={{
            y: { duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay },
            x: { duration: p.duration * 0.8, repeat: Infinity, ease: 'easeInOut', delay: p.delay, repeatType: 'mirror' },
            rotate: { duration: p.duration * 1.5, repeat: Infinity, ease: 'linear', delay: p.delay },
            opacity: { duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay }
          }}
        >
          {p.isSuit && p.suit}
        </motion.div>
      ))}
    </div>
  )
}
