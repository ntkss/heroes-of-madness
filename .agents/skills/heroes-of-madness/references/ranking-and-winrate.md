# Ranking & Win Rate Algorithms

This reference details the mathematical and ranking logic implemented in `src/utils/winrate.ts`, `src/utils/firebase.ts`, and `src/utils/progression.ts`.

---

## 1. Dynamic Minimum Matches Threshold

To prevent low-sample players (e.g. 1 match, 1 win = 100%) from stealing podium spots while still allowing new seasons to populate quickly, the system uses a dynamic scaling minimum match threshold.

### Formula (`getRequiredMinMatches` in `src/utils/firebase.ts`):
```typescript
export function getRequiredMinMatches(
  totalSeasonMatches: number,
  configuredMinMatches: number = 3
): number {
  const dynamicMin = Math.ceil(totalSeasonMatches * 0.2);
  return Math.max(configuredMinMatches, Math.min(10, dynamicMin));
}
```

- **Early Season (1–10 matches)**: Low threshold (3 matches) so leaderboards populate quickly.
- **Mid/Late Season (50+ matches)**: Dynamically scales up to 10 matches (20% of season matches capped at 10) so only active participants qualify for podium rankings.

---

## 2. Weighted Win Rate (Laplace / Bayesian Smoothing)

Leaderboards and podium rankings sort players using Laplace smoothing rather than raw win rate to balance win percentage with match volume.

### Formula (`getWeightedWinrate` in `src/utils/firebase.ts`):
```typescript
export function getWeightedWinrate(
  wins: number,
  totalMatches: number,
  C: number = 10 // Smoothing constant
): number {
  if (totalMatches === 0) return 0;
  const prior = 0.5; // Neutral 50% baseline
  return ((wins + C * prior) / (totalMatches + C)) * 100;
}
```

- With `C = 10`:
  - A player with 1 win / 1 match gets: `(1 + 5) / (1 + 10) = 6 / 11 = 54.5%`
  - A player with 18 wins / 20 matches gets: `(18 + 5) / (20 + 10) = 23 / 30 = 76.7%`
  - Highly active players with strong win rates reliably outrank low-sample lucky streaks.

---

## 3. Lane Win Rate & Team Prediction (`src/utils/winrate.ts`)

### `getPlayerLaneWinRate(playerIdOrName, laneIndex, matches, squad, mode?)`
- Calculates player's win rate in a specific lane (0: Exp, 1: Jungle, 2: Mid, 3: Gold, 4: Roam).
- Fallback: If 0 matches played in that lane, returns neutral 50% for mode isolation, or the player's overall win rate if no mode is specified.

### `calculateTeamWinRates(teamA, teamB, matches, squad, mode?)`
- Computes overall predicted win rates for Team A vs Team B.
- Calculates each team's average lane strength:
  $$\text{teamAAvg} = \frac{1}{5} \sum_{i=0}^4 \text{playerWinRate}_{A, i}$$
- Team A's predicted win rate:
  $$\text{TeamA\%} = \text{round}\left(\frac{\text{teamAAvg}}{\text{teamAAvg} + \text{teamBAvg}} \times 100\right)$$
- Team B's predicted win rate:
  $$100 - \text{TeamA\%}$$

---

## 4. Rank Tiers & Badges

Based on `RankConfig` (`DEFAULT_RANK_CONFIG`):
- **High Tier ("คนเก่ง")**: Win Rate $\ge 55\%$
- **Normal Tier ("คนปกติ")**: $45\% \le \text{Win Rate} < 55\%$
- **Low Tier ("คนกาก")**: Win Rate $< 45\%$

Visual styling:
- High Tier: Gold / Cyan glow (`#00f3ff`, `#ffd700`)
- Normal Tier: Silver / Blue (`#3b82f6`)
- Low Tier: Red / Orange warning (`#ef4444`)
