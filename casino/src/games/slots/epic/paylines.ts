// Payline logic for 5x3 Epic Slots

export type SymbolType =
  | 'J' | 'Q' | 'K' | 'A' // Low tier
  | '💰' | '👑' | '💎' | '7️⃣' // High tier
  | '🃏' // Wild
  | '⭐'; // Scatter

export const EPIC_SYMBOLS: SymbolType[] = ['J', 'Q', 'K', 'A', '💰', '👑', '💎', '7️⃣', '🃏', '⭐'];

export const PAYOUTS_MULTI: Record<SymbolType, { 3: number; 4: number; 5: number }> = {
  'J': { 3: 0.5, 4: 1.5, 5: 3 },
  'Q': { 3: 0.5, 4: 1.5, 5: 4 },
  'K': { 3: 1, 4: 2, 5: 5 },
  'A': { 3: 1, 4: 2.5, 5: 8 },
  '💰': { 3: 2, 4: 5, 5: 15 },
  '👑': { 3: 3, 4: 8, 5: 30 },
  '💎': { 3: 5, 4: 15, 5: 50 },
  '7️⃣': { 3: 10, 4: 30, 5: 100 },
  '🃏': { 3: 0, 4: 0, 5: 0 }, // Wilds alone don't pay, they substitute
  '⭐': { 3: 0, 4: 0, 5: 0 }, // Scatters give free spins, not immediate cash (or can be configured)
};

// 20 Paylines for a 5x3 grid (Rows 0, 1, 2)
export const PAYLINES = [
  // Straight lines
  [1, 1, 1, 1, 1], // Line 1: Center
  [0, 0, 0, 0, 0], // Line 2: Top
  [2, 2, 2, 2, 2], // Line 3: Bottom
  // V and Inverted V
  [0, 1, 2, 1, 0], // Line 4: V
  [2, 1, 0, 1, 2], // Line 5: Inverted V
  // Zig Zags
  [1, 0, 1, 0, 1], // Line 6
  [1, 2, 1, 2, 1], // Line 7
  [0, 0, 1, 2, 2], // Line 8
  [2, 2, 1, 0, 0], // Line 9
  [1, 2, 2, 2, 1], // Line 10
  [1, 0, 0, 0, 1], // Line 11
  [0, 1, 1, 1, 0], // Line 12
  [2, 1, 1, 1, 2], // Line 13
  [0, 2, 0, 2, 0], // Line 14
  [2, 0, 2, 0, 2], // Line 15
  [1, 1, 0, 1, 1], // Line 16
  [1, 1, 2, 1, 1], // Line 17
  [0, 1, 2, 2, 2], // Line 18
  [2, 1, 0, 0, 0], // Line 19
  [0, 2, 2, 2, 0], // Line 20
];

export interface WinLine {
  lineIndex: number;
  symbol: SymbolType;
  count: number;
  payoutMultiplier: number;
  positions: { col: number; row: number }[];
}

export function evaluateSpin(
  reels: SymbolType[][], // 5 arrays (cols), each 3 symbols (rows)
  betPerLine: number
): { totalWin: number; winLines: WinLine[]; scatters: number } {
  let totalWin = 0;
  const winLines: WinLine[] = [];
  let scatters = 0;

  // Count Scatters everywhere
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (reels[c][r] === '⭐') scatters++;
    }
  }

  // Check each payline
  PAYLINES.forEach((line, index) => {
    const symbolsOnLine = line.map((row, col) => reels[col][row]);

    // Find the first symbol that is not a WILD to determine what this line pays for
    let targetSymbol = symbolsOnLine[0];
    if (targetSymbol === '⭐') return; // Scatters don't pay on lines

    let i = 0;
    while (targetSymbol === '🃏' && i < 5) {
      targetSymbol = symbolsOnLine[i];
      i++;
    }

    if (i === 5 || targetSymbol === '⭐') return; // Line is all wilds or hit a scatter after wilds

    // Count consecutive matching symbols (or wilds) from the left
    let matchCount = 0;
    const positions: { col: number; row: number }[] = [];

    for (let col = 0; col < 5; col++) {
      const sym = symbolsOnLine[col];
      if (sym === targetSymbol || sym === '🃏') {
        matchCount++;
        positions.push({ col, row: line[col] });
      } else {
        break; // Chain broken
      }
    }

    if (matchCount >= 3) {
      const multi = PAYOUTS_MULTI[targetSymbol as keyof typeof PAYOUTS_MULTI];
      if (multi) {
        const payoutMulti = multi[matchCount as 3 | 4 | 5];
        if (payoutMulti > 0) {
          totalWin += payoutMulti * betPerLine;
          winLines.push({
            lineIndex: index,
            symbol: targetSymbol as SymbolType,
            count: matchCount,
            payoutMultiplier: payoutMulti,
            positions,
          });
        }
      }
    }
  });

  return { totalWin, winLines, scatters };
}

export function generateReels(luck: number): SymbolType[][] {
  const reels: SymbolType[][] = [];
  
  // Weights adjustment based on luck
  const baseWeights = [25, 25, 25, 25, 10, 8, 5, 2, 4, 1]; // Correspond to EPIC_SYMBOLS in order
  const bonus = Math.max(0, luck / 10);
  
  for (let c = 0; c < 5; c++) {
    const col: SymbolType[] = [];
    for (let r = 0; r < 3; r++) {
      let rand = Math.random() * 100;
      
      // Increased chance for better symbols if luck is higher
      let selected: SymbolType = 'J';
      
      const weights = baseWeights.map((w, i) => i >= 4 ? w + (w * bonus * 10) : w);
      const totalWeight = weights.reduce((acc, val) => acc + val, 0);
      
      let randomVal = Math.random() * totalWeight;
      for (let i = 0; i < weights.length; i++) {
        if (randomVal < weights[i]) {
          selected = EPIC_SYMBOLS[i];
          break;
        }
        randomVal -= weights[i];
      }
      
      col.push(selected);
    }
    reels.push(col);
  }
  return reels;
}
