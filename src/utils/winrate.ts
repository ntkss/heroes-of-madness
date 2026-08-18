import { DbPlayer, Match } from "@/utils/firebase";

export interface PlayerOverallStats {
  winRate: number;
  matches: number;
  wins: number;
  laneName: string;
  isFallback: boolean;

  // Backward compatibility fields
  laneWinRate: number;
  laneMatches: number;
  laneWins: number;
}

export interface PlayerLaneStats {
  laneWinRate: number;
  laneMatches: number;
  laneWins: number;
  laneName: string;
  isFallback: boolean;
}

export interface TeamWinRateSummary {
  teamAWinRate: number;
  teamBWinRate: number;
  teamALaneStats: PlayerOverallStats[];
  teamBLaneStats: PlayerOverallStats[];
  favoredTeam: "teamA" | "teamB" | "tie";
}

const DEFAULT_LANES = ["Top", "Jungle", "Mid", "ADC", "Support"];
const ROLE_NAMES = ["EXP", "JUNGLE", "MID", "GOLD", "ROAMING"];

/**
 * Normalizes lane names across different conventions (e.g. "EXP" / "Top", "GOLD" / "ADC", "ROAMING" / "Support")
 */
export function normalizeLaneName(lane: string): string {
  if (!lane) return "";
  const l = lane.trim().toLowerCase();
  if (l === "top" || l === "exp" || l === "top lane") return "EXP";
  if (l === "jungle" || l === "jug" || l === "jungler") return "JUNGLE";
  if (l === "mid" || l === "mid lane") return "MID";
  if (l === "adc" || l === "gold" || l === "gold lane") return "GOLD";
  if (l === "support" || l === "roam" || l === "roaming" || l === "sup")
    return "ROAMING";
  return lane.toUpperCase();
}

/**
 * Checks if a player identifier from a match matches the target player ID or Name.
 */
