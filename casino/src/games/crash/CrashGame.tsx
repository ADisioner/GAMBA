import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { generateCrashMultiplier } from '@/lib/luck'
import { sounds } from '@/lib/sounds'
import type { GameResult } from '@/types'

interface Props {
  bet: number; luck: number; houseEdge: number; balance: number
  onResult: (result: GameResult, payout: number, details: Record<string, unknown>) => Promise<void>
}

export function CrashGame({ bet, luck, houseEdge, balance, onResult }: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'crashed' | 'cashed'>('idle')
  const [multiplier, setMultiplier] = useState(1.00)
  const [crashPoint, setCrashPoint] = useState(0)
  const [cashedAt, setCashedAt] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const animRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  const start = useCallback(() => {
    if (bet > balance || state === 'running') return
    sounds.bet()
    const cp = generateCrashMultiplier(luck, houseEdge)
    setCrashPoint(cp)
    setMultiplier(1.00)
    setCashedAt(0)
    setState('running')
    startRef.current = Date.now()
    let lastTickAt = 0

    function animate() {
      const elapsed = (Date.now() - startRef.current) / 1000
      const current = Math.pow(Math.E, elapsed * 0.15)
      setMultiplier(parseFloat(current.toFixed(2)))

      // Звук тика каждые 300мс
      if (Date.now() - lastTickAt > 300) {
        sounds.crashTick(current)
        lastTickAt = Date.now()
      }

      if (current >= cp) {
        setMultiplier(parseFloat(cp.toFixed(2)))
        setState('crashed')
        sounds.crashExplode()
        setHistory(prev => [parseFloat(cp.toFixed(2)), ...prev].slice(0, 10))
        onResult('lose', 0, { crashPoint: cp, cashedAt: 0 })
        return
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
  }, [bet, balance, luck, houseEdge, state, onResult])

  const cashOut = useCallback(() => {
    if (state !== 'running') return
    cancelAnimationFrame(animRef.current)
    sounds.cashOut()
    setCashedAt(multiplier)
    setState('cashed')
    const payout = Math.floor(bet * multiplier)
    setHistory(prev => [parseFloat(crashPoint.toFixed(2)), ...prev].slice(0, 10))
    onResult('win', payout, { crashPoint, cashedAt: multiplier })
  }, [state, multiplier, bet, crashPoint, onResult])

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const getColor = () => {
    if (state === 'crashed') return 'text-neon-red'
    if (state === 'cashed') return 'text-neon-green'
    if (multiplier > 5) return 'text-neon-purple'
    if (multiplier > 2) return 'text-gold'
    return 'text-foreground'
  }

  return (
    <div className="p-8 flex flex-col items-center">
      {/* Graph area */}
      <div className="w-full max-w-lg h-64 rounded-xl bg-marble border border-gold/20 flex items-center justify-center mb-6 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-gold/30" style={{ top: `${(i + 1) * 20}%` }} />
          ))}
        </div>

        {state === 'idle' ? (
          <p className="text-muted-foreground">Нажмите «Старт» для начала</p>
        ) : (
          <motion.div animate={state === 'crashed' ? { scale: [1, 1.2, 0.9] } : {}}
            className="text-center">
            <p className={`text-6xl font-bold ${getColor()} transition-colors`}>
              {multiplier.toFixed(2)}×
            </p>
            {state === 'crashed' && <p className="text-neon-red text-lg mt-2 font-bold">💥 CRASH!</p>}
            {state === 'cashed' && (
              <p className="text-neon-green text-lg mt-2 font-bold">
                ✅ +{Math.floor(bet * cashedAt).toLocaleString()} фишек
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        {state === 'idle' || state === 'crashed' || state === 'cashed' ? (
          <Button onClick={start} size="xl" disabled={bet > balance} className="w-48">
            🚀 СТАРТ
          </Button>
        ) : (
          <Button onClick={cashOut} size="xl" variant="neon" className="w-48 animate-pulse">
            💰 ЗАБРАТЬ ({(bet * multiplier).toFixed(0)})
          </Button>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center">
          {history.map((h, i) => (
            <span key={i} className={`px-3 py-1 rounded-full text-xs font-bold ${h < 2 ? 'bg-neon-red/20 text-neon-red' : 'bg-neon-green/20 text-neon-green'}`}>
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
