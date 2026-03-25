"use client"

import { Coins, User, History, LayoutGrid, Home, Menu, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  language: "en" | "ru"
  setLanguage: (lang: "en" | "ru") => void
  balance: { chips: number; credits: number }
}

const translations = {
  en: {
    games: "Games",
    lobby: "Lobby",
    balance: "Balance",
    profile: "Profile",
    history: "History",
  },
  ru: {
    games: "Игры",
    lobby: "Лобби",
    balance: "Баланс",
    profile: "Профиль",
    history: "История",
  },
}

export function Header({ language, setLanguage, balance }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const t = translations[language]

  const navItems = [
    { icon: LayoutGrid, label: t.games },
    { icon: Home, label: t.lobby },
    { icon: Coins, label: t.balance },
    { icon: User, label: t.profile },
    { icon: History, label: t.history },
  ]

  return (
    <header className="relative z-50">
      {/* Top accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
      
      <nav className="bg-marble/80 backdrop-blur-xl border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-wider">
                <span className="bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(212,175,55,0.4)]">
                  GAMBA
                </span>
              </h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className="group relative px-4 py-2 text-sm font-medium text-foreground/80 hover:text-gold transition-colors duration-300"
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-gold/70 group-hover:text-gold transition-colors" />
                    {item.label}
                  </span>
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </div>

            {/* Balance Display & Language Toggle */}
            <div className="hidden md:flex items-center gap-4">
              {/* Balance */}
              <div className="relative px-4 py-2 rounded-lg bg-marble-light/50 border border-gold/30 shadow-[inset_0_1px_0_rgba(212,175,55,0.1)]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center shadow-md">
                      <span className="text-xs font-bold text-primary-foreground">$</span>
                    </div>
                    <span className="text-sm font-semibold text-gold-light">
                      {balance.chips.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-[1px] h-4 bg-gold/30" />
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-gold" />
                    <span className="text-sm font-semibold text-gold-light">
                      ${balance.credits.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Language Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gold/30">
                <button
                  onClick={() => setLanguage("en")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-all duration-300",
                    language === "en"
                      ? "bg-gold text-primary-foreground"
                      : "bg-transparent text-foreground/60 hover:text-gold"
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage("ru")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-all duration-300",
                    language === "ru"
                      ? "bg-gold text-primary-foreground"
                      : "bg-transparent text-foreground/60 hover:text-gold"
                  )}
                >
                  RU
                </button>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gold hover:text-gold-light transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-marble/95 backdrop-blur-xl border-t border-gold/20">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className="flex items-center gap-3 w-full px-4 py-3 text-foreground/80 hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
                >
                  <item.icon className="w-5 h-5 text-gold/70" />
                  {item.label}
                </button>
              ))}
              <div className="pt-4 border-t border-gold/20">
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">$</span>
                    </div>
                    <span className="text-sm font-semibold text-gold-light">
                      {balance.chips.toLocaleString()} chips
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLanguage("en")}
                      className={cn(
                        "px-2 py-1 text-xs rounded",
                        language === "en" ? "bg-gold text-primary-foreground" : "text-foreground/60"
                      )}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setLanguage("ru")}
                      className={cn(
                        "px-2 py-1 text-xs rounded",
                        language === "ru" ? "bg-gold text-primary-foreground" : "text-foreground/60"
                      )}
                    >
                      RU
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
