"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
import PodiumStandings from "@/components/PodiumStandings";
import styles from "./styles.module.css";
import {
  Season,
  Match,
  fetchSeasons,
  fetchAllMatches,
  seedMockSeasons,
  clearMockSeasons,
} from "@/utils/firebase";
import { playBeep, playWin } from "@/utils/audio";

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "matches">(
    "leaderboard",
  );
  const [audioInitialized, setAudioInitialized] = useState(false);

  const handleSeedMockData = async () => {
    playBeep(220, 0.15, "sawtooth");
    const confirmSeed = window.confirm(
      "Do you want to seed mock Season 1 and Season 2 data for testing?",
    );
    if (!confirmSeed) return;

    setLoading(true);
    const success = await seedMockSeasons();
    if (success) {
      playWin();
      alert("Mock season data successfully seeded! Reloading page...");
      window.location.reload();
    } else {
      alert("Failed to seed mock seasons.");
      setLoading(false);
    }
  };

  const handleClearMockData = async () => {
    playBeep(150, 0.15, "sawtooth");
    const confirmClear = window.confirm(
      "Are you sure you want to delete mock Season 1 and Season 2 and reset config to Season 1?",
    );
    if (!confirmClear) return;

    setLoading(true);
    const success = await clearMockSeasons();
    if (success) {
      playWin();
      alert("Mock season data successfully cleared! Reloading page...");
      window.location.reload();
    } else {
      alert("Failed to clear mock seasons.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [archive, allMatches] = await Promise.all([
          fetchSeasons(),
          fetchAllMatches(),
        ]);
        setSeasons(archive);
        setMatches(allMatches);

        if (archive.length > 0) {
          // Select the latest archived season by default
          const sorted = [...archive].sort((a, b) => b.id - a.id);
          setSelectedSeasonId(sorted[0].id);
        }
      } catch (err) {
        console.error("Failed to load seasons history:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const initAudioFeedback = () => {
    if (!audioInitialized) {
      setAudioInitialized(true);
    }
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || null;

  // Filter matches of selected season
  const seasonMatches =
    selectedSeasonId !== null
      ? matches.filter((m) => m.seasonId === selectedSeasonId)
      : [];

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

  const getFighterDisplayName = (nameOrId: string) => {
    if (!selectedSeason) return nameOrId;
    const found = selectedSeason.fighterStats.find(
      (fs) =>
        fs.id === nameOrId.toLowerCase() ||
        fs.name.toLowerCase() === nameOrId.toLowerCase(),
    );
    return found ? found.name : nameOrId;
  };

  // Find podium positions
  const firstPlace = selectedSeason?.podium.find((_, i) => i === 0) || null;
  const secondPlace = selectedSeason?.podium.find((_, i) => i === 1) || null;
  const thirdPlace = selectedSeason?.podium.find((_, i) => i === 2) || null;
  const lastPlace = selectedSeason?.lastPlace || null;

  if (loading) {
    return (
      <CRTOverlay>
        <div className={styles.loadingContainer}>
          <span className={styles.loadingText}>
            LOADING HISTORICAL INDEXES...
          </span>
        </div>
      </CRTOverlay>
    );
  }

  return (
    <CRTOverlay>
      <div className={styles.container} onClick={initAudioFeedback}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerBorderLine} />

          <div className={styles.headerTitleContainer}>
            <h1 className={styles.headerTitle}>HEROES OF MADNESS</h1>
            <p className={styles.headerSubtitle}>
              🏆 SEASON HALL OF FAME RECORD
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
          {seasons.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={styles.emptyEmoji}>🏜️</span>
              <span className={styles.emptyTitle}>NO SEASONS ARCHIVED YET</span>
              <p className={styles.emptyDesc}>
                THE FIRST SEASON IS CURRENTLY RUNNING. ONCE AN ADMIN CLOSES THE
                SEASON IN SETTINGS, ITS ARCHIVES WILL RECORD HERE!
              </p>

              <button
                onClick={handleSeedMockData}
                className={styles.seedBtn}
              >
                🛠️ SEED SEASONS MOCK DATA
              </button>

              <Link
                href="/"
                onClick={() => playBeep(250, 0.1, "sawtooth")}
                className={styles.returnBtn}
              >
                ✕ RETURN TO PLAY
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Season Selector Card */}
              <div className={styles.selectorCard}>
                <div className={styles.selectorControls}>
                  <span className={styles.selectLabel}>BROWSE RECORD:</span>
                  <select
                    value={selectedSeasonId || ""}
                    onChange={(e) => {
                      playBeep(330, 0.1, "sine");
                      setSelectedSeasonId(Number(e.target.value));
                    }}
                    className={styles.selectBox}
                  >
                    {[...seasons]
                      .sort((a, b) => b.id - a.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name.toUpperCase()}
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={handleClearMockData}
                    className={styles.clearBtn}
                  >
                    ✕ CLEAR MOCK DATA
                  </button>
                </div>

                <div className={styles.durationText}>
                  {selectedSeason && (
                    <>
                      DURATION:{" "}
                      {new Date(selectedSeason.startDate).toLocaleDateString()}{" "}
                      - {new Date(selectedSeason.endDate).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>

              {/* PODIUM STANDINGS DISPLAY */}
              {selectedSeason && (
                <PodiumStandings
                  firstPlace={firstPlace}
                  secondPlace={secondPlace}
                  thirdPlace={thirdPlace}
                  lastPlace={lastPlace}
                />
              )}

              {/* TABS FOR STANDINGS VS MATCHES */}
              <div className={styles.tabsList}>
                <button
                  onClick={() => {
                    playBeep(330, 0.1, "sine");
                    setActiveTab("leaderboard");
                  }}
                  className={`${styles.tabBtn} ${
                    activeTab === "leaderboard"
                      ? styles.tabBtnActive
                      : styles.tabBtnInactive
                  }`}
                >
                  🏆 FINAL LEADERBOARD
                </button>
                <button
                  onClick={() => {
                    playBeep(330, 0.1, "sine");
                    setActiveTab("matches");
                  }}
                  className={`${styles.tabBtn} ${
                    activeTab === "matches"
                      ? styles.tabBtnActive
                      : styles.tabBtnInactive
                  }`}
                >
                  📜 SEASON MATCHES
                </button>
              </div>

              {/* Leaderboard Table Tab */}
              {activeTab === "leaderboard" && selectedSeason && (
                <div className={styles.card}>
                  <span className={styles.cardTitle}>
                    FINAL STANDINGS RULEBOOK
                  </span>

                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeaderRow}>
                          <th className={styles.tableHeaderCell}>Rank</th>
                          <th className={styles.tableHeaderCell}>Fighter</th>
                          <th className={styles.tableHeaderCell}>Matches</th>
                          <th className={styles.tableHeaderCell}>Win Rate</th>
                          <th className={styles.tableHeaderCell}>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.fighterStats
                          .sort(
                            (a, b) =>
                              b.winrate - a.winrate ||
                              b.total_match_played - a.total_match_played,
                          )
                          .map((stat, idx) => (
                            <tr
                              key={stat.id}
                              className={styles.tableBodyRow}
                            >
                              <td className={styles.rankCell}>
                                #{idx + 1}
                              </td>
                              <td className={styles.fighterCell}>
                                <div className={styles.miniAvatarWrapper}>
                                  <Image
                                    src={
                                      stat.avatar ||
                                      `https://api.dicebear.com/9.x/pixel-art/svg?seed=${stat.name.toLowerCase()}`
                                    }
                                    alt={stat.name}
                                    fill
                                    className={styles.avatarImage}
                                    unoptimized
                                  />
                                </div>
                                <span className={styles.fighterCellName}>
                                  {stat.name}
                                </span>
                              </td>
                              <td className={styles.matchesCell}>
                                {stat.total_match_played} M
                              </td>
                              <td className={styles.winrateCell}>
                                {stat.winrate}%
                              </td>
                              <td className={styles.rankCellWrapper}>
                                <span className={styles.rankBadge}>
                                  {stat.current_rank}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Match Logs Tab */}
              {activeTab === "matches" && (
                <div className={styles.battleLogsCard}>
                  <span className={styles.battleLogsTitle}>
                    ARCHIVED BATTLE LOGS ({seasonMatches.length} RECORDS)
                  </span>

                  {seasonMatches.length === 0 ? (
                    <div className={styles.emptyBattleLogs}>
                      <span className={styles.emptyBattleLogsText}>
                        NO BATTLES RECORDED IN THIS SEASON.
                      </span>
                    </div>
                  ) : (
                    <div className={styles.battleLogList}>
                      {seasonMatches.map((match) => (
                        <div
                          key={match.id}
                          className={styles.battleLogCard}
                        >
                          <div className={styles.battleLogDetails}>
                            <div className={styles.battleLogMetaRow}>
                              <span className={styles.battleLogRecordTag}>
                                ARCHIVED RECORD
                              </span>
                              <span className={styles.battleLogTime}>
                                {formatDate(match.createdAt)}
                              </span>
                            </div>

                            {/* Teams render */}
                            <div className={styles.battleLogTeamsRow}>
                              <div className={styles.teamCol}>
                                <span className={styles.teamNameBlue}>
                                  {match.winner === "teamA"
                                    ? "👑 TEAM BLUE (WIN)"
                                    : "TEAM BLUE"}
                                </span>
                                <span className={styles.fightersListText}>
                                  {match.teamA
                                    .map((p) => getFighterDisplayName(p))
                                    .join(", ")}
                                </span>
                              </div>
                              <div className={styles.teamColWithDivider}>
                                <span className={styles.teamNameRed}>
                                  {match.winner === "teamB"
                                    ? "👑 TEAM RED (WIN)"
                                    : "TEAM RED"}
                                </span>
                                <span className={styles.fightersListText}>
                                  {match.teamB
                                    .map((p) => getFighterDisplayName(p))
                                    .join(", ")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.battleLogActions}>
                            <span className={styles.completedBadge}>
                              COMPLETED
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
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
