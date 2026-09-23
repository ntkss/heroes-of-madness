import { Match, DbPlayer, MatchMode } from "@/utils/firebase";

export interface ProgressionPoint {
  matchIndex: number; // 1, 2, 3...
  matchId: string;
  timestamp: number;
  dateStr: string;
  result: "WIN" | "LOSS";
  cumulativeWins: number;
  cumulativeLosses: number;
  totalMatches: number;
  progressiveWinrate: number; // (cumulativeWins / totalMatches) * 100
  performanceIndex: number; // e.g. base 1000 + (cumulativeWins * 25) - (cumulativeLosses * 25)
  seasonId: number;
  mode: MatchMode;
  hero?: string;
  lane?: string;
  team?: "teamA" | "teamB";
}

export interface PlayerProgressionSeries {
  playerId: string;
  playerName: string;
  avatar: string;
  currentWinrate: number;
  peakWinrate: number; // All-time High (ATH)
  troughWinrate: number; // All-time Low (ATL)
  currentStreak: {
    type: "WIN" | "LOSS";
    count: number;
  };
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  changePercent: number; // Change from first resolved match to latest
  isBullish: boolean; // True if latest winrate >= baseline/earlier
  color: string; // Neon line color
  points: ProgressionPoint[];
}

export interface AggregatedSeasonPoint {
  matchIndex: number;
  matchId: string;
  timestamp: number;
  dateStr: string;
  seasonId: number;
  mode: MatchMode;
  cumulativeMatches: number;
  teamAWins: number;
  teamBWins: number;
  teamAWinrate: number;
  teamBWinrate: number;
  averagePlayerWinrate: number;
}

// Curated vibrant neon cyberpunk color palette for multi-user comparative charts
export const STOCK_LINE_COLORS = [
  "#00ff88", // Neon Bull Green
  "#00d2ff", // Neon Cyber Cyan
  "#ffd200", // Neon Electric Gold
  "#ff2a5f", // Neon Retro Pink
  "#a855f7", // Neon Ultraviolet
  "#ff8c00", // Neon Plasma Orange
  "#38bdf8", // Sky Blue
  "#f43f5e", // Rose Red
  "#4ade80", // Mint
  "#e879f9", // Fuchsia
  "#2dd4bf", // Teal
  "#fbbf24", // Amber
];

/**
 * Checks if a match string matches the canonical player ID or name
 */
