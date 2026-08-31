"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Match,
  DbPlayer,
  RankConfig,
  SeasonPlayerStat,
  getWeightedWinrate,
  togglePlayerFeedback,
  PlayerFeedback,
} from "@/utils/firebase";
import styles from "./styles.module.css";
import { playBeep, playWin } from "@/utils/audio";
import PodiumStandings from "@/components/PodiumStandings";
import { useAuth } from "@/utils/AuthContext";

interface HistoryDashboardProps {
  matches: Match[];
  onDeleteMatch: (id: string) => void;
  onDeleteAllMatches: () => void;
  onUpdateWinner: (id: string, winner: "teamA" | "teamB") => void;
  availablePlayers: DbPlayer[];
  rankConfig: RankConfig;
  isAdmin?: boolean;
  activeSeasonId?: number;
}

interface MatchCardProps {
  match: Match;
  availablePlayers: DbPlayer[];
  isAdmin: boolean;
  getPlayerDisplayName: (idOrName: string) => string;
  getPlayerKey: (idOrName: string) => string;
  formatDate: (timestamp: number) => string;
  editingMatchId: string | null;
  setEditingMatchId: (id: string | null) => void;
  handleWinnerChange: (id: string, winner: "teamA" | "teamB") => void;
  handleDelete: (id: string) => void;
}

