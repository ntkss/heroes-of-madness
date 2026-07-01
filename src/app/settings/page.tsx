"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
import {
  RankConfig,
  fetchRankConfig,
  saveRankConfig,
  DEFAULT_RANK_CONFIG,
  fetchUsers,
  updateUserRole,
  DbUser,
  fetchSeasonConfig,
  endCurrentSeason,
  SeasonConfig,
} from "@/utils/firebase";
import { playBeep, playCoin, speakAnnounce } from "@/utils/audio";
import { useAuth } from "@/utils/AuthContext";
import styles from "./styles.module.css";

export default function SettingsPage() {
  const { user: currentAdmin, isAdmin, loading: authLoading } = useAuth();
  const [settingsTab, setSettingsTab] = useState<"ranks" | "users" | "seasons">(
    "ranks",
  );
  const [users, setUsers] = useState<DbUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [rankConfig, setRankConfig] = useState<RankConfig | null>(null);
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig | null>(null);
  const [seasonEnding, setSeasonEnding] = useState(false);

  const [highName, setHighName] = useState("");
  const [normalName, setNormalName] = useState("");
  const [lowName, setLowName] = useState("");
  const [minMatches, setMinMatches] = useState(3);
  const [highWinrate, setHighWinrate] = useState(55);
  const [lowWinrate, setLowWinrate] = useState(45);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    const fetched = await fetchUsers();
    setUsers(fetched);
    setUsersLoading(false);
  };

  const handleToggleUserRole = async (targetUser: DbUser) => {
    if (targetUser.uid === currentAdmin?.uid) {
      alert("SECURITY ALERT: YOU CANNOT DEMOTE YOURSELF!");
      return;
    }

    const newRole = targetUser.role === "admin" ? "user" : "admin";
    const confirmChange = window.confirm(
      `Are you sure you want to change ${targetUser.name || targetUser.email}'s role to ${newRole.toUpperCase()}?`,
    );
    if (!confirmChange) return;

    playCoin();
    const success = await updateUserRole(targetUser.uid, newRole);
    if (success) {
      loadUsers();
    } else {
      alert("Failed to update user role.");
    }
  };

  const handleEndSeason = async () => {
    if (!seasonConfig) return;

    const confirmText1 = `⚠️ WARNING: YOU ARE ABOUT TO ROLLOVER SEASON ${seasonConfig.activeSeasonId}!\n\nThis will archive all current match logs, freeze active standings, determine the podium (Top 3) & last place fighters, and reset all current season winrates and matches back to zero.\n\nAre you sure you want to proceed?`;
    const confirmText2 = `🚨 FINAL SEASONS AUDIT: Type "CONFIRM" in capital letters to proceed with initiating a new season.`;

    if (!window.confirm(confirmText1)) return;
    const userInput = window.prompt(confirmText2);
    if (userInput !== "CONFIRM") {
      alert("Season rollover cancelled.");
      return;
    }

    setSeasonEnding(true);
    playCoin();
    try {
      const success = await endCurrentSeason();
      if (success) {
        speakAnnounce(
          `SEASON ${seasonConfig.activeSeasonId} COMPLETED. NEW SEASON INITIALIZED.`,
        );
        playCoin();
        alert(
          `SUCCESS! Season ${seasonConfig.activeSeasonId} closed. Season ${seasonConfig.activeSeasonId + 1} has begun!`,
        );

        // Reload states
        const sCfg = await fetchSeasonConfig();
        setSeasonConfig(sCfg);

        const config = await fetchRankConfig();
        setRankConfig(config);
      } else {
        alert("Rollover process failed. Check developer console.");
      }
    } catch (e) {
      alert("Error rolled over: " + e);
    } finally {
      setSeasonEnding(false);
    }
  };

  useEffect(() => {
    if (isAdmin && settingsTab === "users") {
      const timer = setTimeout(() => {
        loadUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, settingsTab]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadConfig = async () => {
      const config = await fetchRankConfig();
      setRankConfig(config);
      setHighName(config.tiers.high);
      setNormalName(config.tiers.normal);
      setLowName(config.tiers.low);
      setMinMatches(config.minMatches);
      setHighWinrate(config.highTierWinrate);
      setLowWinrate(config.lowTierWinrate);

      const sCfg = await fetchSeasonConfig();
      setSeasonConfig(sCfg);
    };
    loadConfig();
  }, [isAdmin]);

  const handleReset = () => {
    playBeep(200, 0.1, "sawtooth");
    setHighName(DEFAULT_RANK_CONFIG.tiers.high);
    setNormalName(DEFAULT_RANK_CONFIG.tiers.normal);
    setLowName(DEFAULT_RANK_CONFIG.tiers.low);
    setMinMatches(DEFAULT_RANK_CONFIG.minMatches);
    setHighWinrate(DEFAULT_RANK_CONFIG.highTierWinrate);
    setLowWinrate(DEFAULT_RANK_CONFIG.lowTierWinrate);
    setError("");
    setSuccess("");
  };

  const initAudioFeedback = () => {
    if (audioInitialized) return;
    setAudioInitialized(true);
    playCoin();
    speakAnnounce("SYSTEM SETTINGS CONNECTOR INITIALIZED");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validations
    const trimmedHigh = highName.trim();
    const trimmedNormal = normalName.trim();
    const trimmedLow = lowName.trim();

    if (!trimmedHigh || !trimmedNormal || !trimmedLow) {
      setError("ALL RANK TIER NAMES ARE REQUIRED!");
      return;
    }

    if (
      trimmedHigh.length > 12 ||
      trimmedNormal.length > 12 ||
      trimmedLow.length > 12
    ) {
      setError("RANK NAMES MUST BE 12 CHARS OR FEWER!");
      return;
    }

    if (minMatches < 1) {
      setError("MINIMUM MATCHES MUST BE AT LEAST 1!");
      return;
    }

    if (
      highWinrate < 0 ||
      highWinrate > 100 ||
      lowWinrate < 0 ||
      lowWinrate > 100
    ) {
      setError("WINRATE THRESHOLDS MUST BE BETWEEN 0 AND 100!");
      return;
    }

    if (lowWinrate >= highWinrate) {
      setError("LOW TIER THRESHOLD MUST BE LESS THAN HIGH TIER THRESHOLD!");
      return;
    }

    setLoading(true);
    try {
      const newConfig: RankConfig = {
        minMatches,
        highTierWinrate: highWinrate,
        lowTierWinrate: lowWinrate,
        tiers: {
          high: trimmedHigh,
          normal: trimmedNormal,
          low: trimmedLow,
        },
      };
      await saveRankConfig(newConfig);
      setRankConfig(newConfig);
      playCoin();
      setSuccess("RANK CONFIGURATION RULES UPDATED SUCCESSFULLY!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "FAILED TO SAVE RANK SETTINGS!";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <CRTOverlay>
        <div className={styles.loadingContainer}>
          <span className={styles.loadingText}>
            CONNECTING TO SECURITY CABINET...
          </span>
        </div>
      </CRTOverlay>
    );
  }

  if (!isAdmin) {
    return (
      <CRTOverlay>
        <div className={styles.unauthorizedContainer}>
          <div className={styles.violationCard}>
            <div className={styles.violationIcon}>
              ⚠️
            </div>
            <h1 className={styles.violationTitle}>
              SECURITY VIOLATION
            </h1>
            <div className={styles.violationDivider} />
            <p className={styles.violationDesc}>
              UNAUTHORIZED ACCESS DETECTED. THIS TERMINAL IS RESTRICTED TO
              ADMINISTRATORS ONLY. YOUR ATTEMPT HAS BEEN LOGGED.
            </p>
            <Link
              href="/"
              onClick={() => playBeep(250, 0.1, "sawtooth")}
              className={styles.returnToArenaBtn}
            >
              ✕ RETURN TO ARENA
            </Link>
          </div>
        </div>
      </CRTOverlay>
    );
  }

  return (
    <CRTOverlay>
      <div className={styles.container} onClick={initAudioFeedback}>
        {/* Esports Header */}
        <header className={styles.header}>
          <div className={styles.headerBorderLine} />

          <div className={styles.headerTitleContainer}>
            <h1 className={styles.headerTitle}>HEROES OF MADNESS</h1>
            <p className={styles.headerSubtitle}>
              RANK SYSTEM RULEBOOK SETTINGS
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

        {/* Settings Control Panel Form Container */}
        <main
          className={`${styles.main} ${
            settingsTab === "users" ? styles.mainUsers : styles.mainRanksSeasons
          }`}
        >
          <div className={styles.configPanel}>
            {/* Retro cabinet aesthetic rivets */}
            <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
            <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
            <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
            <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

            {/* Cabinet Subheader */}
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>
                ⚙️ CONFIGURATION ENGINE
              </h2>
              <span className={styles.panelStatus}>
                STATUS: SECURE_CONNECTED
              </span>
            </div>

            {/* Admin Page Tabs */}
            <div className={styles.tabsContainer}>
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("ranks");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "ranks"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                ⚙️ RANK RULES
              </button>
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("users");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "users"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                👥 USER MANAGEMENT
              </button>
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("seasons");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "seasons"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                🏆 SEASON ENGINE
              </button>
            </div>

            {rankConfig === null ? (
              <div className={styles.panelLoading}>
                <span className={styles.panelLoadingText}>
                  CONNECTING STORAGE...
                </span>
              </div>
            ) : settingsTab === "ranks" ? (
              <form onSubmit={handleSubmit} className={styles.form}>
                {/* 1. Tiers Labels */}
                <div className={styles.formSection}>
                  <span className={styles.sectionTitle}>
                    Rank Tier Titles
                  </span>
                  <div className={styles.inputsGridThree}>
                    <div className={styles.inputWrapper}>
                      <label className={styles.inputLabelPurple}>
                        High Tier
                      </label>
                      <input
                        type="text"
                        value={highName}
                        onChange={(e) => setHighName(e.target.value)}
                        className={styles.inputPurple}
                        disabled={loading}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <label className={styles.inputLabelOrange}>
                        Normal Tier
                      </label>
                      <input
                        type="text"
                        value={normalName}
                        onChange={(e) => setNormalName(e.target.value)}
                        className={styles.inputOrange}
                        disabled={loading}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <label className={styles.inputLabelGreen}>
                        Low Tier
                      </label>
                      <input
                        type="text"
                        value={lowName}
                        onChange={(e) => setLowName(e.target.value)}
                        className={styles.inputGreen}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Thresholds rules */}
                <div className={styles.formSectionEvaluation}>
                  <span className={styles.sectionTitle}>
                    Evaluation Thresholds
                  </span>

                  <div className={styles.inputsGridThresholds}>
                    {/* Minimum Matches */}
                    <div className={styles.inputWrapperFull}>
                      <label className={styles.inputLabel}>
                        Min Match Count to Qualify
                      </label>
                      <input
                        type="number"
                        value={minMatches}
                        onChange={(e) =>
                          setMinMatches(
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        className={styles.inputDefault}
                        disabled={loading}
                      />
                      <span className={styles.inputHelpText}>
                        Players with total games below this threshold will
                        default to Normal rank.
                      </span>
                    </div>

                    {/* High Winrate threshold */}
                    <div className={styles.inputWrapperThreshold}>
                      <label className={styles.inputLabelPurpleLeft}>
                        High Tier Winrate (&gt;= %)
                      </label>
                      <input
                        type="number"
                        value={highWinrate}
                        onChange={(e) =>
                          setHighWinrate(
                            Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0),
                            ),
                          )
                        }
                        className={styles.inputPurpleLeft}
                        disabled={loading}
                      />
                      <span className={styles.inputHelpText}>
                        Qualifies for the high rank.
                      </span>
                    </div>

                    {/* Low Winrate threshold */}
                    <div className={styles.inputWrapperThreshold}>
                      <label className={styles.inputLabelGreenLeft}>
                        Low Tier Winrate (&lt;= %)
                      </label>
                      <input
                        type="number"
                        value={lowWinrate}
                        onChange={(e) =>
                          setLowWinrate(
                            Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0),
                            ),
                          )
                        }
                        className={styles.inputGreenLeft}
                        disabled={loading}
                      />
                      <span className={styles.inputHelpText}>
                        Relegates to the low rank.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status messages display */}
                {error && (
                  <div className={styles.statusError}>
                    ⚠️ RULES ERROR: {error}
                  </div>
                )}

                {success && (
                  <div className={styles.statusSuccess}>
                    ✅ Rules Success: {success}
                  </div>
                )}

                {/* Actions bottom row */}
                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className={styles.resetBtn}
                  >
                    RESET DEFAULT
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.applyBtn}
                  >
                    {loading ? "SAVING RULES..." : "APPLY SETTINGS"}
                  </button>
                </div>
              </form>
            ) : settingsTab === "users" ? (
              /* User management UI */
              <div className={styles.usersSection}>
                <div className={styles.usersHeader}>
                  <span className={styles.usersHeaderTitle}>
                    Registered Cabinet Operators
                  </span>
                  <button
                    onClick={loadUsers}
                    disabled={usersLoading}
                    className={styles.refreshBtn}
                  >
                    {usersLoading ? "LOADING..." : "🔄 REFRESH USERS"}
                  </button>
                </div>

                {usersLoading && users.length === 0 ? (
                  <div className={styles.usersLoading}>
                    <span className={styles.usersLoadingText}>
                      SCANNING RETINAL SIGNATURES...
                    </span>
                  </div>
                ) : users.length === 0 ? (
                  <div className={styles.usersEmpty}>
                    <span className={styles.usersEmptyText}>
                      NO REGISTERED USERS FOUND.
                    </span>
                  </div>
                ) : (
                  <div className={styles.usersTableContainer}>
                    <table className={styles.usersTable}>
                      <thead>
                        <tr className={styles.usersTableHeaderRow}>
                          <th className={styles.tableHeaderCell}>Fighter</th>
                          <th className={styles.tableHeaderCell}>Email</th>
                          <th className={styles.tableHeaderCell}>Role</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const isSelf = u.uid === currentAdmin?.uid;
                          return (
                            <tr
                              key={u.uid}
                              className={styles.usersTableBodyRow}
                            >
                              <td className={styles.userCell}>
                                <div className={styles.userAvatarWrapper}>
                                  <img
                                    src={
                                      u.photoURL ||
                                      `https://api.dicebear.com/9.x/pixel-art/svg?seed=${u.uid}`
                                    }
                                    alt={u.name}
                                    className={styles.userAvatar}
                                  />
                                </div>
                                <span className={styles.userName}>
                                  {u.name}{" "}
                                  {isSelf && (
                                    <span className={styles.currentUserBadge}>
                                      YOU
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className={styles.userEmail}>
                                {u.email}
                              </td>
                              <td className={styles.userRoleWrapper}>
                                <span
                                  className={
                                    u.role === "admin"
                                      ? styles.roleBadgeAdmin
                                      : styles.roleBadgeUser
                                  }
                                >
                                  {u.role.toUpperCase()}
                                </span>
                              </td>
                              <td className={styles.userActionsCell}>
                                {!isSelf ? (
                                  <button
                                    onClick={() => handleToggleUserRole(u)}
                                    className={
                                      u.role === "admin"
                                        ? styles.demoteBtn
                                        : styles.promoteBtn
                                    }
                                  >
                                    {u.role === "admin"
                                      ? "✕ DEMOTE"
                                      : "👑 PROMOTE"}
                                  </button>
                                ) : (
                                  <span className={styles.lockedText}>
                                    SYS_LOCKED
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Season Engine UI */
              <div className={styles.seasonEngineContainer}>
                <div className={styles.formSection}>
                  <span className={styles.sectionTitle}>
                    🏆 Season Engine
                  </span>

                  <div className={styles.seasonEngineDetails}>
                    <div className={styles.seasonEngineDetailRow}>
                      <span className={styles.seasonEngineDetailLabel}>
                        ACTIVE SEASON ID
                      </span>
                      <span className={styles.seasonEngineActiveVal}>
                        SEASON {seasonConfig?.activeSeasonId || 1}
                      </span>
                    </div>

                    <div className={styles.seasonEngineDetailRow}>
                      <span className={styles.seasonEngineDetailLabel}>
                        START DATE
                      </span>
                      <span className={styles.seasonEngineDateVal}>
                        {seasonConfig?.seasonStart
                          ? new Date(seasonConfig.seasonStart).toLocaleString()
                          : "UNKNOWN"}
                      </span>
                    </div>

                    <p className={styles.seasonEngineDesc}>
                      Ending the season finalizes fighter ratings, freezes the
                      leaderboard records, determines the Top 3 and Last Place
                      performers, and archives them. Current season wins,
                      losses, matches, and ranks will be reset back to 0.
                      All-time winrate statistics will remain unchanged.
                    </p>
                  </div>
                </div>

                <div className={styles.seasonEngineActionWrapper}>
                  <button
                    type="button"
                    onClick={handleEndSeason}
                    disabled={seasonEnding || !seasonConfig}
                    className={styles.endSeasonBtn}
                  >
                    {seasonEnding
                      ? "ROLLING OVER SEASON..."
                      : "🏆 END CURRENT SEASON & START NEW"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer banner */}
        <footer className={styles.footer}>
          <span>
            HEROES OF MADNESS PRO v1.0.0 © Geminus-Dev 2026 by nutty dev`~`
          </span>
        </footer>

        {/* Debug Bar */}
        <DebugBar />
      </div>
    </CRTOverlay>
  );
}
