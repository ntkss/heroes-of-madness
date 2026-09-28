---
name: heroes-of-madness
description: >-
  Comprehensive guide and workflow runbook for Heroes of Madness.
  Use when developing features, fixing bugs, updating win rate or ranking logic,
  working with Firebase data or LocalStorage fallbacks, creating UI components, or testing this codebase.
---

# Heroes of Madness (HoM) Engineering Runbook

This skill is the central engineering guide for working with the **Heroes of Madness** codebase. It provides structured workflows for adding features, debugging issues, modifying math/ranking algorithms, and maintaining code quality.

---

## 1. Fast Reference Links

Before diving into code, consult the domain references:

- **[Architecture & Routing Reference](./references/architecture.md)**: Page routes (`src/app/`), component directory conventions, and state flow.
- **[Data Models & Storage Reference](./references/data-models.md)**: `Match`, `DbPlayer`, `RankConfig`, Identity matching rules, and the Dual-Storage pattern.
- **[Ranking & Win Rate Reference](./references/ranking-and-winrate.md)**: Dynamic minimum match thresholds, Laplace smoothing formulas, and team predictions.

---

## 2. Core Golden Rules

1. **Dual Storage Rule (Firebase + LocalStorage)**:
   - The app must function identically offline without Firebase keys.
   - Any function in `src/utils/firebase.ts` modifying or fetching data MUST implement both the Firestore path and the `localStorage` fallback path.
2. **Player Identity Standard (Document ID as Primary Key)**:
   - Match records must strictly store the player's Firestore Document `id` in `teamA` and `teamB`.
   - `name` is the display identity used in UI, headers, and mentions (`@Name`).
   - `alias` is the humorous nickname/title badge (can change anytime without impacting match records or stats).
   - For backward compatibility with unmigrated legacy matches, use `matchesPlayer()` fallback.
3. **Canonical Lane Normalization**:
   - Always run lane names through `normalizeLane()` (`@/constants/heroes`) or `normalizeLaneName()` (`@/utils/winrate`).
   - The only valid normalized lanes are: `"Exp" | "Jungle" | "Mid" | "Gold" | "Roam"`.
4. **React 19 & Next.js 16 Dynamic Route Params**:
   - In Next.js 16 App Router, `params` is a Promise: `params: Promise<{ alias?: string }>`.
   - In client components, unwrap it using `const resolvedParams = use(params);`.
   - In server components, unwrap using `await params`.
5. **Component Structure**:
   - Every reusable component under `src/components/` must live in its own directory with:
     - `<ComponentName>.tsx`
     - `styles.module.css` (CSS Module for scoped styling)
     - `index.ts` (re-exporting `<ComponentName>`)

---

## 3. Workflow: Fixing a Bug

When resolving bugs (e.g. stats mismatch, display name issues, match logging errors):

1. **Trace Player Identifier**:
   - If a player's stats or match log does not show up, check if the match recorded their Document ID while the view is searching for their display name or alias.
   - Use `getPlayerDisplayName(idOrName)` or `matchesPlayer()`.
2. **Check Lane Assignment**:
   - If lane stats or randomizer lane slots fail, verify that the lane string was passed through `normalizeLane()`. Legacy values like `"tank / support"` or `"sp"` must resolve to `"Roam"`.
3. **Verify Dual Storage Paths**:
   - Test or trace both branches: does it succeed when `isFirebaseConfigured` is `true` AND when operating offline in `localStorage` mode?
4. **Check Mode Isolation**:
   - The game supports 3 modes: `TEAM_LANE`, `HERO_ROV`, and `HERO_MLBB`.
   - Ensure calculations respect the active filter: `(m.mode || "TEAM_LANE") === targetMode`.
5. **Run Lint and Format Checks**:
   - Run `npm run prettier:check` (or `npm run prettier:fix`).
   - Run `npm run lint`.

---

## 4. Workflow: Implementing a New Feature

When introducing a new feature (e.g., new statistic, page, modal, or game mode):

1. **Update Types & Data Layer (`src/utils/firebase.ts`)**:
   - Define TypeScript interfaces.
   - Add Firestore operations with batch writes where appropriate.
   - Add corresponding LocalStorage serialization and fallback logic.
2. **Implement Business Logic (`src/utils/`)**:
   - Pure mathematical calculations belong in `src/utils/winrate.ts` or `src/utils/progression.ts`.
   - Audio feedback (beeps, win fanfare, coin drops) can be triggered via `@/utils/audio` (`playBeep`, `playWin`, `playCoin`).
3. **Create Component (`src/components/<FeatureName>/`)**:
   - Create `<FeatureName>.tsx`, `styles.module.css`, and `index.ts`.
   - Add `"use client";` at top if using React hooks (`useState`, `useEffect`, `useMemo`).
   - Use cyber/CRT retro aesthetics consistent with the design system.
4. **Wire to Page or Router (`src/app/`)**:
   - Add routes or embed into `src/app/page.tsx`, `src/app/players/`, or `src/app/seasons/`.
   - Ensure loading and error states are handled.
5. **Verify Code Quality**:
   - Ensure no lint or TypeScript compilation errors.

---

## 5. Workflow: Modifying Ranking or Win Rate Logic

When tuning formulas (e.g. smoothing constants, minimum matches, season podiums):

1. **Inspect `src/utils/firebase.ts` & `src/utils/winrate.ts`**:
   - `getRequiredMinMatches(totalSeasonMatches, configuredMinMatches)`: Dynamic threshold scaling with season match volume.
   - `getWeightedWinrate(wins, totalMatches, C = 10)`: Laplace smoothing formula $(Wins + C \times 0.5) / (Total + C)$.
2. **Synchronize All Dependent Views**:
   - Any ranking update must be reflected consistently across:
     - `src/components/HistoryDashboard/HistoryDashboard.tsx`
     - `src/app/seasons/page.tsx`
     - `src/app/hall-of-fame/page.tsx`
     - `src/app/players/[alias]/page.tsx`
     - `src/components/PodiumStandings/`
     - `src/app/settings/page.tsx`
3. **Verify Edge Cases**:
   - Player with 0 matches.
   - Player with 1 match / 1 win (must not overshadow veteran players).
   - Season with fewer than 3 matches.

---

## 6. Verification & Release Checklist

Before committing changes:

- [ ] **Formatting**: Run `npm run prettier:check` (fix with `npm run prettier:fix`).
- [ ] **Linting**: Run `npm run lint`.
- [ ] **Build Check**: If dependencies are installed, verify with `npm run build`.
- [ ] **Commit Convention**: Follow Conventional Commits:
  - `feat: <summary>` for new features
  - `fix: <summary>` for bug fixes
  - `chore: version to X.X.X` when bumping version in `package.json`
