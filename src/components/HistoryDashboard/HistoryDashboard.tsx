"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Match,
  DbPlayer,
  RankConfig,
  SeasonPlayerStat,
  getWeightedWinrate,
  MatchComment,
  fetchComments,
  saveComment,
  incrementPlayerFeedback,
} from "@/utils/firebase";
import styles from "./styles.module.css";
import { playBeep, playWin, playCoin } from "@/utils/audio";
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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [prevFeedback, setPrevFeedback] = useState(match.feedback);
  const [localFeedback, setLocalFeedback] = useState<{
    [playerKey: string]: { likes: number; dislikes: number };
  }>(match.feedback || {});

  // Sync localFeedback if match updates
  if (match.feedback !== prevFeedback) {
    setPrevFeedback(match.feedback);
    setLocalFeedback(match.feedback || {});
  }

  useEffect(() => {
    if (showComments) {
      const loadComments = async () => {
        setLoadingComments(true);
        const list = await fetchComments(match.id);
        setComments(list);
        setLoadingComments(false);
      };
      loadComments();
    }
  }, [showComments, match.id]);

  const handleFeedbackClick = async (
    playerKey: string,
    type: "likes" | "dislikes",
  ) => {
    playBeep(440, 0.05, "sine", 0.1);
    const success = await incrementPlayerFeedback(match.id, playerKey, type);
    if (success) {
      setLocalFeedback((prev) => {
        const playerFeedback = prev[playerKey] || { likes: 0, dislikes: 0 };
        return {
          ...prev,
          [playerKey]: {
            ...playerFeedback,
            [type]: playerFeedback[type] + 1,
          },
        };
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    playCoin();
    const saved = await saveComment(match.id, newCommentText.trim());
    setComments((prev) => [...prev, saved]);
    setNewCommentText("");
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
          const feedback = localFeedback[pKey] || { likes: 0, dislikes: 0 };

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
                    className={styles.likeBtn}
                    title="Like performance"
                  >
                    👍{" "}
                    <span className={styles.feedbackCount}>
                      {feedback.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => handleFeedbackClick(pKey, "dislikes")}
                    className={styles.dislikeBtn}
                    title="Dislike performance"
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

          {/* Toggle comments button */}
          <button
            onClick={() => {
              playBeep(330, 0.1, "sine");
              setShowComments(!showComments);
            }}
            className={styles.commentsToggleBtn}
          >
            💬 COMMENTS {comments.length > 0 ? `(${comments.length})` : ""}
          </button>

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

      {/* Expanded Comments Section */}
      {showComments && (
        <div className={styles.commentsSection}>
          <h4 className={styles.commentsTitle}>ANONYMOUS COMMENTS</h4>

          <div className={styles.commentsList}>
            {loadingComments ? (
              <div className={styles.loadingComments}>
                LOADING TRANSMISSIONS...
              </div>
            ) : comments.length === 0 ? (
              <div className={styles.noComments}>
                NO TRANSMISSIONS YET. POST A COMMENT BELOW!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <span className={styles.anonymousUser}>GUEST_USER</span>
                    <span className={styles.commentTime}>
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className={styles.commentText}>{comment.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} className={styles.commentForm}>
            <input
              type="text"
              placeholder="ENTER ANONYMOUS RESPONSE..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className={styles.commentInput}
              maxLength={200}
            />
            <button type="submit" className={styles.commentSubmitBtn}>
              SEND 💬
            </button>
          </form>
        </div>
      )}
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

    // Sort based on the selected sub-tab using fair weighted win rate (consider sample size)
    return statsList.sort((a, b) => {
      const isSeason = statsSubTab === "season";
      const aWins = isSeason ? a.wins : a.allTimeWins;
      const bWins = isSeason ? b.wins : b.allTimeWins;
      const aMatches = isSeason ? a.matches : a.allTimeMatches;
      const bMatches = isSeason ? b.matches : b.allTimeMatches;

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
  }, [matches, availablePlayers, statsSubTab]);

  // Dynamically compute podium positions for the winrates tab based on statsSubTab selection
  const podiumData = React.useMemo(() => {
    const mapToSeasonPlayerStat = (
      stat: (typeof playerStats)[0],
    ): SeasonPlayerStat => {
      const isSeason = statsSubTab === "season";
      const totalMatches = isSeason ? stat.matches : stat.allTimeMatches;
      const currentRank = stat.dbPlayer
        ? stat.dbPlayer.current_rank
        : totalMatches >= rankConfig.minMatches
          ? "Normal"
          : "Unranked";

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
      secondPlace: playerStats[1]
        ? mapToSeasonPlayerStat(playerStats[1])
        : null,
      thirdPlace: playerStats[2] ? mapToSeasonPlayerStat(playerStats[2]) : null,
      lastPlace:
        playerStats.length > 3
          ? mapToSeasonPlayerStat(playerStats[playerStats.length - 1])
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
