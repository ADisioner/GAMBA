"use client"

import { useState } from "react"
import { Header } from "@/components/casino/header"
import { HeroSection } from "@/components/casino/hero-section"
import { FeaturedGames } from "@/components/casino/featured-games"
import { Footer } from "@/components/casino/footer"

export default function CasinoPage() {
  const [language, setLanguage] = useState<"en" | "ru">("en")
  const [balance] = useState({ chips: 50000, credits: 125.50 })

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Marble texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/20 via-transparent to-transparent" />
      </div>
      
      {/* Ambient lighting effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-velvet/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gold/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Header 
          language={language} 
          setLanguage={setLanguage} 
          balance={balance}
        />
        <main>
          <HeroSection language={language} />
          <FeaturedGames language={language} />
        </main>
        <Footer language={language} />
      </div>
    </div>
  )
}