function MatchCardComponent({
  match,
  availablePlayers,
  isAdmin,
  getPlayerDisplayName,
  getPlayerKey,
  formatDate,
  editingMatchId,
  setEditingMatchId,
  handleWinnerChange,
  handleDelete,
}: MatchCardProps) {
  const { user } = useAuth();
  const [prevFeedback, setPrevFeedback] = useState(match.feedback);
  const [localFeedback, setLocalFeedback] = useState<{
    [playerKey: string]: PlayerFeedback;
  }>(match.feedback || {});

  // Sync localFeedback if match updates
  if (match.feedback !== prevFeedback) {
    setPrevFeedback(match.feedback);
    setLocalFeedback(match.feedback || {});
  }

  const handleFeedbackClick = async (
    playerKey: string,
    type: "likes" | "dislikes",
  ) => {
    if (!user) {
      playBeep(200, 0.1, "sine");
      alert("Please log in to rate player performance.");
      return;
    }

    playBeep(440, 0.05, "sine", 0.1);
    const updatedFb = await togglePlayerFeedback(
      match.id,
      playerKey,
      type,
      user.uid,
    );

    if (updatedFb) {
      setLocalFeedback((prev) => {
        const pKeyLower = playerKey.toLowerCase();
        return {
          ...prev,
          [playerKey]: updatedFb,
          [pKeyLower]: updatedFb,
        };
      });
    }
  };

  const renderRoster = (team: string[], lanes: string[] | undefined) => {
    const defaultLanes = ["Top", "Jungle", "Mid", "ADC", "Support"];
    return (
      <div className={styles.rosterList}>
        {team.map((playerNameOrId, idx) => {
          const pKey = getPlayerKey(playerNameOrId);
          const name = getPlayerDisplayName(playerNameOrId);
          const dbPlayer = availablePlayers.find((p) => p.id === pKey);
          const lane = lanes ? lanes[idx] : defaultLanes[idx];
          const feedback = localFeedback[pKey] ||
            localFeedback[pKey.toLowerCase()] || { likes: 0, dislikes: 0 };
          const userVote =
            user && feedback.userVotes ? feedback.userVotes[user.uid] : null;
          const isLiked = userVote === "likes";
          const isDisliked = userVote === "dislikes";

          return (
            <div key={idx} className={styles.rosterRow}>
              <div className={styles.rosterPlayerInfo}>
                <div className={styles.miniAvatar}>
                  <img
                    src={
                      dbPlayer?.avatar ||
                      `https://api.dicebear.com/9.x/pixel-art/svg?seed=${pKey}&backgroundColor=1a1a2e`
                    }
                    alt={name}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className={styles.playerMeta}>
                  <span className={styles.playerName}>{name}</span>
                  <span className={styles.playerLaneBadge}>{lane}</span>
                </div>
              </div>

              <div className={styles.playerActions}>
                <Link
                  href={`/players/${pKey}`}
                  onClick={() => playBeep(300, 0.1, "sine")}
                  className={styles.profileLinkBtn}
                >
                  PROFILE 👤
                </Link>

                <div className={styles.feedbackContainer}>
                  <button
                    onClick={() => handleFeedbackClick(pKey, "likes")}
                    className={`${styles.likeBtn} ${isLiked ? styles.activeLikeBtn : ""} ${!user ? styles.disabledFeedbackBtn : ""}`}
                    title={
                      !user
                        ? "Log in to rate performance"
                        : isLiked
                          ? "Click to remove like"
                          : "Like performance"
                    }
                  >
                    👍{" "}
                    <span className={styles.feedbackCount}>
                      {feedback.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => handleFeedbackClick(pKey, "dislikes")}
                    className={`${styles.dislikeBtn} ${isDisliked ? styles.activeDislikeBtn : ""} ${!user ? styles.disabledFeedbackBtn : ""}`}
                    title={
                      !user
                        ? "Log in to rate performance"
                        : isDisliked
                          ? "Click to remove dislike"
                          : "Dislike performance"
                    }
                  >
                    👎{" "}
                    <span className={styles.feedbackCount}>
                      {feedback.dislikes}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.matchCardContainer}>
      <div className={styles.matchCard}>
        {/* Match Details */}
        <div className={styles.matchDetails}>
          {/* Header labels */}
          <div className={styles.matchDetailsHeader}>
            <span className={styles.matchDetailsHeaderTag}>MATCH LOG</span>
            <span className={styles.matchDetailsHeaderDate}>
              {formatDate(match.createdAt)}
            </span>
          </div>

          {/* Team roster grid */}
          <div className={styles.rosterGrid}>
            {/* Blue */}
            <div className={styles.rosterCol}>
              <span className={styles.rosterLabelBlue}>BLUE TEAM</span>
              {renderRoster(match.teamA, match.teamALanes)}
            </div>
            {/* Red */}
            <div className={styles.rosterCol}>
              <span className={styles.rosterLabelRed}>RED TEAM</span>
              {renderRoster(match.teamB, match.teamBLanes)}
            </div>
          </div>
        </div>

        {/* Action column */}
        <div className={styles.matchActionsCol}>
          {/* Winner tag */}
          {match.winner && editingMatchId !== match.id ? (
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
              {isAdmin && (
                <button
                  onClick={() => {
                    playBeep(200, 0.1, "sine");
                    setEditingMatchId(match.id);
                  }}
                  className={styles.editWinnerBtn}
                  title="Edit match result"
                >
                  ✎ EDIT RESULT
                </button>
              )}
            </div>
          ) : (
            <div className={styles.pendingWrapper}>
              <span className={styles.pendingLabel}>
                {editingMatchId === match.id
                  ? "EDIT OUTCOME"
                  : "PENDING OUTCOME"}
              </span>
              {isAdmin && (
                <div className={styles.pendingBtnGrid}>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleWinnerChange(match.id, "teamA")}
                      className={styles.pendingBtnBlue}
                    >
                      👑 BLUE WIN
                    </button>
                    <button
                      onClick={() => handleWinnerChange(match.id, "teamB")}
                      className={styles.pendingBtnRed}
                    >
                      👑 RED WIN
                    </button>
                  </div>
                  {editingMatchId === match.id && (
                    <button
                      onClick={() => {
                        playBeep(150, 0.1, "sine");
                        setEditingMatchId(null);
                      }}
                      className={styles.cancelBtn}
                    >
                      ✕ CANCEL
                    </button>
                  )}
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
    </div>
  );
}

export default function HistoryDashboard({
  matches,
  onDeleteMatch,
  onDeleteAllMatches,
  onUpdateWinner,
  availablePlayers,
  rankConfig,
  isAdmin = false,
  activeSeasonId,
}: HistoryDashboardProps) {
  const [activeTab, setActiveTab] = React.useState<"history" | "stats">(
    "history",
  );
  const [statsSubTab, setStatsSubTab] = React.useState<"season" | "alltime">(
    "season",
  );
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(
    null,
  );
  const getPlayerKey = React.useCallback(
    (nameOrId: string) => {
      const found = availablePlayers.find(
        (p) =>
          p.id === nameOrId.toLowerCase() ||
          p.name.toLowerCase() === nameOrId.toLowerCase(),
      );
      return found ? found.id : nameOrId.toLowerCase();
    },
    [availablePlayers],
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
    const teamName = winner === "teamA" ? "BLUE TEAM" : "RED TEAM";
    const confirmSet = window.confirm(
      `🏆 CONFIRM OUTCOME: Are you sure you want to declare ${teamName} as the winner of this match?`,
    );
    if (confirmSet) {
      playWin();
      onUpdateWinner(id, winner);
      setEditingMatchId(null);
    }
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

    // Determine current active season ID
    const currentSeasonId =
      activeSeasonId !== undefined
        ? activeSeasonId
        : matches.length > 0
          ? Math.max(1, ...matches.map((m) => Number(m.seasonId) || 1))
          : 1;

    // 2. Accumulate stats from matches log ONLY for unregistered players/bots (to avoid double-counting)
    matches.forEach((match) => {
      if (!match.winner) return;

      const matchSeasonId =
        match.seasonId !== undefined ? Number(match.seasonId) : 1;
      const isCurrentSeason = matchSeasonId === currentSeasonId;

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
          if (isCurrentSeason) {
            statsMap[key].wins += 1;
            statsMap[key].matches += 1;
          }
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
          if (isCurrentSeason) {
            statsMap[key].losses += 1;
            statsMap[key].matches += 1;
          }
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

    // Filter out unregistered players with 0 matches in the selected tab view
    const filteredStatsList = statsList.filter((stat) => {
      const displayMatches =
        statsSubTab === "season" ? stat.matches : stat.allTimeMatches;
      return displayMatches > 0 || stat.dbPlayer !== undefined;
    });

    // Sort based on the selected sub-tab using fair weighted win rate (consider sample size).
    // Ranked players (matches >= rankConfig.minMatches) must stay at the top.
    // Unranked players must always stay at the bottom.
    return filteredStatsList.sort((a, b) => {
      const isSeason = statsSubTab === "season";
      const aWins = isSeason ? a.wins : a.allTimeWins;
      const bWins = isSeason ? b.wins : b.allTimeWins;
      const aMatches = isSeason ? a.matches : a.allTimeMatches;
      const bMatches = isSeason ? b.matches : b.allTimeMatches;

      const aRanked = aMatches >= rankConfig.minMatches;
      const bRanked = bMatches >= rankConfig.minMatches;

      if (aRanked !== bRanked) {
        return aRanked ? -1 : 1;
      }

      const aWeighted = getWeightedWinrate(aWins, aMatches);
      const bWeighted = getWeightedWinrate(bWins, bMatches);

      if (bWeighted !== aWeighted) {
        return bWeighted - aWeighted;
      }
      if (bMatches !== aMatches) {
        return bMatches - aMatches;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    matches,
    availablePlayers,
    statsSubTab,
    rankConfig.minMatches,
    activeSeasonId,
  ]);

  // Dynamically compute podium positions for the winrates tab based on statsSubTab selection
  const podiumData = React.useMemo(() => {
    const mapToSeasonPlayerStat = (
      stat: (typeof playerStats)[0],
      index: number,
      allStats: typeof playerStats,
    ): SeasonPlayerStat => {
      const isSeason = statsSubTab === "season";
      const totalMatches = isSeason ? stat.matches : stat.allTimeMatches;
      const wins = isSeason ? stat.wins : stat.allTimeWins;
      const losses = isSeason ? stat.losses : stat.allTimeLosses;
      const isRanked = totalMatches >= rankConfig.minMatches;
      const currentRank = stat.dbPlayer
        ? stat.dbPlayer.current_rank
        : isRanked
          ? "Normal"
          : "Unranked";

      let matchesToNextRank = undefined;
      let nextRankTarget = undefined;

      if (index > 0 && isRanked) {
        const targetStat = allStats[index - 1];
        const targetWins = isSeason ? targetStat.wins : targetStat.allTimeWins;
        const targetMatches = isSeason
          ? targetStat.matches
          : targetStat.allTimeMatches;
        const targetScore = getWeightedWinrate(targetWins, targetMatches);

        let extraWins = 1;
        while (true) {
          const score = getWeightedWinrate(
            wins + extraWins,
            totalMatches + extraWins,
          );
          if (score > targetScore) break;
          extraWins++;
          if (extraWins > 1000) break;
        }
        matchesToNextRank = extraWins;
        nextRankTarget = index;
      }

      return {
        id: stat.dbPlayer?.id || stat.name.toLowerCase(),
        name: stat.name,
        alias: stat.dbPlayer?.alias || "",
        avatar: stat.dbPlayer?.avatar || "",
        winrate: Math.round(isSeason ? stat.winrate : stat.allTimeWinrate),
        total_match_played: totalMatches,
        current_rank: currentRank,
        wins,
        losses,
        matchesToNextRank,
        nextRankTarget,
      };
    };

    const isSeason = statsSubTab === "season";
    const isPlayerRanked = (stat?: (typeof playerStats)[0]) => {
      if (!stat) return false;
      const totalMatches = isSeason ? stat.matches : stat.allTimeMatches;
      return totalMatches >= rankConfig.minMatches;
    };

    return {
      firstPlace:
        playerStats[0] && isPlayerRanked(playerStats[0])
          ? mapToSeasonPlayerStat(playerStats[0], 0, playerStats)
          : null,
      secondPlace:
        playerStats[1] && isPlayerRanked(playerStats[1])
          ? mapToSeasonPlayerStat(playerStats[1], 1, playerStats)
          : null,
      thirdPlace:
        playerStats[2] && isPlayerRanked(playerStats[2])
          ? mapToSeasonPlayerStat(playerStats[2], 2, playerStats)
          : null,
      lastPlace:
        playerStats.length > 3
          ? mapToSeasonPlayerStat(
              playerStats[playerStats.length - 1],
              playerStats.length - 1,
              playerStats,
            )
          : null,
    };
  }, [playerStats, statsSubTab, rankConfig]);

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
              <MatchCardComponent
                key={match.id}
                match={match}
                availablePlayers={availablePlayers}
                isAdmin={isAdmin}
                getPlayerDisplayName={getPlayerDisplayName}
                getPlayerKey={getPlayerKey}
                formatDate={formatDate}
                editingMatchId={editingMatchId}
                setEditingMatchId={setEditingMatchId}
                handleWinnerChange={handleWinnerChange}
                handleDelete={handleDelete}
              />
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
                const displayMatches =
                  statsSubTab === "season"
                    ? stats.matches
                    : stats.allTimeMatches;
                const isRanked = displayMatches >= rankConfig.minMatches;

                // Ranked players in top 3 are displayed on the PodiumStandings above
                if (index < 3 && isRanked) return null;

                const displayWins =
                  statsSubTab === "season" ? stats.wins : stats.allTimeWins;
                const displayLosses =
                  statsSubTab === "season" ? stats.losses : stats.allTimeLosses;
                const displayWinrate =
                  statsSubTab === "season"
                    ? stats.winrate
                    : stats.allTimeWinrate;

                let rankLabel = "UNRANKED";
                let rankColorStyle = styles.rankBadgeNormal;
                let nextRankMsg = "";

                if (!isRanked) {
                  const needed = rankConfig.minMatches - displayMatches;
                  nextRankMsg = `NEEDS ${needed} MATCH${needed > 1 ? "ES" : ""} FOR RANK`;
                } else {
                  const rankPos = index + 1;
                  const suffixes = ["TH", "ST", "ND", "RD"];
                  const v = rankPos % 100;
                  rankLabel =
                    rankPos +
                    (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);

                  if (rankPos === 1) {
                    rankColorStyle = styles.rankBadgeGold;
                  } else if (rankPos === 2) {
                    rankColorStyle = styles.rankBadgeSilver;
                  } else if (rankPos === 3) {
                    rankColorStyle = styles.rankBadgeBronze;
                  }

                  if (index > 0) {
                    const targetStat = playerStats[index - 1];
                    const targetWins =
                      statsSubTab === "season"
                        ? targetStat.wins
                        : targetStat.allTimeWins;
                    const targetMatches =
                      statsSubTab === "season"
                        ? targetStat.matches
                        : targetStat.allTimeMatches;
                    const targetScore = getWeightedWinrate(
                      targetWins,
                      targetMatches,
                    );

                    let extraWins = 1;
                    while (true) {
                      const score = getWeightedWinrate(
                        displayWins + extraWins,
                        displayMatches + extraWins,
                      );
                      if (score > targetScore) break;
                      extraWins++;
                      if (extraWins > 1000) break;
                    }
                    nextRankMsg = `NEEDS ${extraWins} WIN${extraWins > 1 ? "S" : ""} FOR RANK ${index}`;
                  } else {
                    nextRankMsg = "MAX RANK ACHIEVED";
                  }
                }

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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`${styles.fighterName} ${
                              /[\u0E00-\u0E7F]/.test(stats.name)
                                ? styles.fighterNameThai
                                : styles.fighterNameEnglish
                            }`}
                          >
                            {stats.name}
                          </span>
                          <Link
                            href={`/players/${stats.dbPlayer?.id || stats.name.toLowerCase()}`}
                            onClick={() => playBeep(300, 0.1, "sine")}
                            className="font-pixel text-[7.5px] border border-neon-blue/30 text-neon-blue/80 hover:text-neon-blue hover:border-neon-blue px-2 py-0.5 hover:bg-neon-blue/10 transition-all rounded-none uppercase select-none cursor-pointer"
                          >
                            PROFILE 👤
                          </Link>
                        </div>
                        {renderRankInfo(stats.dbPlayer)}
                        <div className="text-[7.5px] font-pixel text-slate-400 mt-1.5 uppercase tracking-wider">
                          {nextRankMsg}
                        </div>
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
