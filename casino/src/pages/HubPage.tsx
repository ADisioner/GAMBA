import { motion } from 'framer-motion'
import { Sparkles, Dice5, Shield, Lock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function HubPage() {
  const navigate = useNavigate()

  const projects = [
    {
      id: 'casino',
      title: 'Casino Lobby',
      description: 'Испытайте удачу в нашем премиальном казино с уникальными слотами и играми.',
      icon: <Dice5 className="w-8 h-8 text-gold" />,
      path: '/lobby',
      enabled: true,
      label: 'Играть'
    },
    {
      id: 'pmc',
      title: 'PMC Tycoon',
      description: 'Управляйте собственной ЧВК, выполняйте опасные контракты и доминируйте на рынке.',
      icon: <Shield className="w-8 h-8 text-gold" />,
      path: '/pmc',
      enabled: true,
      label: 'В бой'
    },
    {
      id: 'future',
      title: 'Coming Soon',
      description: 'Новый секретный проект уже в разработке. Следите за обновлениями.',
      icon: <Lock className="w-8 h-8 text-gold/40" />,
      path: '#',
      enabled: false,
      label: 'Скоро'
    }
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative p-6">
      {/* Логотип */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h1 className="font-serif text-6xl font-bold tracking-tighter mb-2">
          <span className="bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">GAMBA</span>
        </h1>
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-[1px] bg-gold/30" />
          <Sparkles className="w-4 h-4 text-gold/50 animate-pulse" />
          <div className="w-12 h-[1px] bg-gold/30" />
        </div>
        <p className="text-muted-foreground mt-4 font-display tracking-widest text-xs uppercase">Выберите ваш путь</p>
      </motion.div>

      {/* Сетка карточек */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        {projects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            className={`group relative ${!project.enabled && 'opacity-60 cursor-not-allowed'}`}
          >
            {/* Свечение при наведении */}
            <div className="absolute -inset-0.5 bg-gradient-to-b from-gold/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
            
            <div className={`relative h-full bg-card/40 backdrop-blur-xl border ${project.enabled ? 'border-gold/20' : 'border-white/5'} rounded-2xl p-8 flex flex-col items-center text-center transition-all duration-300 group-hover:translate-y-[-4px]`}>
              <div className={`mb-6 p-4 rounded-full bg-gold/5 border border-gold/10 group-hover:border-gold/30 transition-colors`}>
                {project.icon}
              </div>
              
              <h2 className="font-serif text-2xl font-bold text-foreground mb-3">{project.title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-grow">
                {project.description}
              </p>

              <Button
                onClick={() => project.enabled && navigate(project.path)}
                disabled={!project.enabled}
                className={`w-full group/btn ${project.enabled ? 'bg-gold hover:bg-gold-dark text-velvet-dark font-bold' : 'bg-white/5 text-muted-foreground'}`}
              >
                {project.label}
                {project.enabled && (
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                )}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
