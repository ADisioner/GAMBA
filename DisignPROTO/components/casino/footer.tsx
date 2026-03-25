"use client"

import { Shield, Clock, Heart, HelpCircle } from "lucide-react"

interface FooterProps {
  language: "en" | "ru"
}

const translations = {
  en: {
    responsibleGaming: {
      title: "Responsible Gaming",
      description:
        "GAMBA is a casino simulator for entertainment purposes only. No real money is involved. This is not gambling. Please play responsibly and for fun.",
    },
    disclaimer: {
      title: "Disclaimer",
      text: "This platform does not offer real money gambling. All games are simulations using virtual currency. No financial transactions are processed. Users must be 18+ to access this site.",
    },
    links: {
      about: "About",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      contact: "Contact",
      help: "Help Center",
      faq: "FAQ",
    },
    badges: {
      simulator: "Casino Simulator",
      noMoney: "No Real Money",
      adults: "18+ Only",
      entertainment: "Entertainment Only",
    },
    copyright: "© 2026 GAMBA Casino Simulator. All rights reserved. For entertainment purposes only.",
  },
  ru: {
    responsibleGaming: {
      title: "Ответственная Игра",
      description:
        "GAMBA — симулятор казино исключительно для развлечения. Реальные деньги не используются. Это не азартные игры. Пожалуйста, играйте ответственно и ради удовольствия.",
    },
    disclaimer: {
      title: "Отказ от ответственности",
      text: "Эта платформа не предлагает азартные игры на реальные деньги. Все игры являются симуляциями с использованием виртуальной валюты. Финансовые транзакции не обрабатываются. Пользователи должны быть старше 18 лет.",
    },
    links: {
      about: "О нас",
      terms: "Условия использования",
      privacy: "Политика конфиденциальности",
      contact: "Контакты",
      help: "Центр помощи",
      faq: "Вопросы и ответы",
    },
    badges: {
      simulator: "Симулятор Казино",
      noMoney: "Без Реальных Денег",
      adults: "18+ Только",
      entertainment: "Только Развлечение",
    },
    copyright: "© 2026 GAMBA Симулятор Казино. Все права защищены. Только для развлечения.",
  },
}

export function Footer({ language }: FooterProps) {
  const t = translations[language]

  return (
    <footer className="relative border-t border-gold/20 bg-marble/80 backdrop-blur-xl">
      {/* Top decorative line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Responsible Gaming Banner */}
        <div className="mb-12 p-6 rounded-xl bg-velvet-dark/30 border border-velvet/30">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-velvet/30 border border-velvet/50 flex-shrink-0">
              <Shield className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg font-semibold text-gold mb-1">
                {t.responsibleGaming.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t.responsibleGaming.description}
              </p>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Clock, text: t.badges.simulator },
            { icon: Shield, text: t.badges.noMoney },
            { icon: Heart, text: t.badges.entertainment },
            { icon: HelpCircle, text: t.badges.adults },
          ].map((badge, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-lg bg-marble-light/30 border border-gold/10"
            >
              <badge.icon className="w-5 h-5 text-gold/70" />
              <span className="text-sm text-foreground/80">{badge.text}</span>
            </div>
          ))}
        </div>

        {/* Main Footer Content */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div>
            <h2 className="font-serif text-2xl font-bold bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent mb-4">
              GAMBA
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {t.disclaimer.text}
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.values(t.links).map((link, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-sm text-foreground/60 hover:text-gold transition-colors duration-200"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gold/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              {t.copyright}
            </p>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 text-xs font-bold bg-velvet/40 text-gold rounded-full">
                18+
              </span>
              <span className="text-xs text-muted-foreground">
                {language === "en" ? "Simulator Only" : "Только Симулятор"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-1 bg-gradient-to-r from-velvet-dark via-gold to-velvet-dark" />
    </footer>
  )
}
