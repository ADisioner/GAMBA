"use client"

import { Play, Sparkles } from "lucide-react"
import { RouletteWheel } from "./roulette-wheel"

interface HeroSectionProps {
  language: "en" | "ru"
}

const translations = {
  en: {
    tagline: "Experience the Ultimate",
    title: "Luxury Casino",
    subtitle: "Enter a world of elegance and fortune. Premium games, exclusive rewards, and the thrill of Monte Carlo at your fingertips.",
    playNow: "Play Now",
    freeDemo: "Free Demo",
  },
  ru: {
    tagline: "Испытайте Невероятное",
    title: "Люкс Казино",
    subtitle: "Войдите в мир элегантности и удачи. Премиум игры, эксклюзивные награды и волнение Монте-Карло у вас под рукой.",
    playNow: "Играть",
    freeDemo: "Демо",
  },
}

export function HeroSection({ language }: HeroSectionProps) {
  const t = translations[language]

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        {/* Crystal chandelier effect - top center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-32 bg-gradient-to-b from-gold/40 to-transparent" />
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-pulse"
              style={{
                left: `${20 + i * 10}%`,
                top: `${80 + Math.sin(i) * 30}px`,
                animationDelay: `${i * 0.2}s`,
              }}
            >
              <div className="w-1 h-16 bg-gradient-to-b from-gold/30 to-transparent" />
              <div className="w-3 h-3 rounded-full bg-gold/40 blur-sm -mt-1" />
            </div>
          ))}
        </div>

        {/* Spotlight effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/10 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-velvet/30 border border-gold/30 mb-6">
              <Sparkles className="w-4 h-4 text-gold animate-pulse" />
              <span className="text-sm text-gold-light font-medium">{t.tagline}</span>
            </div>

            <h2 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block text-foreground">{t.title}</span>
              <span className="block bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">
                GAMBA
              </span>
            </h2>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              {t.subtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button className="group relative px-8 py-4 rounded-lg font-semibold text-lg overflow-hidden transition-all duration-500 hover:scale-105">
                {/* Button background */}
                <div className="absolute inset-0 bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-lg" />
                <div className="absolute inset-[2px] bg-gradient-to-r from-velvet-dark via-velvet to-velvet-dark rounded-[6px] group-hover:opacity-0 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-gold-dark via-gold to-gold-light opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg" />
                
                {/* Button content */}
                <span className="relative flex items-center justify-center gap-2 text-gold group-hover:text-primary-foreground transition-colors duration-500">
                  <Play className="w-5 h-5 fill-current" />
                  {t.playNow}
                </span>

                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              </button>

              <button className="group relative px-8 py-4 rounded-lg font-semibold text-lg border-2 border-gold/50 hover:border-gold text-gold hover:text-gold-light transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                <span className="relative flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  {t.freeDemo}
                </span>
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-10 opacity-60">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">18+</div>
              <div className="w-[1px] h-4 bg-gold/30" />
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Simulator Only</div>
              <div className="w-[1px] h-4 bg-gold/30" />
              <div className="text-xs text-muted-foreground uppercase tracking-wider">No Real Money</div>
            </div>
          </div>

          {/* Roulette Wheel */}
          <div className="order-1 lg:order-2 flex justify-center">
            <RouletteWheel />
          </div>
        </div>
      </div>
    </section>
  )
}
