"use client";

import React from "react";
import Image from "next/image";
import { Match, DbPlayer, RankConfig, SeasonPlayerStat } from "@/utils/firebase";
import styles from "./styles.module.css";
import { playBeep, playWin } from "@/utils/audio";
import PodiumStandings from "@/components/PodiumStandings";

interface HistoryDashboardProps {
  matches: Match[];
  onDeleteMatch: (id: string) => void;
  onDeleteAllMatches: () => void;
  onUpdateWinner: (id: string, winner: "teamA" | "teamB") => void;
  availablePlayers: DbPlayer[];
  rankConfig: RankConfig;
  isAdmin?: boolean;
}

export default function HistoryDashboard({
  matches,
  onDeleteMatch,
  onDeleteAllMatches,
  onUpdateWinner,
  availablePlayers,
  rankConfig,
  isAdmin = false,
}: HistoryDashboardProps) {
  const [activeTab, setActiveTab] = React.useState<"history" | "stats">(
    "history",
  );
  const [statsSubTab, setStatsSubTab] = React.useState<"season" | "alltime">(
    "season",
  );
  const handlePurgeAllClick = () => {
    playBeep(220, 0.1, "sawtooth");
    const confirmDelete = window.confirm(
      "⚠️ DANGER! ARE YOU SURE YOU WANT TO PURGE ALL MATCH LOGS FROM THE CABINET DATABASE?\nTHIS ACTION CANNOT BE UNDONE!",
    );
    if (confirmDelete) {
      playBeep(100, 0.3, "sawtooth");
      onDeleteAllMatches();
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleDelete = (id: string) => {
    playBeep(150, 0.15, "sawtooth");
    onDeleteMatch(id);
  };

  const handleWinnerChange = (id: string, winner: "teamA" | "teamB") => {
    playWin();
    onUpdateWinner(id, winner);
  };

  const getPlayerDisplayName = (idOrName: string) => {
    const player = availablePlayers.find(
      (p) =>
        p.id === idOrName.toLowerCase() ||
        p.name.toLowerCase() === idOrName.toLowerCase(),
    );
    return player ? player.name : idOrName;
  };

  // Dynamically compute player statistics from player documents (single source of truth) and matches logs (for unregistered players)
  const playerStats = React.useMemo(() => {
    const statsMap: Record<
      string,
      {
        wins: number;
        losses: number;
        matches: number;
        allTimeWins: number;
        allTimeMatches: number;
        allTimeLosses: number;
        dbPlayer?: DbPlayer;
      }
    > = {};

    // 1. Initialize stats map with database stats for all available players
    availablePlayers.forEach((player) => {
      const dbMatches = Number(player.total_match_played) || 0;
      const dbWinrate = Number(player.winrate) || 0;
      const dbWins = Math.round((dbWinrate / 100) * dbMatches);
      const dbLosses = dbMatches - dbWins;

      const atMatches =
        player.allTimeMatches !== undefined
          ? Number(player.allTimeMatches)
          : dbMatches;
      const atWinrate =
        player.allTimeWinrate !== undefined
          ? Number(player.allTimeWinrate)
          : dbWinrate;
      const atWins =
        player.allTimeWins !== undefined
          ? Number(player.allTimeWins)
          : Math.round((atWinrate / 100) * atMatches);
      const atLosses = atMatches - atWins;

      statsMap[player.id] = {
        wins: dbWins,
        losses: dbLosses,
        matches: dbMatches,
        allTimeWins: atWins,
        allTimeMatches: atMatches,
        allTimeLosses: atLosses,
        dbPlayer: player,
      };
    });

    const getPlayerKey = (nameOrId: string) => {
      const found = availablePlayers.find(
        (p) =>
          p.id === nameOrId.toLowerCase() ||
          p.name.toLowerCase() === nameOrId.toLowerCase(),
      );
      return found ? found.id : nameOrId.toLowerCase();
    };

    // 2. Accumulate stats from matches log ONLY for unregistered players/bots (to avoid double-counting)
    matches.forEach((match) => {
      if (!match.winner) return;

      const teamAPlayers = match.teamA || [];
      const teamBPlayers = match.teamB || [];

      const winningTeam =
        match.winner === "teamA" ? teamAPlayers : teamBPlayers;
      const losingTeam = match.winner === "teamA" ? teamBPlayers : teamAPlayers;

      winningTeam.forEach((playerNameOrId) => {
        const key = getPlayerKey(playerNameOrId);
        if (!statsMap[key]) {
          statsMap[key] = {
            wins: 0,
            losses: 0,
            matches: 0,
            allTimeWins: 0,
            allTimeLosses: 0,
            allTimeMatches: 0,
          };
        }
        if (!statsMap[key].dbPlayer) {
          statsMap[key].wins += 1;
          statsMap[key].matches += 1;
          statsMap[key].allTimeWins += 1;
          statsMap[key].allTimeMatches += 1;
        }
      });

      losingTeam.forEach((playerNameOrId) => {
        const key = getPlayerKey(playerNameOrId);
        if (!statsMap[key]) {
          statsMap[key] = {
            wins: 0,
            losses: 0,
            matches: 0,
            allTimeWins: 0,
            allTimeLosses: 0,
            allTimeMatches: 0,
          };
        }
        if (!statsMap[key].dbPlayer) {
          statsMap[key].losses += 1;
          statsMap[key].matches += 1;
          statsMap[key].allTimeLosses += 1;
          statsMap[key].allTimeMatches += 1;
        }
      });
    });

    const statsList = Object.entries(statsMap).map(([key, data]) => {
      const seasonWinrate =
        data.matches > 0 ? (data.wins / data.matches) * 100 : 0;
      const allTimeWinrate =
        data.allTimeMatches > 0
          ? (data.allTimeWins / data.allTimeMatches) * 100
          : 0;
      const name = data.dbPlayer
        ? data.dbPlayer.name
        : key.charAt(0).toUpperCase() + key.slice(1);

      return {
        name,
        matches: data.matches,
        wins: data.wins,
        losses: data.losses,
        winrate: seasonWinrate,
        allTimeMatches: data.allTimeMatches,
        allTimeWins: data.allTimeWins,
        allTimeLosses: data.allTimeLosses,
        allTimeWinrate,
        dbPlayer: data.dbPlayer,
      };
    });

    // Sort based on the selected sub-tab
    return statsList.sort((a, b) => {
      const aWR = statsSubTab === "season" ? a.winrate : a.allTimeWinrate;
      const bWR = statsSubTab === "season" ? b.winrate : b.allTimeWinrate;
      const aM = statsSubTab === "season" ? a.matches : a.allTimeMatches;
      const bM = statsSubTab === "season" ? b.matches : b.allTimeMatches;

      if (bWR !== aWR) {
        return bWR - aWR;
      }
      if (bM !== aM) {
        return bM - aM;
      }
      return a.name.localeCompare(b.name);
    });
  }, [matches, availablePlayers, statsSubTab]);

  // Dynamically compute podium positions for the winrates tab based on statsSubTab selection
  const podiumData = React.useMemo(() => {
    const mapToSeasonPlayerStat = (stat: typeof playerStats[0]): SeasonPlayerStat => {
      const isSeason = statsSubTab === "season";
      const totalMatches = isSeason ? stat.matches : stat.allTimeMatches;
      const currentRank = stat.dbPlayer
        ? stat.dbPlayer.current_rank
        : (totalMatches >= rankConfig.minMatches ? "Normal" : "Unranked");

      return {
        id: stat.dbPlayer?.id || stat.name.toLowerCase(),
        name: stat.name,
        alias: stat.dbPlayer?.alias || "",
        avatar: stat.dbPlayer?.avatar || "",
        winrate: Math.round(isSeason ? stat.winrate : stat.allTimeWinrate),
        total_match_played: totalMatches,
        current_rank: currentRank,
      };
    };

    return {
      firstPlace: playerStats[0] ? mapToSeasonPlayerStat(playerStats[0]) : null,
      secondPlace: playerStats[1] ? mapToSeasonPlayerStat(playerStats[1]) : null,
      thirdPlace: playerStats[2] ? mapToSeasonPlayerStat(playerStats[2]) : null,
      lastPlace: playerStats.length > 3 ? mapToSeasonPlayerStat(playerStats[playerStats.length - 1]) : null,
    };
  }, [playerStats, statsSubTab]);

  const renderRankInfo = (dbPlayer: DbPlayer | undefined) => {
    if (!dbPlayer) return null;
    const rankName = dbPlayer.current_rank;
    let rankColorClass = "text-slate-400 font-bold";
    if (rankConfig) {
      if (rankName === rankConfig.tiers.high) {
        rankColorClass = "text-purple-400 font-bold";
      } else if (rankName === rankConfig.tiers.normal) {
        rankColorClass = "text-orange-400 font-bold";
      } else if (rankName === rankConfig.tiers.low) {
        rankColorClass = "text-green-400 font-bold";
      } else {
        // Fallback checks
        if (rankName.includes("Mythic"))
          rankColorClass = "text-purple-400 font-bold";
        else if (rankName === "Legend")
          rankColorClass = "text-orange-400 font-bold";
        else if (rankName === "Epic")
          rankColorClass = "text-green-400 font-bold";
      }
    }

    const isThai = /[\u0E00-\u0E7F]/.test(rankName);
    const fontClass = isThai
      ? "font-thai text-[10px] tracking-wide"
      : "font-pixel text-[6.5px] uppercase tracking-wider";

    return (
      <span className={styles.rankInfoContainer}>
        {dbPlayer.alias} •{" "}
        <span className={styles.roleText}>{dbPlayer.role}</span> •{" "}
        <span className={`${rankColorClass} ${fontClass}`}>{rankName}</span>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* Decorative metal rivets */}
      <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>ARENA LOGBOOK</h2>
        <div className={styles.headerControls}>
          <span className={styles.recordsCount}>RECORDS: {matches.length}</span>
          {matches.length > 0 && activeTab === "history" && isAdmin && (
            <button
              onClick={handlePurgeAllClick}
              className={styles.purgeAllBtn}
              title="Purge all match logs"
            >
              PURGE ALL
            </button>
          )}
        </div>
      </div>

      {/* Arcade Tab Selectors */}
      <div className={styles.tabBar}>
        <button
          onClick={() => {
            playBeep(330, 0.1, "sawtooth");
            setActiveTab("history");
          }}
          className={`${styles.tabButton} ${
            activeTab === "history"
              ? styles.tabButtonActiveHistory
              : styles.tabButtonInactive
          }`}
        >
          📜 MATCH LOGS
        </button>
        <button
          onClick={() => {
            playBeep(392, 0.1, "sawtooth");
            setActiveTab("stats");
          }}
          className={`${styles.tabButton} ${
            activeTab === "stats"
              ? styles.tabButtonActiveStats
              : styles.tabButtonInactive
          }`}
        >
          🏆 FIGHTER WINRATES
        </button>
      </div>

      {/* Tab Contents: MATCH HISTORY */}
      {activeTab === "history" &&
        (matches.length === 0 ? (
          <div className={styles.emptyStateContainer}>
            <span className={styles.emptyStateTitle}>NO RECORDS FOUND</span>
            <span className={styles.emptyStateSubtitle}>
              ARENA VACANT. START DRAFT TO INITIALIZE LOGS.
            </span>
          </div>
        ) : (
          <div className={styles.historyList}>
            {matches.map((match) => (
              <div key={match.id} className={styles.matchCard}>
                {/* Match Details */}
                <div className={styles.matchDetails}>
                  {/* Header labels */}
                  <div className={styles.matchDetailsHeader}>
                    <span className={styles.matchDetailsHeaderTag}>
                      MATCH LOG
                    </span>
                    <span className={styles.matchDetailsHeaderDate}>
                      {formatDate(match.createdAt)}
                    </span>
                  </div>

                  {/* Team roster names grid */}
                  <div className={styles.rosterGrid}>
                    {/* Blue */}
                    <div className={styles.rosterCol}>
                      <span className={styles.rosterLabelBlue}>BLUE TEAM</span>
                      <span className={styles.rosterText}>
                        {match.teamA.map(getPlayerDisplayName).join(" • ") ||
                          "EMPTY"}
                      </span>
                    </div>
                    {/* Red */}
                    <div className={styles.rosterCol}>
                      <span className={styles.rosterLabelRed}>RED TEAM</span>
                      <span className={styles.rosterText}>
                        {match.teamB.map(getPlayerDisplayName).join(" • ") ||
                          "EMPTY"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action column */}
                <div className={styles.matchActionsCol}>
                  {/* Winner tag */}
                  {match.winner ? (
                    <div className={styles.winnerWrapper}>
                      <span className={styles.winnerLabel}>WINNER</span>
                      <span
                        className={`${styles.winnerTag} ${
                          match.winner === "teamA"
                            ? styles.winnerTagBlue
                            : styles.winnerTagRed
                        }`}
                      >
                        {match.winner === "teamA" ? "BLUE TEAM" : "RED TEAM"}
                      </span>
                    </div>
                  ) : (
                    <div className={styles.pendingWrapper}>
                      <span className={styles.pendingLabel}>
                        PENDING OUTCOME
                      </span>
                      {isAdmin && (
                        <div className={styles.pendingBtnGrid}>
                          <button
                            onClick={() =>
                              handleWinnerChange(match.id, "teamA")
                            }
                            className={styles.pendingBtnBlue}
                          >
                            👑 BLUE WIN
                          </button>
                          <button
                            onClick={() =>
                              handleWinnerChange(match.id, "teamB")
                            }
                            className={styles.pendingBtnRed}
                          >
                            👑 RED WIN
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(match.id)}
                      className={styles.deleteBtn}
                      title="Purge record"
                    >
                      <svg className={styles.deleteIcon} viewBox="0 0 24 24">
                        <path d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9m2 2h2v1h-2V5m-3 3h2v10H8V8m4 0h2v10h-2V8m4 0h2v10h-2V8z" />
                      </svg>
                      PURGE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Tab Contents: FIGHTER WINRATES */}
      {activeTab === "stats" && (
        <div className="flex flex-col gap-4">
          {/* Sub-tabs for Current Season vs All-Time */}
          <div className="flex justify-center border-b-2 border-slate-800 pb-2.5 mb-2 gap-3 select-none">
            <button
              onClick={() => {
                playBeep(260, 0.1, "sine");
                setStatsSubTab("season");
              }}
              className={`font-pixel text-[8.5px] px-3.5 py-1.5 cursor-pointer border transition-all ${
                statsSubTab === "season"
                  ? "bg-neon-yellow border-white text-black font-bold glow-yellow"
                  : "border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              🏆 CURRENT SEASON
            </button>
            <button
              onClick={() => {
                playBeep(260, 0.1, "sine");
                setStatsSubTab("alltime");
              }}
              className={`font-pixel text-[8.5px] px-3.5 py-1.5 cursor-pointer border transition-all ${
                statsSubTab === "alltime"
                  ? "bg-neon-yellow border-white text-black font-bold glow-yellow"
                  : "border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              🌍 ALL-TIME
            </button>
          </div>

          {playerStats.length > 0 && (
            <PodiumStandings
              firstPlace={podiumData.firstPlace}
              secondPlace={podiumData.secondPlace}
              thirdPlace={podiumData.thirdPlace}
              lastPlace={podiumData.lastPlace}
            />
          )}

          {playerStats.length === 0 ? (
            <div className={styles.emptyStateContainer}>
              <span className={styles.emptyStateTitle}>NO FIGHTER STATS</span>
              <span className={styles.emptyStateSubtitle}>
                CHOOSE WINNERS IN THE HISTORY LOG TO GENERATE LEADERBOARD DATA!
              </span>
            </div>
          ) : (
            <div className={styles.leaderboardList}>
              {/* Header row (Only on desktop) */}
              <div className={styles.leaderboardHeader}>
                <div className={styles.leaderboardCol2}>RANK</div>
                <div className={styles.leaderboardCol4}>FIGHTER NAME</div>
                <div className={styles.leaderboardCol2Center}>MATCHES</div>
                <div className={styles.leaderboardCol2Center}>RECORD (W-L)</div>
                <div className={styles.leaderboardCol2Right}>WIN RATE</div>
              </div>

              {/* Leaderboard Cards */}
              {playerStats.map((stats, index) => {
                if (index < 3) return null;
                const rankLabel = `${index + 1}TH`;
                const rankColorStyle = styles.rankBadgeNormal;

                const displayMatches =
                  statsSubTab === "season"
                    ? stats.matches
                    : stats.allTimeMatches;
                const displayWins =
                  statsSubTab === "season" ? stats.wins : stats.allTimeWins;
                const displayLosses =
                  statsSubTab === "season" ? stats.losses : stats.allTimeLosses;
                const displayWinrate =
                  statsSubTab === "season"
                    ? stats.winrate
                    : stats.allTimeWinrate;

                return (
                  <div
                    key={stats.name}
                    className={`${styles.leaderboardCard} ${
                      index === 0
                        ? styles.leaderboardCardWinner
                        : styles.leaderboardCardNormal
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className={styles.leaderboardCol2}>
                      <span className={`${styles.rankBadge} ${rankColorStyle}`}>
                        {rankLabel}
                      </span>
                    </div>

                    {/* Fighter Name, Avatar, Alias, Role & Rank details */}
                    <div
                      className={`${styles.leaderboardCol4} ${styles.fighterInfo}`}
                    >
                      <div className={styles.fighterAvatarContainer}>
                        <Image
                          src={
                            stats.dbPlayer?.avatar ||
                            `https://api.dicebear.com/9.x/pixel-art/svg?seed=${stats.name.toLowerCase()}&backgroundColor=1a1a2e`
                          }
                          alt={stats.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className={styles.fighterTextContainer}>
                        <span
                          className={`${styles.fighterName} ${
                            /[\u0E00-\u0E7F]/.test(stats.name)
                              ? styles.fighterNameThai
                              : styles.fighterNameEnglish
                          }`}
                        >
                          {stats.name}
                        </span>
                        {renderRankInfo(stats.dbPlayer)}
                      </div>
                    </div>

                    {/* Matches Count */}
                    <div className={styles.statColMatches}>
                      <span className={styles.mobileLabel}>MATCHES:</span>
                      {displayMatches} M
                    </div>

                    {/* W/L Record */}
                    <div className={styles.statColRecord}>
                      <span className={styles.mobileLabel}>RECORD:</span>
                      <span className={styles.winsText}>{displayWins}W</span>
                      <span className={styles.dividerText}>/</span>
                      <span className={styles.lossesText}>
                        {displayLosses}L
                      </span>
                    </div>

                    {/* Interactive Win Rate & Progress Bar */}
                    <div className={styles.statColWinrate}>
                      <span className={styles.mobileLabel}>WIN RATE:</span>
                      <div className={styles.winrateWrapper}>
                        <span className={styles.winrateValue}>
                          {displayWinrate.toFixed(1)}%
                        </span>
                        {/* visual glow progress bar */}
                        <div className={styles.progressBarOuter}>
                          <div
                            className={styles.progressBarInner}
                            style={{ width: `${displayWinrate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
