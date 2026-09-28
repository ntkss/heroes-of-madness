# Data Models & Storage Architecture

## Core Data Types (`src/utils/firebase.ts`)

### 1. `Match`
Represents a recorded 5v5 or custom match:
```typescript
export type MatchMode = "TEAM_LANE" | "HERO_ROV" | "HERO_MLBB";

export interface Match {
  id: string;
  createdAt: number;
  teamA: string[];               // Array of 5 player IDs or names
  teamB: string[];               // Array of 5 player IDs or names
  teamALanes?: string[];         // Normalized lanes (Exp, Jungle, Mid, Gold, Roam)
  teamBLanes?: string[];
  teamAHeroes?: string[];        // Hero names (when in HERO mode)
  teamBHeroes?: string[];
  winner: "teamA" | "teamB" | null;
  seasonId?: number;
  mode?: MatchMode;
  feedback?: {
    [playerKey: string]: {
      likes: number;
      dislikes: number;
      userVotes?: { [userId: string]: "likes" | "dislikes" };
    };
  };
}
```

### 2. `DbPlayer`
Represents a registered fighter profile in the database:
```typescript
export interface DbPlayer {
  id: string;                    // Firestore Document ID (e.g. "nutty", "bas", or auto-id)
  name: string;                  // Display name
  alias: string;                 // URL slug / secondary identifier (lowercase)
  avatar: string;                // Base64 or image URL
  imageURL?: string;
  winrate: number;               // Career or active season win rate percentage
  current_rank: string;          // Current tier (e.g. "คนเก่ง", "คนปกติ", "คนกาก")
  highest_rank: string;
  total_match_played: number;
  role?: string;
  createdAt?: number;
  allTimeWins?: number;
  allTimeMatches?: number;
  allTimeWinrate?: number;
}
```

### 3. `RankConfig` & `SeasonConfig`
Dynamic ranking and season controls:
```typescript
export interface RankConfig {
  minMatches: number;            // Default: 3
  highTierWinrate: number;       // Default: 55
  lowTierWinrate: number;        // Default: 45
  tiers: {
    high: string;                // "คนเก่ง"
    normal: string;              // "คนปกติ"
    low: string;                 // "คนกาก"
  };
}

export interface SeasonConfig {
  activeSeasonId: number;        // e.g. 1, 2, ...
  seasonStart: number;           // Timestamp
}
```

## Identity Resolution & Document ID Standard

### Golden Rule: Document ID as Single Source of Truth
- **`id` (Firestore Document ID)**: Primary Key and Foreign Key across all `matches` (`teamA`, `teamB`), `feedback`, and seasonal stats. Immutable.
- **`name` (Display Name)**: Official human-readable identity for mentions (`@Nutty`), UI headers, and URLs.
- **`alias` (Funny Nickname / Title)**: Decorative moniker (e.g. "หมิงพลังใบ", "จิมมี่จอมพิชิต"). Can be updated freely without affecting match histories or win rates.

### Backward-Compatible Matching
New matches strictly record `player.id`. For legacy historical matches that stored names or aliases, backward compatibility is maintained via `matchesPlayer()`:
```typescript
// From @/utils/winrate
function matchesPlayer(
  matchPlayerStr: string,
  targetIdOrName: string,
  squad: DbPlayer[]
): boolean;
```
Or resolve via squad lookup:
```typescript
const target = squad.find(
  p => p.id === key ||
       p.id.toLowerCase() === key ||
       (p.alias && p.alias.toLowerCase() === key) ||
       p.name.toLowerCase() === key
);
```

### Data Migration & Backup Utilities
In `src/utils/firebase.ts` & Settings Page:
- `exportAllDataAsBackup()`: Full JSON export of matches, players, seasons, and configs.
- `downloadBackupFile()`: Physical download trigger.
- `migrateMatchesToDocumentIds()`: Automatically backs up data, scans match history, and resolves any old names/aliases in `teamA`/`teamB` into canonical Document IDs.

---

## Lane Normalization Rules

Lanes come from diverse legacy inputs ("top", "mid lane", "support", "adc", "tank / support", "sp").

### Canonical Lanes
The 5 standardized lanes are:
`"Exp" | "Jungle" | "Mid" | "Gold" | "Roam"`

### Normalization Functions
Always sanitize lane strings:
- Use `normalizeLane(rawLane)` from `@/constants/heroes.ts`
- Or `normalizeLaneName(rawLane)` from `@/utils/winrate.ts`

---

## Dual Storage Pattern (Firebase + LocalStorage)

The application MUST work seamlessly whether Firebase credentials are provided or offline.

Whenever writing or modifying a function in `src/utils/firebase.ts`:
1. Check `if (db)` or try/catch the Firestore call.
2. In the `catch` block or `else` branch, provide complete LocalStorage fallback logic.
3. Keep keys synchronized:
   - Matches: `"mlbb_generator_matches"`
   - Rank Config: `"mlbb_generator_rank_config"`
   - Line Config: `"mlbb_generator_line_config"`
   - Season Config: `"mlbb_generator_season_config"`
   - Seasons Archive: `"mlbb_generator_seasons"`
   - Players: Falls back to initial `SQUAD` in `@/constants/players.ts`.
