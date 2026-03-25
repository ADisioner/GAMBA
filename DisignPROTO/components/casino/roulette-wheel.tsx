"use client"

import { useEffect, useState } from "react"

export function RouletteWheel() {
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)

  // Gentle continuous rotation
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSpinning) {
        setRotation((prev) => prev + 0.5)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [isSpinning])

  const handleSpin = () => {
    if (isSpinning) return
    setIsSpinning(true)
    const spinAmount = 1800 + Math.random() * 720
    setRotation((prev) => prev + spinAmount)
    setTimeout(() => setIsSpinning(false), 4000)
  }

  const numbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ]

  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

  return (
    <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px]">
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gold/20 to-gold/5 blur-3xl animate-pulse" />

      {/* Outer rim - gold decorative border */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark p-2 shadow-[0_0_60px_rgba(212,175,55,0.3)]">
        <div className="w-full h-full rounded-full bg-marble p-2">
          {/* Wooden frame */}
          <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-900 via-amber-800 to-amber-950 p-3">
            {/* Number ring */}
            <div
              className="w-full h-full rounded-full relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              }}
            >
              {/* Number segments */}
              {numbers.map((num, i) => {
                const angle = (i * 360) / numbers.length
                const isRed = redNumbers.includes(num)
                const isGreen = num === 0

                return (
                  <div
                    key={i}
                    className="absolute w-full h-full"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 lg:w-12 h-[45%] origin-bottom ${
                        isGreen
                          ? "bg-gradient-to-b from-emerald-600 to-emerald-800"
                          : isRed
                          ? "bg-gradient-to-b from-red-700 to-red-900"
                          : "bg-gradient-to-b from-gray-900 to-black"
                      }`}
                      style={{
                        clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
                      }}
                    >
                      <span
                        className="absolute top-3 left-1/2 -translate-x-1/2 text-white text-[10px] sm:text-xs font-bold"
                        style={{ transform: "rotate(180deg)" }}
                      >
                        {num}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Inner decorative ring */}
              <div className="absolute inset-[42%] rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark shadow-lg" />
              <div className="absolute inset-[44%] rounded-full bg-gradient-to-br from-amber-800 to-amber-950 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" />

              {/* Center hub */}
              <div className="absolute inset-[46%] rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark shadow-xl flex items-center justify-center">
                <div className="w-[85%] h-[85%] rounded-full bg-gradient-to-br from-amber-900 to-amber-950 flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                  <div className="w-[60%] h-[60%] rounded-full bg-gradient-to-b from-gold to-gold-dark shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ball marker / pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
      </div>

      {/* Spin button */}
      <button
        onClick={handleSpin}
        disabled={isSpinning}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-16 px-6 py-2 bg-gradient-to-r from-gold-dark via-gold to-gold-dark rounded-full text-primary-foreground font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSpinning ? "Spinning..." : "Spin"}
      </button>

      {/* Crystal reflections */}
      <div className="absolute top-[15%] left-[20%] w-4 h-4 rounded-full bg-white/20 blur-sm animate-pulse" />
      <div className="absolute top-[25%] right-[25%] w-2 h-2 rounded-full bg-white/30 blur-[2px] animate-pulse" style={{ animationDelay: "0.5s" }} />
      <div className="absolute bottom-[30%] left-[15%] w-3 h-3 rounded-full bg-white/15 blur-sm animate-pulse" style={{ animationDelay: "1s" }} />
    </div>
  )
}
