# Architecture & Directory Structure Reference

## System Overview

**Heroes of Madness** is a Next.js 16 (React 19) web application designed for competitive matchmaking, randomizer generation, live win rate calculations, seasonal leaderboards, fighter directories, and community forums for MOBA games (principally RoV and MLBB).

```
heroes-of-madness/
├── .agents/
│   └── skills/
│       └── heroes-of-madness/
│           ├── SKILL.md
│           └── references/
├── public/                 # Static assets, icons, sounds
├── src/
│   ├── app/                # Next.js App Router (Pages & API routes)
│   ├── components/         # Reusable feature-based UI components
│   ├── constants/          # Static hero pools, lanes, initial squad
│   └── utils/              # Data services (Firebase), math (winrates), auth, audio
├── firestore.rules         # Security rules for Firestore
├── storage.rules           # Security rules for Firebase Storage
└── package.json            # Scripts and dependencies
```

---

## Routing Structure (`src/app/`)

| Route              | File Path                          | Description                                                                                                                                              |
| :----------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `src/app/page.tsx`                 | Main Matchmaker, Versus Arena, hero randomizer, live win rate predictions, match history logger, screenshot generator.                                   |
| `/players/[alias]` | `src/app/players/[alias]/page.tsx` | Fighter profile, career statistics, lane distribution, historical season charts (`UserProfileWinRateChart`).                                             |
| `/seasons`         | `src/app/seasons/page.tsx`         | Active & historical season leaderboards, podium standings, fighter winrates, rank tier breakdowns.                                                       |
| `/hall-of-fame`    | `src/app/hall-of-fame/page.tsx`    | Hall of Fame archive of ended seasons, past podium champions, legendary records.                                                                         |
| `/forums`          | `src/app/forums/page.tsx`          | Community forum list, post creation modal, category filter, view counts.                                                                                 |
| `/forums/[slug]`   | `src/app/forums/[slug]/page.tsx`   | Detailed forum discussion, markdown content, @mentions, threaded comments, upvotes/likes.                                                                |
| `/settings`        | `src/app/settings/page.tsx`        | Administration dashboard: Rank tier thresholds, LINE notify settings, season management (end season, seed mock), admin user bootstrap & role assignment. |
| `/api/line/*`      | `src/app/api/line/*/route.ts`      | Serverless route handlers for LINE webhook and notify integration.                                                                                       |

---

## Component Architecture (`src/components/`)

All major components follow a strict 3-file pattern:

```
src/components/<ComponentName>/
├── <ComponentName>.tsx    # Core React component logic ("use client" where stateful)
├── styles.module.css      # Component-scoped CSS modules
└── index.ts               # Clean default/named re-export
```

### Key Components

- **`VersesArena/`**: Renders the 5v5 face-off board (Team A vs Team B), lane assignments, hero cards, win rate prediction bars, and winner selection buttons.
- **`HistoryDashboard/`**: Recent matches list (last 50 matches), match winner editing, deletion, player feedback (likes/dislikes), and consolidated win rate chart.
- **`PodiumStandings/`**: Renders 1st, 2nd, and 3rd place podium badges and cards for season champions.
- **`HeroRandomizer/`**: Randomizer tool selecting heroes from `HERO_POOLS` per lane and game type (`ROV` / `MLBB`).
- **`Charts/`**:
  - `ConsolidatedWinRateChart.tsx`: Main win rate comparison bar/line chart.
  - `UserProfileWinRateChart.tsx`: Radar and progress charts for player profiles.
  - `StockMarketLineChart.tsx`: Trend chart simulating stock market fluctuations based on win streaks.
- **`CRTOverlay/`**: Cyberpunk / arcade retro CRT scanline visual effect applied globally or per page.
- **`DebugBar/`**: Developer debug utility bar for inspecting state, active season, and data source status.
- **`ForumsRulebook/`, `PostCard/`, `PostCreationModal/`**: Forum forum system components.

---

## State & Data Flow

1. **Initial Load**:
   - `Home` (`src/app/page.tsx`) queries `fetchAllMatches()`, `fetchPlayers()`, `fetchRankConfig()`, `fetchSeasonConfig()`, and `fetchSeasons()` simultaneously via `Promise.all()`.
2. **Offline Resilience**:
   - If Firebase environment variables are not set or Firestore fails, `src/utils/firebase.ts` switches to `LocalStorage` seamlessly without crashing the UI.
3. **Live Re-calculation**:
   - Match outcome updates trigger immediate recalculations of player win rates, lane win rates, and team predictions using functions from `@/utils/winrate`.
