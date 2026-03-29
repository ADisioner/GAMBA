import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ref, onValue, query, limitToLast } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { formatDynamicBalance } from '@/lib/utils'
import type { LiveEvent } from '@/types'

export function LiveFeedSidebar() {
  const [events, setEvents] = useState<LiveEvent[]>([])

  useEffect(() => {
    const eventsRef = query(ref(rtdb, 'live_events'), limitToLast(20))
    return onValue(eventsRef, (snap) => {
      const data = snap.val()
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...(val as any) }))
          .sort((a, b) => b.createdAt - a.createdAt)
        setEvents(list)
      }
    })
  }, [])

  return (
    <aside className="w-80 hidden xl:flex flex-col border-l border-gold/10 bg-card/30 backdrop-blur-md sticky top-0 h-screen">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="h-20 border-b border-gold/20 flex items-center justify-between px-4 bg-gold/5 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gold animate-pulse" />
          <h2 className="font-serif text-sm font-bold tracking-wider uppercase text-foreground">Live Feed</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          <AnimatePresence initial={false}>
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-20 italic text-xs">
                Ожидание ставок...
              </div>
            ) : (
              events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative"
                >
                  <div className={`p-3 rounded-lg border bg-card/50 transition-all duration-300 group-hover:bg-card/80 ${
                    event.result === 'win' ? 'border-emerald-500/20 shadow-emerald-500/5' : 
                    event.result === 'push' ? 'border-gold/20' : 
                    'border-red-500/10'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <img src={event.avatarUrl} alt="" className="w-5 h-5 rounded-full bg-marble ring-1 ring-gold/20" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{event.nickname}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase opacity-60">
                         {event.game}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-muted-foreground leading-none">Выплата</div>
                        <div className={`text-sm font-bold font-mono tracking-tight ${
                          event.result === 'win' ? 'text-emerald-400' : 
                          event.result === 'push' ? 'text-gold' : 
                          'text-muted-foreground'
                        }`}>
                          {event.result === 'win' && '+'}
                          {formatDynamicBalance(event.payout)}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        {event.result === 'win' ? (
                          <div className="bg-emerald-500/10 p-1 rounded">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : event.result === 'push' ? (
                           <div className="bg-gold/10 p-1 rounded">
                            <Minus className="w-4 h-4 text-gold" />
                          </div>
                        ) : (
                          <div className="bg-red-500/10 p-1 rounded">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
      </div>
    </aside>
  )
}