export function isPlayerInTeam(
  playerKeyOrName: string,
  team: string[] | undefined,
  squad: DbPlayer[],
): boolean {
  if (!team || team.length === 0 || !playerKeyOrName) return false;
  const target = playerKeyOrName.trim().toLowerCase();

  const targetPlayer = squad.find(
    (sp) =>
      (sp.alias && sp.alias.toLowerCase() === target) ||
      sp.id.toLowerCase() === target ||
      sp.id === playerKeyOrName.trim() ||
      sp.name.toLowerCase() === target,
  );

  return team.some((p) => {
    const pTrimmed = p.trim().toLowerCase();
    if (pTrimmed === target) return true;

    if (targetPlayer) {
      if (
        (targetPlayer.alias && targetPlayer.alias.toLowerCase() === pTrimmed) ||
        targetPlayer.id.toLowerCase() === pTrimmed ||
        targetPlayer.name.toLowerCase() === pTrimmed
      ) {
        return true;
      }
    }

    // Deep check against squad database
    const foundSquad = squad.find(
      (sp) =>
        (sp.alias && sp.alias.toLowerCase() === pTrimmed) ||
        sp.id.toLowerCase() === pTrimmed ||
        sp.id === p.trim() ||
        sp.name.toLowerCase() === pTrimmed,
    );
    if (foundSquad) {
      if (
        (foundSquad.alias && foundSquad.alias.toLowerCase() === target) ||
        foundSquad.id.toLowerCase() === target ||
        foundSquad.name.toLowerCase() === target
      ) {
        return true;
      }
      if (targetPlayer && foundSquad.id === targetPlayer.id) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Computes individual player chronological progression series
 */
export function computePlayerProgression(
  playerIdOrName: string,
  matches: Match[],
  squad: DbPlayer[],
  options?: {
    seasonId?: number | "all";
    mode?: MatchMode | "ALL";
    color?: string;
  },
): PlayerProgressionSeries | null {
  if (!playerIdOrName) return null;

  const target = playerIdOrName.trim().toLowerCase();
  const dbPlayer = squad.find(
    (p) =>
      (p.alias && p.alias.toLowerCase() === target) ||
      p.id.toLowerCase() === target ||
      p.id === playerIdOrName.trim() ||
      p.name.toLowerCase() === target,
  );

  const canonicalId = dbPlayer ? dbPlayer.id : target;
  const canonicalName = dbPlayer ? dbPlayer.name : playerIdOrName;
  const canonicalAvatar =
    dbPlayer?.avatar ||
    dbPlayer?.imageURL ||
    `https://api.dicebear.com/9.x/pixel-art/svg?seed=${canonicalId}&backgroundColor=1a1a2e`;

  // Filter finished matches involving this player
  const playerMatches = matches.filter((m) => {
    if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) {
      return false;
    }

    if (options?.seasonId !== undefined && options.seasonId !== "all") {
      const mSeason = m.seasonId !== undefined ? Number(m.seasonId) : 1;
      if (mSeason !== Number(options.seasonId)) return false;
    }

    if (options?.mode && options.mode !== "ALL") {
      const mMode = m.mode || "TEAM_LANE";
      if (mMode !== options.mode) return false;
    }

    const inTeamA = isPlayerInTeam(canonicalId, m.teamA, squad);
    const inTeamB = isPlayerInTeam(canonicalId, m.teamB, squad);

    return inTeamA || inTeamB;
  });

  // Sort strictly ascending by timestamp (oldest first)
  const sortedMatches = [...playerMatches].sort((a, b) => {
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    return timeA - timeB;
  });

  let wins = 0;
  let losses = 0;
  let peak = 0;
  let trough = 100;
  let currentStreakType: "WIN" | "LOSS" = "WIN";
  let currentStreakCount = 0;

  const points: ProgressionPoint[] = [];

  sortedMatches.forEach((m, idx) => {
    const inTeamA = isPlayerInTeam(canonicalId, m.teamA, squad);
    const isWin =
      (m.winner === "teamA" && inTeamA) || (m.winner === "teamB" && !inTeamA);

    if (isWin) {
      wins++;
      if (currentStreakType === "WIN") {
        currentStreakCount++;
      } else {
        currentStreakType = "WIN";
        currentStreakCount = 1;
      }
    } else {
      losses++;
      if (currentStreakType === "LOSS") {
        currentStreakCount++;
      } else {
        currentStreakType = "LOSS";
        currentStreakCount = 1;
      }
    }

    const total = wins + losses;
    const progressiveWinrate = Number(((wins / total) * 100).toFixed(1));
    const performanceIndex = 1000 + wins * 25 - losses * 25;

    if (idx === 0) {
      peak = progressiveWinrate;
      trough = progressiveWinrate;
    } else {
      if (progressiveWinrate > peak) peak = progressiveWinrate;
      if (progressiveWinrate < trough) trough = progressiveWinrate;
    }

    const timestamp = m.createdAt || Date.now();
    const dateObj = new Date(timestamp);
    const dateStr = `${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

    let hero: string | undefined;
    let lane: string | undefined;

    if (inTeamA && m.teamA) {
      const pIdx = m.teamA.findIndex((p) =>
        isPlayerInTeam(canonicalId, [p], squad),
      );
      if (pIdx !== -1) {
        hero = m.teamAHeroes?.[pIdx];
        lane = m.teamALanes?.[pIdx];
      }
    } else if (m.teamB) {
      const pIdx = m.teamB.findIndex((p) =>
        isPlayerInTeam(canonicalId, [p], squad),
      );
      if (pIdx !== -1) {
        hero = m.teamBHeroes?.[pIdx];
        lane = m.teamBLanes?.[pIdx];
      }
    }

    points.push({
      matchIndex: idx + 1,
      matchId: m.id,
      timestamp,
      dateStr,
      result: isWin ? "WIN" : "LOSS",
      cumulativeWins: wins,
      cumulativeLosses: losses,
      totalMatches: total,
      progressiveWinrate,
      performanceIndex,
      seasonId: m.seasonId !== undefined ? Number(m.seasonId) : 1,
      mode: m.mode || "TEAM_LANE",
      hero,
      lane,
      team: inTeamA ? "teamA" : "teamB",
    });
  });

  const totalMatches = wins + losses;
  const currentWinrate =
    totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : 0;

  // Change percent: compare current win rate with baseline
  const firstPointWinrate =
    points.length > 0 ? points[0].progressiveWinrate : 50;
  const changePercent =
    points.length > 0
      ? Number((currentWinrate - firstPointWinrate).toFixed(1))
      : 0;

  const isBullish = changePercent >= 0 && currentWinrate >= 50;
  const defaultColor = isBullish ? "#00ff88" : "#ff2a5f";

  return {
    playerId: canonicalId,
    playerName: canonicalName,
    avatar: canonicalAvatar,
    currentWinrate,
    peakWinrate: points.length > 0 ? peak : 0,
    troughWinrate: points.length > 0 ? trough : 0,
    currentStreak: {
      type: currentStreakType,
      count: currentStreakCount,
    },
    totalWins: wins,
    totalLosses: losses,
    totalMatches,
    changePercent,
    isBullish,
    color: options?.color || defaultColor,
    points,
  };
}

/**
 * Computes comparative progression series for active fighters in a given season or all-time
 */
export function computeComparativeSeasonProgression(
  matches: Match[],
  squad: DbPlayer[],
  options?: {
    seasonId?: number | "all";
    mode?: MatchMode | "ALL";
    minMatches?: number;
    limitFighters?: number;
  },
): {
  series: PlayerProgressionSeries[];
  topGainer: PlayerProgressionSeries | null;
  highestVolume: PlayerProgressionSeries | null;
  highestWinrate: PlayerProgressionSeries | null;
  totalSeasonMatches: number;
} {
  const minMatches = options?.minMatches ?? 1;

  // Compute for all fighters
  const allSeries: PlayerProgressionSeries[] = [];

  squad.forEach((player) => {
    const series = computePlayerProgression(player.id, matches, squad, {
      seasonId: options?.seasonId,
      mode: options?.mode,
    });
    if (series && series.totalMatches >= minMatches) {
      allSeries.push(series);
    }
  });

  // Sort primarily by match volume / winrate
  allSeries.sort((a, b) => {
    if (b.totalMatches !== a.totalMatches) {
      return b.totalMatches - a.totalMatches;
    }
    return b.currentWinrate - a.currentWinrate;
  });

  // Assign distinct aesthetic neon colors
  allSeries.forEach((s, idx) => {
    s.color = STOCK_LINE_COLORS[idx % STOCK_LINE_COLORS.length];
  });

  // Filter top N if specified
  const filteredSeries = options?.limitFighters
    ? allSeries.slice(0, options.limitFighters)
    : allSeries;

  // Metrics
  const topGainer =
    allSeries.length > 0
      ? allSeries.reduce((best, cur) =>
          cur.changePercent > best.changePercent ? cur : best,
        )
      : null;

  const highestVolume =
    allSeries.length > 0
      ? allSeries.reduce((best, cur) =>
          cur.totalMatches > best.totalMatches ? cur : best,
        )
      : null;

  const highestWinrate =
    allSeries.length > 0
      ? allSeries.reduce((best, cur) =>
          cur.currentWinrate > best.currentWinrate ? cur : best,
        )
      : null;

  // Count matches in chosen season/mode
  const filteredMatches = matches.filter((m) => {
    if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) {
      return false;
    }
    if (options?.seasonId !== undefined && options.seasonId !== "all") {
      const mSeason = m.seasonId !== undefined ? Number(m.seasonId) : 1;
      if (mSeason !== Number(options.seasonId)) return false;
    }
    if (options?.mode && options.mode !== "ALL") {
      const mMode = m.mode || "TEAM_LANE";
      if (mMode !== options.mode) return false;
    }
    return true;
  });

  return {
    series: filteredSeries,
    topGainer,
    highestVolume,
    highestWinrate,
    totalSeasonMatches: filteredMatches.length,
  };
}

/**
 * Computes aggregate progression for a season timeline ("Madness Index")
 */
export function computeAggregatedSeasonProgression(
  matches: Match[],
  options?: {
    seasonId?: number | "all";
    mode?: MatchMode | "ALL";
  },
): AggregatedSeasonPoint[] {
  const filteredMatches = matches.filter((m) => {
    if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) {
      return false;
    }
    if (options?.seasonId !== undefined && options.seasonId !== "all") {
      const mSeason = m.seasonId !== undefined ? Number(m.seasonId) : 1;
      if (mSeason !== Number(options.seasonId)) return false;
    }
    if (options?.mode && options.mode !== "ALL") {
      const mMode = m.mode || "TEAM_LANE";
      if (mMode !== options.mode) return false;
    }
    return true;
  });

  const sorted = [...filteredMatches].sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
  );

  let teamAWins = 0;
  let teamBWins = 0;

  return sorted.map((m, idx) => {
    if (m.winner === "teamA") teamAWins++;
    if (m.winner === "teamB") teamBWins++;

    const total = teamAWins + teamBWins;
    const teamAWinrate = Number(((teamAWins / total) * 100).toFixed(1));
    const teamBWinrate = Number(((teamBWins / total) * 100).toFixed(1));

    const timestamp = m.createdAt || Date.now();
    const dateObj = new Date(timestamp);
    const dateStr = `${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

    return {
      matchIndex: idx + 1,
      matchId: m.id,
      timestamp,
      dateStr,
      seasonId: m.seasonId !== undefined ? Number(m.seasonId) : 1,
      mode: m.mode || "TEAM_LANE",
      cumulativeMatches: idx + 1,
      teamAWins,
      teamBWins,
      teamAWinrate,
      teamBWinrate,
      averagePlayerWinrate: 50,
    };
  });
}
