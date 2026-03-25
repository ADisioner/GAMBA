"use client"

import { Sparkles, Play, Crown, Diamond, Spade, Heart, Club, CircleDot, Dice5, Star } from "lucide-react"

interface FeaturedGamesProps {
  language: "en" | "ru"
}

const translations = {
  en: {
    title: "Featured Games",
    subtitle: "Choose your game and test your fortune",
    playNow: "Play",
    popular: "Popular",
    newGame: "New",
    exclusive: "VIP",
    games: {
      slots: { name: "Golden Slots", description: "Premium slot machines" },
      roulette: { name: "Royal Roulette", description: "Classic European" },
      blackjack: { name: "Blackjack Elite", description: "Beat the dealer" },
      baccarat: { name: "Baccarat Royale", description: "High stakes elegance" },
      poker: { name: "Texas Hold'em", description: "Tournament poker" },
      craps: { name: "Diamond Craps", description: "Roll the dice" },
    },
  },
  ru: {
    title: "Избранные Игры",
    subtitle: "Выберите игру и испытайте удачу",
    playNow: "Играть",
    popular: "Популярно",
    newGame: "Новинка",
    exclusive: "VIP",
    games: {
      slots: { name: "Золотые Слоты", description: "Премиум автоматы" },
      roulette: { name: "Королевская Рулетка", description: "Классическая Европейская" },
      blackjack: { name: "Блэкджек Элит", description: "Обыграй дилера" },
      baccarat: { name: "Баккара Рояль", description: "Высокие ставки" },
      poker: { name: "Техасский Холдем", description: "Турнирный покер" },
      craps: { name: "Бриллиантовый Крэпс", description: "Бросай кости" },
    },
  },
}

interface GameCardProps {
  name: string
  description: string
  icon: React.ReactNode
  badge?: string
  badgeType?: "popular" | "new" | "vip"
  gradient: string
  playText: string
}

function GameCard({ name, description, icon, badge, badgeType, gradient, playText }: GameCardProps) {
  return (
    <div className="group relative">
      {/* Card glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-gold/0 via-gold/30 to-gold/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      
      <div className="relative h-full bg-marble-light/50 backdrop-blur-sm rounded-xl border border-gold/20 overflow-hidden transition-all duration-500 group-hover:border-gold/50 group-hover:shadow-[0_10px_40px_-10px_rgba(212,175,55,0.3)]">
        {/* Top gradient bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />
        
        {/* Badge */}
        {badge && (
          <div className="absolute top-4 right-4">
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                badgeType === "vip"
                  ? "bg-gradient-to-r from-gold-dark to-gold text-primary-foreground"
                  : badgeType === "new"
                  ? "bg-velvet text-white"
                  : "bg-marble text-gold border border-gold/30"
              }`}
            >
              {badge}
            </span>
          </div>
        )}

        <div className="p-6">
          {/* Icon container */}
          <div className="relative w-16 h-16 mb-4">
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
            <div className="relative w-full h-full rounded-xl bg-marble/50 border border-gold/20 flex items-center justify-center group-hover:border-gold/40 transition-colors">
              <div className="text-gold group-hover:text-gold-light transition-colors group-hover:scale-110 transform duration-300">
                {icon}
              </div>
            </div>
            {/* Sparkle effect */}
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
          </div>

          {/* Content */}
          <h3 className="font-serif text-xl font-semibold text-foreground group-hover:text-gold-light transition-colors mb-1">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">{description}</p>

          {/* Play button */}
          <button className="w-full py-3 rounded-lg bg-gradient-to-r from-marble via-marble-light to-marble border border-gold/30 text-gold font-semibold text-sm flex items-center justify-center gap-2 group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all duration-300">
            <Play className="w-4 h-4 fill-current" />
            {playText}
          </button>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  )
}

export function FeaturedGames({ language }: FeaturedGamesProps) {
  const t = translations[language]

  const games = [
    {
      key: "slots",
      icon: <Crown className="w-8 h-8" />,
      badge: t.popular,
      badgeType: "popular" as const,
      gradient: "from-gold-dark via-gold to-gold-light",
    },
    {
      key: "roulette",
      icon: <CircleDot className="w-8 h-8" />,
      badge: t.exclusive,
      badgeType: "vip" as const,
      gradient: "from-velvet-dark via-velvet to-red-500",
    },
    {
      key: "blackjack",
      icon: <Spade className="w-8 h-8" />,
      badge: t.popular,
      badgeType: "popular" as const,
      gradient: "from-gray-700 via-gray-600 to-gray-500",
    },
    {
      key: "baccarat",
      icon: <Diamond className="w-8 h-8" />,
      badge: t.newGame,
      badgeType: "new" as const,
      gradient: "from-blue-900 via-blue-700 to-blue-500",
    },
    {
      key: "poker",
      icon: <Heart className="w-8 h-8" />,
      badge: undefined,
      badgeType: undefined,
      gradient: "from-red-900 via-red-700 to-red-500",
    },
    {
      key: "craps",
      icon: <Dice5 className="w-8 h-8" />,
      badge: t.newGame,
      badgeType: "new" as const,
      gradient: "from-emerald-900 via-emerald-700 to-emerald-500",
    },
  ]

  return (
    <section className="relative py-20 sm:py-32">
      {/* Section background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-marble/50 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-gold" />
            <span className="text-sm text-gold font-medium uppercase tracking-widest">
              {language === "en" ? "Premium Collection" : "Премиум Коллекция"}
            </span>
            <Star className="w-5 h-5 text-gold" />
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-4">
            {t.title}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-gold" />
            <Club className="w-4 h-4 text-gold" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-gold" />
          </div>
        </div>

        {/* Games grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.key}
              name={t.games[game.key as keyof typeof t.games].name}
              description={t.games[game.key as keyof typeof t.games].description}
              icon={game.icon}
              badge={game.badge}
              badgeType={game.badgeType}
              gradient={game.gradient}
              playText={t.playNow}
            />
          ))}
        </div>

        {/* View all link */}
        <div className="text-center mt-12">
          <button className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gold/40 text-gold hover:border-gold hover:text-gold-light hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all duration-300">
            <span className="font-medium">
              {language === "en" ? "View All Games" : "Все Игры"}
            </span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
