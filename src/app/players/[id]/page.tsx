"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
import styles from "./styles.module.css";
import { fetchPlayers, fetchAllMatches, DbPlayer } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlayerProfilePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const playerId = resolvedParams.id;

  const [player, setPlayer] = useState<DbPlayer | null>(null);
  const [overallStats, setOverallStats] = useState({
    matches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    likes: 0,
    dislikes: 0,
  });
  const [laneStats, setLaneStats] = useState<
    Record<
      string,
      { matches: number; wins: number; losses: number; winRate: number }
    >
  >({});
  const [matchHistory, setMatchHistory] = useState<
    Array<{
      id: string;
      date: number;
      team: string;
      lane: string;
      outcome: "WIN" | "LOSS" | "PENDING";
      feedback: { likes: number; dislikes: number };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [players, matches] = await Promise.all([
          fetchPlayers(),
          fetchAllMatches(),
        ]);

        const key = playerId.toLowerCase();
        let foundPlayer = players.find(
          (p) => p.id === key || p.name.toLowerCase() === key,
        );

        if (!foundPlayer) {
          foundPlayer = {
            id: key,
            name: playerId,
            alias: "UNREGISTERED",
            avatar: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${key}&backgroundColor=1a1a2e`,
            current_rank: "Unranked",
            highest_rank: "Unranked",
            role: "ALL-ROUNDER",
            winrate: 0,
            total_match_played: 0,
            imageURL: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${key}&backgroundColor=1a1a2e`,
          };
        }
        setPlayer(foundPlayer);

        // Calculate statistics
        let totalMatches = 0;
        let totalWins = 0;
        let totalLosses = 0;
        let totalLikes = 0;
        let totalDislikes = 0;

        const defaultLanes = ["Top", "Jungle", "Mid", "ADC", "Support"];
        const laneCounters: Record<
          string,
          { matches: number; wins: number; losses: number }
        > = {};
        defaultLanes.forEach((l) => {
          laneCounters[l] = { matches: 0, wins: 0, losses: 0 };
        });

        const history: Array<{
          id: string;
          date: number;
          team: string;
          lane: string;
          outcome: "WIN" | "LOSS" | "PENDING";
          feedback: { likes: number; dislikes: number };
        }> = [];

        matches.forEach((match) => {
          const isTeamA = match.teamA.some(
            (p) =>
              p.toLowerCase() === foundPlayer!.id.toLowerCase() ||
              p.toLowerCase() === foundPlayer!.name.toLowerCase(),
          );
          const isTeamB = match.teamB.some(
            (p) =>
              p.toLowerCase() === foundPlayer!.id.toLowerCase() ||
              p.toLowerCase() === foundPlayer!.name.toLowerCase(),
          );

          if (!isTeamA && !isTeamB) return;

          const team = isTeamA ? "Blue Team" : "Red Team";

          // Determine lane played
          let lane = "";
          let playerIdx = -1;
          if (isTeamA) {
            playerIdx = match.teamA.findIndex(
              (p) =>
                p.toLowerCase() === foundPlayer!.id.toLowerCase() ||
                p.toLowerCase() === foundPlayer!.name.toLowerCase(),
            );
            lane =
              match.teamALanes?.[playerIdx] ||
              defaultLanes[playerIdx] ||
              "Unknown";
          } else {
            playerIdx = match.teamB.findIndex(
              (p) =>
                p.toLowerCase() === foundPlayer!.id.toLowerCase() ||
                p.toLowerCase() === foundPlayer!.name.toLowerCase(),
            );
            lane =
              match.teamBLanes?.[playerIdx] ||
              defaultLanes[playerIdx] ||
              "Unknown";
          }

          // Determine feedback
          const playerKeyInMatch = isTeamA
            ? match.teamA[playerIdx]
            : match.teamB[playerIdx];
          const feedback = match.feedback?.[playerKeyInMatch.toLowerCase()] || {
            likes: 0,
            dislikes: 0,
          };
          totalLikes += feedback.likes || 0;
          totalDislikes += feedback.dislikes || 0;

          // Determine outcome
          let outcome: "WIN" | "LOSS" | "PENDING" = "PENDING";
          if (match.winner) {
            if (
              (match.winner === "teamA" && isTeamA) ||
              (match.winner === "teamB" && isTeamB)
            ) {
              outcome = "WIN";
              totalWins++;
              if (laneCounters[lane]) {
                laneCounters[lane].wins++;
                laneCounters[lane].matches++;
              }
            } else {
              outcome = "LOSS";
              totalLosses++;
              if (laneCounters[lane]) {
                laneCounters[lane].losses++;
                laneCounters[lane].matches++;
              }
            }
            totalMatches++;
          } else {
            // Pending match - still count lane usage but not win/loss outcomes
            if (laneCounters[lane]) {
              laneCounters[lane].matches++;
            }
          }

          history.push({
            id: match.id,
            date: match.createdAt,
            team,
            lane,
            outcome,
            feedback,
          });
        });

        // Set overall stats
        setOverallStats({
          matches: totalMatches,
          wins: totalWins,
          losses: totalLosses,
          winRate:
            totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
          likes: totalLikes,
          dislikes: totalDislikes,
        });

        // Calculate lane win rates
        const resolvedLaneStats: Record<
          string,
          { matches: number; wins: number; losses: number; winRate: number }
        > = {};
        defaultLanes.forEach((l) => {
          const stats = laneCounters[l];
          resolvedLaneStats[l] = {
            matches: stats.matches,
            wins: stats.wins,
            losses: stats.losses,
            winRate:
              stats.matches > 0
                ? Math.round((stats.wins / stats.matches) * 100)
                : 0,
          };
        });
        setLaneStats(resolvedLaneStats);

        // Set match history sorted descending by date
        setMatchHistory(history.sort((a, b) => b.date - a.date));
      } catch (err) {
        console.error("Failed to load player profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [playerId]);

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

  if (loading) {
    return (
      <CRTOverlay>
        <div className={styles.loadingContainer}>
          <span className={styles.loadingText}>
            ACCESSING FIGHTER RECORDS...
          </span>
        </div>
      </CRTOverlay>
    );
  }

  const defaultLanes = ["Top", "Jungle", "Mid", "ADC", "Support"];
  const lanesPlayed = defaultLanes.filter(
    (lane) => (laneStats[lane]?.matches || 0) > 0,
  );

  return (
    <CRTOverlay>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerBorderLine} />
          <div className={styles.headerTitleContainer}>
            <h1 className={styles.headerTitle}>HEROES OF MADNESS</h1>
            <p className={styles.headerSubtitle}>
              🎮 FIGHTER INFORMATION DOSSIER
            </p>
          </div>
          <Link
            href="/"
            onClick={() => playBeep(250, 0.1, "sawtooth")}
            className={styles.backBtn}
          >
            ✕ BACK TO ARENA
          </Link>
        </header>

        <main className={styles.main}>
          {player && (
            <div className={styles.grid}>
              {/* Profile Card */}
              <div className={styles.profileCard}>
                <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

                <div className={styles.profileHeader}>
                  <div className={styles.avatarWrapper}>
                    <img
                      src={
                        player.avatar ||
                        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${player.id}&backgroundColor=1a1a2e`
                      }
                      alt={player.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className={styles.profileText}>
                    <h2
                      className={`${styles.playerName} ${/[\u0E00-\u0E7F]/.test(player.name) ? styles.thaiFont : styles.englishFont}`}
                    >
                      {player.name}
                    </h2>
                    <p className={styles.playerAlias}>{player.alias}</p>
                    <p className={styles.playerRank}>
                      {player.current_rank.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className={styles.feedbackDossier}>
                  <span className={styles.sectionLabel}>
                    COMMUNITY EVALUATION
                  </span>
                  <div className={styles.feedbackGrid}>
                    <div className={styles.feedbackBoxLikes}>
                      <span className={styles.feedbackEmoji}>👍</span>
                      <span className={styles.feedbackValue}>
                        {overallStats.likes}
                      </span>
                      <span className={styles.feedbackLabel}>
                        LIKES RECEIVED
                      </span>
                    </div>
                    <div className={styles.feedbackBoxDislikes}>
                      <span className={styles.feedbackEmoji}>👎</span>
                      <span className={styles.feedbackValue}>
                        {overallStats.dislikes}
                      </span>
                      <span className={styles.feedbackLabel}>
                        DISLIKES RECEIVED
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Statistics */}
              <div className={styles.statsCard}>
                <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

                <h3 className={styles.cardTitle}>OVERALL COMBAT DATA</h3>

                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>MATCHES</span>
                    <span className={styles.statValue}>
                      {overallStats.matches}
                    </span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>VICTORIES</span>
                    <span className={styles.statValueBlue}>
                      {overallStats.wins}
                    </span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>DEFEATS</span>
                    <span className={styles.statValueRed}>
                      {overallStats.losses}
                    </span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>WIN RATE</span>
                    <span className={styles.statValueYellow}>
                      {overallStats.winRate}%
                    </span>
                  </div>
                </div>

                <div className={styles.winRateProgressContainer}>
                  <div className={styles.progressLabelRow}>
                    <span>WIN RATE RATIO</span>
                    <span>{overallStats.winRate}%</span>
                  </div>
                  <div className={styles.progressBarOuter}>
                    <div
                      className={styles.progressBarInner}
                      style={{ width: `${overallStats.winRate}%` }}
                    />
                  </div>
                </div>

                <div className={styles.laneHistorySection}>
                  <span className={styles.sectionLabel}>
                    LANE DEPLOYMENT LOG
                  </span>
                  <div className={styles.laneBadges}>
                    {lanesPlayed.length === 0 ? (
                      <span className={styles.noLanesText}>
                        NO DEPLOYMENT DATA
                      </span>
                    ) : (
                      lanesPlayed.map((lane) => (
                        <span key={lane} className={styles.laneBadge}>
                          {lane.toUpperCase()}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Lane Statistics */}
              <div className={styles.laneStatsCard}>
                <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

                <h3 className={styles.cardTitle}>LANE SPECIFIC METRICS</h3>

                <div className={styles.laneStatsGrid}>
                  {defaultLanes.map((lane) => {
                    const stats = laneStats[lane] || {
                      matches: 0,
                      wins: 0,
                      losses: 0,
                      winRate: 0,
                    };
                    return (
                      <div key={lane} className={styles.laneStatBox}>
                        <div className={styles.laneStatHeader}>
                          <span className={styles.laneStatName}>
                            {lane.toUpperCase()}
                          </span>
                          <span className={styles.laneStatMatches}>
                            {stats.matches} PLAYED
                          </span>
                        </div>
                        <div className={styles.laneStatData}>
                          <div className={styles.laneStatRow}>
                            <span>RECORD (W-L)</span>
                            <span className={styles.laneRecord}>
                              <span className={styles.winsText}>
                                {stats.wins}W
                              </span>
                              <span className={styles.slash}>/</span>
                              <span className={styles.lossesText}>
                                {stats.losses}L
                              </span>
                            </span>
                          </div>
                          <div className={styles.laneStatRow}>
                            <span>WIN RATE</span>
                            <span className={styles.laneWinRate}>
                              {stats.winRate}%
                            </span>
                          </div>
                        </div>
                        {stats.matches > 0 && (
                          <div className={styles.laneProgressBarOuter}>
                            <div
                              className={styles.laneProgressBarInner}
                              style={{ width: `${stats.winRate}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Complete Match History */}
              <div className={styles.historyCard}>
                <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
                <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

                <h3 className={styles.cardTitle}>HISTORICAL BATTLE LOGS</h3>

                {matchHistory.length === 0 ? (
                  <div className={styles.emptyHistory}>
                    NO COMBAT RECORDS FOUND
                  </div>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeaderRow}>
                          <th className={styles.tableHeaderCell}>DATE</th>
                          <th className={styles.tableHeaderCell}>TEAM</th>
                          <th className={styles.tableHeaderCell}>LANE</th>
                          <th className={styles.tableHeaderCell}>FEEDBACK</th>
                          <th className={styles.tableHeaderCell}>OUTCOME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchHistory.map((m, idx) => (
                          <tr key={idx} className={styles.tableBodyRow}>
                            <td className={styles.dateCell}>
                              {formatDate(m.date)}
                            </td>
                            <td className={styles.teamCell}>
                              <span
                                className={
                                  m.team === "Blue Team"
                                    ? styles.teamBlue
                                    : styles.teamRed
                                }
                              >
                                {m.team.toUpperCase()}
                              </span>
                            </td>
                            <td className={styles.laneCell}>
                              {m.lane.toUpperCase()}
                            </td>
                            <td className={styles.feedbackCell}>
                              <span className={styles.likeText}>
                                👍 {m.feedback.likes}
                              </span>
                              <span className={styles.feedbackSpacer}>|</span>
                              <span className={styles.dislikeText}>
                                👎 {m.feedback.dislikes}
                              </span>
                            </td>
                            <td className={styles.outcomeCell}>
                              <span
                                className={
                                  m.outcome === "WIN"
                                    ? styles.outcomeWin
                                    : m.outcome === "LOSS"
                                      ? styles.outcomeLoss
                                      : styles.outcomePending
                                }
                              >
                                {m.outcome}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <span>
            HEROES OF MADNESS PRO v1.0.0 © Geminus-Dev 2026 by nutty dev`~`
          </span>
        </footer>

        <DebugBar />
      </div>
    </CRTOverlay>
  );
}
