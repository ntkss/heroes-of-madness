# Ranking & Win Rate Algorithms

This reference details the mathematical and ranking logic implemented in `src/utils/winrate.ts`, `src/utils/firebase.ts`, and `src/utils/progression.ts`.

---

## 1. Dynamic Minimum Matches Threshold

To prevent low-sample players (e.g. 1 match, 1 win = 100%) from stealing podium spots while still allowing new seasons to populate quickly, the system uses a dynamic scaling minimum match threshold.

### Formula (`getRequiredMinMatches` in `src/utils/firebase.ts`):

```typescript
export function getRequiredMinMatches(
  totalSeasonMatches: number,
  configuredMinMatches: number = 3,
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
  C: number = 10, // Smoothing constant
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

---

## 5. Underdog Mode (สู้ยิบตา) & Effective Wins

To prevent defeatism, griefing, and match throwing when randomized teams have uneven predicted win rates, the system implements **Underdog Mode ("สู้ยิบตา")**.

### 1. Trigger Criteria

A match is designated as an Underdog Match if the predicted team win rate difference is $ge 7\%$:
$$\Delta = |\text{TeamA\%} - \text{TeamB\%}| \ge 7\%$$

- **Favored Team**: Higher predicted win rate.
- **Underdog Team ("ทีมสู้ยิบตา")**: Lower predicted win rate.

### 2. Rewards: Underdog Comeback Team & Losing MVP (Effective Wins)

Underdog Mode provides asymmetric rewards to eliminate defeatism and match-throwing:

1. **Underdog Comeback Victory (ทีมสู้ยิบตา 🔥)**:
   - When the underdog team overcomes the odds and wins the match, **all 5 players** on the winning underdog team receive **+0.20 Effective Wins** each!
   - Badge: `🔥 สู้ยิบตา xN` (name & icon configurable in `/settings`)

2. **Underdog Losing MVP (ฝันร้ายราชา 🗡️)**:
   - If the underdog team loses, the player chosen as the **Losing Team MVP ("MVP ฝ่ายแพ้")** receives **+0.35 Effective Wins**.
   - Badge: `🗡️ ฝันร้ายราชา xN` (name & icon configurable in `/settings`)

$$\text{Effective Wins} = \text{Actual Wins} + (\text{Losing MVP Count} \times 0.35) + (\text{Comeback Win Count} \times 0.20)$$

Each Underdog bonus contributes directly towards both raw win rate and Laplace weighted win rate:
$$\text{Weighted Winrate} = \left( \frac{\text{Effective Wins} + C \times 0.5}{\text{Total Matches} + C} \right) \times 100$$
$$\text{Raw Winrate} = \min\left(100, \text{round}\left(\frac{\text{Effective Wins}}{\text{Total Matches}} \times 100\right)\right)$$

### 3. Customizable Badges in Settings

Administrators can navigate to `/settings` -> **🏅 BADGES** to customize the icon and display name of every badge in the application:

- `underdogComeback`: Default `🔥 สู้ยิบตา` (+0.20 Win)
- `underdogLosingMvp`: Default `🗡️ ฝันร้ายราชา` (+0.35 Win)
- `seasonChampion`: Default `👑 แชมเปี้ยน`
- `underdogMatch`: Default `🔥 โหมดสู้ยิบตา`
- `upsetVictory`: Default `⚡ ล้มยักษ์สำเร็จ`
- Podiums: `🥇 อันดับ 1`, `🥈 อันดับ 2`, `🥉 อันดับ 3`, `💩 อันดับสุดท้าย`

Settings are saved with dual-storage (Firestore `config/badgeSystem` + LocalStorage `mlbb_badge_config`) and synchronize across components in real-time.

### 4. Backward Compatibility & Data Safety

- Past matches without underdog records default to $0$, yielding $\text{Effective Wins} = \text{Wins}$.
- Archived historical seasons (`seasons` collection) maintain their original frozen stats and rankings without retroactive distortion.
- If a player throws or gives up, their Underdog counts remain $0$, causing their rank to drop compared to players who fought hard to earn Comeback or MVP rewards.