function matchesPlayer(
  matchPlayerStr: string,
  targetIdOrName: string,
  squad: DbPlayer[],
): boolean {
  if (!matchPlayerStr || !targetIdOrName) return false;
  const p1 = matchPlayerStr.trim().toLowerCase();
  const p2 = targetIdOrName.trim().toLowerCase();
  if (p1 === p2) return true;

  // Search squad for deeper ID/Name matching
  const targetPlayer = squad.find(
    (p) => p.id.toLowerCase() === p2 || p.name.toLowerCase() === p2,
  );
  if (targetPlayer) {
    if (
      p1 === targetPlayer.id.toLowerCase() ||
      p1 === targetPlayer.name.toLowerCase()
    ) {
      return true;
    }
  }

  const matchPlayer = squad.find(
    (p) => p.id.toLowerCase() === p1 || p.name.toLowerCase() === p1,
  );
  if (matchPlayer) {
    if (
      p2 === matchPlayer.id.toLowerCase() ||
      p2 === matchPlayer.name.toLowerCase()
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates a player's win rate in the specific lane assigned to them (laneIndex 0..4).
 */
export function getPlayerLaneWinRate(
  playerIdOrName: string,
  laneIndex: number,
  matches: Match[],
  squad: DbPlayer[],
): PlayerLaneStats {
  const laneName = ROLE_NAMES[laneIndex] || DEFAULT_LANES[laneIndex] || "LANE";
  const targetNormalizedLane = normalizeLaneName(laneName);

  let laneMatches = 0;
  let laneWins = 0;

  if (matches && matches.length > 0) {
    matches.forEach((m) => {
      // Only count finished matches
      if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) return;

      // Check Team A
      if (m.teamA && m.teamA.length > 0) {
        const pIdx = m.teamA.findIndex((p) =>
          matchesPlayer(p, playerIdOrName, squad),
        );
        if (pIdx !== -1) {
          const rawMatchLane =
            m.teamALanes?.[pIdx] || DEFAULT_LANES[pIdx] || ROLE_NAMES[pIdx];
          const matchLaneNorm = normalizeLaneName(rawMatchLane);

          if (pIdx === laneIndex || matchLaneNorm === targetNormalizedLane) {
            laneMatches++;
            if (m.winner === "teamA") {
              laneWins++;
            }
          }
        }
      }

      // Check Team B
      if (m.teamB && m.teamB.length > 0) {
        const pIdx = m.teamB.findIndex((p) =>
          matchesPlayer(p, playerIdOrName, squad),
        );
        if (pIdx !== -1) {
          const rawMatchLane =
            m.teamBLanes?.[pIdx] || DEFAULT_LANES[pIdx] || ROLE_NAMES[pIdx];
          const matchLaneNorm = normalizeLaneName(rawMatchLane);

          if (pIdx === laneIndex || matchLaneNorm === targetNormalizedLane) {
            laneMatches++;
            if (m.winner === "teamB") {
              laneWins++;
            }
          }
        }
      }
    });
  }

  if (laneMatches > 0) {
    const wr = Math.round((laneWins / laneMatches) * 100);
    return {
      laneWinRate: wr,
      laneMatches,
      laneWins,
      laneName,
      isFallback: false,
    };
  }

  // Fallback: If 0 matches played in assigned lane, use player's overall win rate
  const foundPlayer = squad.find(
    (p) =>
      p.id.toLowerCase() === playerIdOrName.toLowerCase() ||
      p.name.toLowerCase() === playerIdOrName.toLowerCase(),
  );

  let fallbackWr = 50; // Neutral default for bot/new player
  if (foundPlayer) {
    if (
      foundPlayer.winrate !== undefined &&
      foundPlayer.winrate !== null &&
      foundPlayer.total_match_played > 0
    ) {
      fallbackWr = Math.round(foundPlayer.winrate);
    }
  }

  return {
    laneWinRate: fallbackWr,
    laneMatches: 0,
    laneWins: 0,
    laneName,
    isFallback: true,
  };
}

/**
 * Calculates a player's overall win rate based on all matches.
 */
export function getPlayerOverallWinRate(
  playerIdOrName: string,
  matches: Match[],
  squad: DbPlayer[],
  laneIndex: number,
): PlayerOverallStats {
  const laneName = ROLE_NAMES[laneIndex] || DEFAULT_LANES[laneIndex] || "LANE";
  const laneStats = getPlayerLaneWinRate(playerIdOrName, laneIndex, matches, squad);

  let totalMatches = 0;
  let totalWins = 0;

  if (matches && matches.length > 0) {
    matches.forEach((m) => {
      // Only count finished matches
      if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) return;

      // Check Team A
      if (m.teamA && m.teamA.length > 0) {
        const pIdx = m.teamA.findIndex((p) =>
          matchesPlayer(p, playerIdOrName, squad),
        );
        if (pIdx !== -1) {
          totalMatches++;
          if (m.winner === "teamA") {
            totalWins++;
          }
        }
      }

      // Check Team B
      if (m.teamB && m.teamB.length > 0) {
        const pIdx = m.teamB.findIndex((p) =>
          matchesPlayer(p, playerIdOrName, squad),
        );
        if (pIdx !== -1) {
          totalMatches++;
          if (m.winner === "teamB") {
            totalWins++;
          }
        }
      }
    });
  }

  if (totalMatches > 0) {
    const wr = Math.round((totalWins / totalMatches) * 100);
    return {
      winRate: wr,
      matches: totalMatches,
      wins: totalWins,
      laneName,
      isFallback: false,
      laneWinRate: laneStats.laneWinRate,
      laneMatches: laneStats.laneMatches,
      laneWins: laneStats.laneWins,
    };
  }

  // Fallback: Use player's overall win rate from squad (database stats)
  const foundPlayer = squad.find(
    (p) =>
      p.id.toLowerCase() === playerIdOrName.toLowerCase() ||
      p.name.toLowerCase() === playerIdOrName.toLowerCase(),
  );

  let fallbackWr = 50; // Neutral default for bot/new player
  if (foundPlayer) {
    if (
      foundPlayer.winrate !== undefined &&
      foundPlayer.winrate !== null &&
      foundPlayer.total_match_played > 0
    ) {
      fallbackWr = Math.round(foundPlayer.winrate);
    }
  }

  return {
    winRate: fallbackWr,
    matches: 0,
    wins: 0,
    laneName,
    isFallback: true,
    laneWinRate: laneStats.laneWinRate,
    laneMatches: laneStats.laneMatches,
    laneWins: laneStats.laneWins,
  };
}

/**
 * Calculates win rates for Team A and Team B based on each player's overall win rate.
 */
export function calculateTeamWinRates(
  teamA: string[],
  teamB: string[],
  matches: Match[],
  squad: DbPlayer[],
): TeamWinRateSummary {
  const teamALaneStats: PlayerOverallStats[] = [];
  const teamBLaneStats: PlayerOverallStats[] = [];

  // Team A
  for (let i = 0; i < 5; i++) {
    const player = teamA[i] || "";
    teamALaneStats.push(getPlayerOverallWinRate(player, matches, squad, i));
  }

  // Team B
  for (let i = 0; i < 5; i++) {
    const player = teamB[i] || "";
    teamBLaneStats.push(getPlayerOverallWinRate(player, matches, squad, i));
  }

  // Calculate average overall win rates for Team A and Team B
  const teamAAvgOverall =
    teamALaneStats.reduce((sum, s) => sum + s.winRate, 0) / 5;
  const teamBAvgOverall =
    teamBLaneStats.reduce((sum, s) => sum + s.winRate, 0) / 5;

  let teamAWinRate = 50;
  let teamBWinRate = 50;

  if (teamAAvgOverall + teamBAvgOverall > 0) {
    teamAWinRate = Math.round(
      (teamAAvgOverall / (teamAAvgOverall + teamBAvgOverall)) * 100,
    );
    teamBWinRate = 100 - teamAWinRate;
  }

  let favoredTeam: "teamA" | "teamB" | "tie" = "tie";
  if (teamAWinRate > teamBWinRate) {
    favoredTeam = "teamA";
  } else if (teamBWinRate > teamAWinRate) {
    favoredTeam = "teamB";
  }

  return {
    teamAWinRate,
    teamBWinRate,
    teamALaneStats,
    teamBLaneStats,
    favoredTeam,
  };
}
