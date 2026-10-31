"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
import pkg from "../../../package.json";
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
  fetchLineConfig,
  saveLineConfig,
  exportAllDataAsBackup,
  downloadBackupFile,
  migrateMatchesToDocumentIds,
  backfillPlayerAliases,
  MigrationReport,
  BadgeConfig,
  DEFAULT_BADGE_CONFIG,
  fetchBadgeConfig,
  saveBadgeConfig,
  seedMockData,
  clearMockData,
} from "@/utils/firebase";
import { playBeep, playCoin, speakAnnounce } from "@/utils/audio";
import { useAuth } from "@/utils/AuthContext";
import styles from "./styles.module.css";

export default function SettingsPage() {
  const { user: currentAdmin, isAdmin, loading: authLoading } = useAuth();
  const [settingsTab, setSettingsTab] = useState<
    "ranks" | "users" | "seasons" | "line" | "migration" | "badges"
  >("ranks");
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

  const [lineGroupId, setLineGroupId] = useState("");
  const [lineEnabled, setLineEnabled] = useState(false);

  const [badgeConfigState, setBadgeConfigState] =
    useState<BadgeConfig>(DEFAULT_BADGE_CONFIG);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeSuccess, setBadgeSuccess] = useState("");
  const [badgeError, setBadgeError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lineError, setLineError] = useState("");
  const [lineSuccess, setLineSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Data Migration & Backup States
  const [isMigrating, setIsMigrating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAuditingAliases, setIsAuditingAliases] = useState(false);
  const [migrationReport, setMigrationReport] =
    useState<MigrationReport | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [aliasReport, setAliasReport] = useState<{
    success: boolean;
    totalPlayers: number;
    updatedCount: number;
    details: string[];
  } | null>(null);
  const [isSeedingMock, setIsSeedingMock] = useState(false);

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

      const lCfg = await fetchLineConfig();
      setLineGroupId(lCfg.groupId);
      setLineEnabled(lCfg.enabled);

      const bCfg = await fetchBadgeConfig();
      setBadgeConfigState(bCfg);
    };
    loadConfig();
  }, [isAdmin]);

  const handleSaveBadges = async (e: React.FormEvent) => {
    e.preventDefault();
    setBadgeError("");
    setBadgeSuccess("");
    setBadgeLoading(true);
    playCoin();

    try {
      const res = await saveBadgeConfig(badgeConfigState);
      if (res) {
        setBadgeSuccess(
          "🏅 BADGE SYSTEM RULES SAVED TO DATABASE SUCCESSFULLY!",
        );
        playBeep(523, 0.2, "sine");
      } else {
        setBadgeError("FAILED TO SAVE BADGE CONFIGURATION.");
      }
    } catch (err) {
      console.error("Error saving badges:", err);
      setBadgeError("FAILED TO SAVE BADGE CONFIG: " + String(err));
    } finally {
      setBadgeLoading(false);
    }
  };

  const handleResetBadges = () => {
    playBeep(200, 0.1, "sawtooth");
    setBadgeConfigState(DEFAULT_BADGE_CONFIG);
    setBadgeError("");
    setBadgeSuccess(
      "RESET BADGES TO SYSTEM DEFAULTS. CLICK SAVE TO PERSIST CHANGES.",
    );
  };

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

  const handleLineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLineError("");
    setLineSuccess("");
    setLoading(true);
    try {
      await saveLineConfig({
        groupId: lineGroupId.trim(),
        enabled: lineEnabled,
      });
      playCoin();
      setLineSuccess("LINE BOT SETTINGS UPDATED SUCCESSFULLY!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "FAILED TO SAVE LINE SETTINGS!";
      setLineError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    playCoin();
    try {
      const backup = await exportAllDataAsBackup();
      downloadBackupFile(backup);
      setSuccess("FULL DATABASE BACKUP GENERATED & DOWNLOADED!");
      playBeep(440, 0.1, "sine");
    } catch (err) {
      console.error("Backup failed:", err);
      setError("FAILED TO GENERATE BACKUP: " + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunMigration = async () => {
    const confirmPrompt = window.confirm(
      "⚠️ MATCH DATA MIGRATION AUDIT\n\n" +
        "This procedure will:\n" +
        "1. Automatically download a full pre-migration JSON safety backup to your computer.\n" +
        "2. Scan all recorded matches in the database.\n" +
        "3. Replace all player names/aliases in Team A and Team B with immutable Document IDs.\n\n" +
        "Do you want to proceed?",
    );
    if (!confirmPrompt) return;

    setIsMigrating(true);
    setMigrationError("");
    setMigrationReport(null);
    playCoin();

    try {
      const result = await migrateMatchesToDocumentIds();
      setMigrationReport(result);
      if (result.success) {
        setSuccess(
          `MIGRATION COMPLETE! ${result.migratedMatches} matches updated (${result.convertedSlots} player slots converted).`,
        );
        playBeep(523, 0.2, "sine");
      } else {
        setMigrationError("Migration encountered errors. Check report below.");
      }
    } catch (err) {
      console.error("Migration failed:", err);
      setMigrationError("Migration failed: " + String(err));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleBackfillAliases = async () => {
    setIsAuditingAliases(true);
    playCoin();
    try {
      const res = await backfillPlayerAliases();
      setAliasReport(res);
      setSuccess(
        `AUDITED ${res.totalPlayers} PLAYERS: ${res.updatedCount} ALIASES BACKFILLED IN FIRESTORE!`,
      );
      playBeep(523, 0.2, "sine");
    } catch (err) {
      console.error("Alias audit failed:", err);
      setError("ALIAS AUDIT FAILED: " + String(err));
    } finally {
      setIsAuditingAliases(false);
    }
  };

  const handleSeedMockData = async () => {
    setIsSeedingMock(true);
    playCoin();
    try {
      const ok = await seedMockData();
      if (ok) {
        setSuccess(
          "MOCK DATA SEEDED! ทั้งแมตช์สู้ยิบตา, MVP ฝันร้ายราชา, ข้อมูลผู้เล่น และสถิติซีซั่นพร้อมตรวจสอบ",
        );
        playBeep(523, 0.2, "sine");
      } else {
        setError("FAILED TO SEED MOCK DATA");
      }
    } catch (err) {
      console.error("Seed mock failed:", err);
      setError("SEED MOCK DATA FAILED: " + String(err));
    } finally {
      setIsSeedingMock(false);
    }
  };

  const handleClearMockData = async () => {
    if (!window.confirm("คุณต้องการล้างข้อมูลจำลองทั้งหมดหรือไม่?")) return;
    setIsSeedingMock(true);
    playBeep(220, 0.2, "sawtooth");
    try {
      const ok = await clearMockData();
      if (ok) {
        setSuccess("CLEARED MOCK DATA SUCCESSFULLY! ล้างข้อมูลจำลองเรียบร้อย");
        playBeep(330, 0.2, "sine");
      }
    } catch (err) {
      console.error("Clear mock failed:", err);
      setError("CLEAR MOCK DATA FAILED: " + String(err));
    } finally {
      setIsSeedingMock(false);
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
            <div className={styles.violationIcon}>⚠️</div>
            <h1 className={styles.violationTitle}>SECURITY VIOLATION</h1>
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
              <h2 className={styles.panelTitle}>⚙️ CONFIGURATION ENGINE</h2>
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
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("line");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "line"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                💬 LINE CHATBOT
              </button>
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("migration");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "migration"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                💾 DATA & BACKUP
              </button>
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("badges");
                }}
                className={`${styles.tabBtn} ${
                  settingsTab === "badges"
                    ? styles.tabBtnActive
                    : styles.tabBtnInactive
                }`}
              >
                🏅 BADGES
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
                  <span className={styles.sectionTitle}>Rank Tier Titles</span>
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
                      <label className={styles.inputLabelGreen}>Low Tier</label>
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
                        Base minimum matches required. Standing threshold
                        automatically scales dynamically with season activity
                        (at least 20% of season matches, capped at 10) to
                        protect rankings from low-sample distortions.
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
                          <th
                            className={styles.tableHeaderCell}
                            style={{ textAlign: "right" }}
                          >
                            Actions
                          </th>
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
                              <td className={styles.userEmail}>{u.email}</td>
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
            ) : settingsTab === "seasons" ? (
              /* Season Engine UI */
              <div className={styles.seasonEngineContainer}>
                <div className={styles.formSection}>
                  <span className={styles.sectionTitle}>🏆 Season Engine</span>

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
            ) : settingsTab === "line" ? (
              /* LINE Chatbot UI */
              <form onSubmit={handleLineSubmit} className={styles.form}>
                <div className={styles.formSection}>
                  <span className={styles.sectionTitle}>
                    💬 LINE Chatbot Integration
                  </span>

                  <div className={styles.inputWrapperFull}>
                    <label className={styles.inputLabel}>LINE GROUP ID</label>
                    <input
                      type="text"
                      value={lineGroupId}
                      onChange={(e) => setLineGroupId(e.target.value)}
                      placeholder="e.g. C123456789abcdef123456789abcdef12"
                      className={styles.inputDefault}
                      disabled={loading}
                    />
                    <span className={styles.inputHelpText}>
                      The target LINE group ID to automatically stream drafts
                      and match results. Add the bot to a group and send{" "}
                      <code>/groupid</code> to display the ID.
                    </span>
                  </div>

                  <div
                    className={styles.inputWrapperFull}
                    style={{ marginTop: "1rem" }}
                  >
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={lineEnabled}
                        onChange={(e) => setLineEnabled(e.target.checked)}
                        className="w-4 h-4 accent-neon-yellow cursor-pointer"
                        disabled={loading}
                      />
                      <span className="font-pixel text-[9px] text-slate-300 uppercase tracking-wider">
                        Enable Automatic LINE Notifications
                      </span>
                    </label>
                    <span
                      className={styles.inputHelpText}
                      style={{ marginLeft: "1.75rem" }}
                    >
                      When enabled, drafts and battle results are automatically
                      posted to the LINE group.
                    </span>
                  </div>
                </div>

                {lineError && (
                  <div className={styles.statusError}>
                    ⚠️ CONFIG ERROR: {lineError}
                  </div>
                )}

                {lineSuccess && (
                  <div className={styles.statusSuccess}>
                    ✅ Config Success: {lineSuccess}
                  </div>
                )}

                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => {
                      playBeep(200, 0.1, "sawtooth");
                      setLineGroupId("");
                      setLineEnabled(false);
                    }}
                    disabled={loading}
                    className={styles.resetBtn}
                  >
                    CLEAR SETTINGS
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.applyBtn}
                  >
                    {loading ? "SAVING..." : "SAVE LINE SETTINGS"}
                  </button>
                </div>
              </form>
            ) : settingsTab === "migration" ? (
              /* Data Migration & Backup UI */
              <div className={styles.seasonEngineContainer}>
                <div className={styles.seasonEngineDetails}>
                  <div className={styles.seasonEngineDetailRow}>
                    <span className={styles.seasonEngineDetailLabel}>
                      DATA ARCHITECTURE STATUS
                    </span>
                    <span className="text-neon-yellow font-bold text-xs uppercase">
                      IMMUTABLE DOCUMENT ID STANDARD
                    </span>
                  </div>

                  <div className={styles.seasonEngineDetailRow}>
                    <span className={styles.seasonEngineDetailLabel}>
                      DOCUMENT ID ROLE
                    </span>
                    <span className="text-slate-300 text-[10px] font-sans">
                      Primary Key across Match Logs, Winrates & Stats (Never
                      Changes)
                    </span>
                  </div>

                  <div className={styles.seasonEngineDetailRow}>
                    <span className={styles.seasonEngineDetailLabel}>
                      DISPLAY NAME & ALIAS ROLE
                    </span>
                    <span className="text-slate-300 text-[10px] font-sans">
                      Display Name for Identity / Mentions; Alias for Funny
                      Badges
                    </span>
                  </div>

                  <p className={styles.seasonEngineDesc}>
                    Migrating matches scans all historical records in Team A and
                    Team B and converts legacy names or aliases to permanent
                    Firestore Document IDs. This permanently decouples player
                    nicknames and funny aliases from their statistical records.
                    A full safety backup is automatically downloaded to your
                    device before any changes are written.
                  </p>
                </div>

                {/* Actions Box */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-slate-800 pt-6 mt-2">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isExporting || isMigrating}
                    className={styles.backupBtn}
                  >
                    <span>
                      {isExporting
                        ? "⏳ EXPORTING..."
                        : "💾 DOWNLOAD DATABASE BACKUP (JSON)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunMigration}
                    disabled={isMigrating || isExporting}
                    className={styles.migrateBtn}
                  >
                    <span>
                      {isMigrating
                        ? "⚡ MIGRATING RECORDS..."
                        : "🚀 RUN MATCH MIGRATION TO DOC IDs"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBackfillAliases}
                    disabled={isAuditingAliases}
                    className={styles.backupBtn}
                  >
                    <span>
                      {isAuditingAliases
                        ? "🔍 AUDITING ALIASES..."
                        : "🏷️ VERIFY & BACKFILL PLAYER ALIASES"}
                    </span>
                  </button>
                </div>

                {/* Status Messages */}
                {migrationError && (
                  <div className={styles.statusError}>
                    ⚠️ MIGRATION ERROR: {migrationError}
                  </div>
                )}

                {/* Detailed Migration Log Console */}
                {migrationReport && (
                  <div className="flex flex-col gap-2 mt-4">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-pixel">
                      <span>AUDIT LOG CONSOLE</span>
                      <span className="text-neon-yellow">
                        {migrationReport.migratedMatches} MATCHES CONVERTED (
                        {migrationReport.convertedSlots} SLOTS)
                      </span>
                    </div>
                    <div className={styles.migrationLogBox}>
                      {migrationReport.details.map((line, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-slate-600 select-none">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Alias Audit Log Console */}
                {aliasReport && (
                  <div className="flex flex-col gap-2 mt-4">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-pixel">
                      <span>ALIAS AUDIT CONSOLE</span>
                      <span className="text-neon-cyan">
                        {aliasReport.updatedCount} UPDATED /{" "}
                        {aliasReport.totalPlayers} TOTAL
                      </span>
                    </div>
                    <div className={styles.migrationLogBox}>
                      {aliasReport.details.map((line, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-slate-600 select-none">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mock & UI Testing Suite */}
                <div className="border-t border-slate-800 pt-6 mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-emerald-400 font-pixel tracking-wider">
                      🧪 UI TESTING & MOCK DATA SUITE (โหมดทดสอบข้อมูลจำลอง)
                    </span>
                    <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded font-pixel">
                      READY FOR AUDIT
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-sans leading-relaxed mb-4">
                    สร้างข้อมูลจำลองครบทุกสถานการณ์เพื่อตรวจสอบ UI: 1)
                    โหมดสู้ยิบตาพลิกชนะ (Underdog Comeback +0.20 Win ยกทีม) 2)
                    โหมดสู้ยิบตาแพ้เลือก MVP ฝันร้ายราชา (+0.35 Win) 3)
                    แมตช์ที่รอเลือก MVP เพื่อทดสอบ Interactive Dropdown 4)
                    แมตช์ปกติสูสี (Regular Balanced Match) 5) ข้อมูลผู้เล่น 11
                    คนพร้อม Badge และสถิติคำนวณจริง 6) โพเดียมซีซั่นเก่า (Season
                    1 & 2) พร้อมเหรียญเกียรติยศ
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={handleSeedMockData}
                      disabled={isSeedingMock}
                      className={styles.seedMockBtn}
                    >
                      <span>
                        {isSeedingMock
                          ? "⏳ SEEDING TEST DATA..."
                          : "🧪 SEED MOCK DATA (โหลดข้อมูลจำลอง)"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearMockData}
                      disabled={isSeedingMock}
                      className={styles.clearMockBtn}
                    >
                      <span>🗑️ CLEAR MOCK DATA (ล้างข้อมูลจำลอง)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : settingsTab === "badges" ? (
              <form onSubmit={handleSaveBadges} className={styles.form}>
                <div className={styles.formSection}>
                  <div className="flex flex-col gap-1">
                    <span className={styles.sectionTitle}>
                      🎖️ BADGE & EMBLEM TITLES
                    </span>
                    <p className="font-thai text-xs text-slate-400">
                      กำหนดชื่อและไอคอนของทุกเหรียญเกียรติยศและป้ายเตือนในระบบ
                      (Underdog, Champion, Podiums)
                    </p>
                  </div>

                  <div className={styles.badgeConfigGrid}>
                    {/* 1. Underdog Comeback Team */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>ทีมสู้ยิบตา</span>
                        <span className="text-[7.5px] text-amber-400 font-mono">
                          +0.20 WIN
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ทีมรองที่สามารถพลิกกลับมาชนะทีมต่อได้ (แจกยกทีม 5 คน)
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.underdogComeback.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogComeback: {
                                ...prev.underdogComeback,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.underdogComeback.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogComeback: {
                                ...prev.underdogComeback,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                          placeholder="ชื่อ Badge..."
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-gradient-to-r from-red-600 to-orange-500 text-white border border-amber-300`}
                        >
                          {badgeConfigState.underdogComeback.icon}{" "}
                          {badgeConfigState.underdogComeback.name} x3
                        </span>
                      </div>
                    </div>

                    {/* 2. Underdog Losing MVP */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>MVP ฝ่ายแพ้</span>
                        <span className="text-[7.5px] text-purple-300 font-mono">
                          +0.35 WIN
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ผู้เล่น MVP ของทีมรองเมื่อพ่ายแพ้ในแมตช์สู้ยิบตา
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.underdogLosingMvp.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogLosingMvp: {
                                ...prev.underdogLosingMvp,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.underdogLosingMvp.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogLosingMvp: {
                                ...prev.underdogLosingMvp,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                          placeholder="ชื่อ Badge..."
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-gradient-to-r from-purple-900 to-slate-900 text-purple-200 border border-purple-400`}
                        >
                          {badgeConfigState.underdogLosingMvp.icon}{" "}
                          {badgeConfigState.underdogLosingMvp.name} x2
                        </span>
                      </div>
                    </div>

                    {/* 3. Season Champion */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>แชมป์ประจำซีซัน</span>
                        <span className="text-[7.5px] text-yellow-300 font-mono">
                          CHAMPION
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ตราเกียรติยศผู้ชนะเลิศอันดับ 1 ของแต่ละซีซัน
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.seasonChampion.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              seasonChampion: {
                                ...prev.seasonChampion,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.seasonChampion.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              seasonChampion: {
                                ...prev.seasonChampion,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                          placeholder="ชื่อ Badge..."
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-amber-950 text-amber-300 border border-amber-400`}
                        >
                          {badgeConfigState.seasonChampion.icon}{" "}
                          {badgeConfigState.seasonChampion.name}
                        </span>
                      </div>
                    </div>

                    {/* 4. Underdog Match Tag */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>ป้ายโหมดสู้ยิบตา</span>
                        <span className="text-[7.5px] text-orange-400 font-mono">
                          ARENA / LOG
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายกำกับแมตช์ที่คาดการณ์อัตราชนะต่างกันตั้งแต่ 7%
                        ขึ้นไป
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.underdogMatch.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogMatch: {
                                ...prev.underdogMatch,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.underdogMatch.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              underdogMatch: {
                                ...prev.underdogMatch,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                          placeholder="ชื่อ Badge..."
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-red-950 text-orange-400 border border-orange-500`}
                        >
                          {badgeConfigState.underdogMatch.icon}{" "}
                          {badgeConfigState.underdogMatch.name}
                        </span>
                      </div>
                    </div>

                    {/* 5. Upset Victory Tag */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>ป้ายชัยชนะล้มยักษ์</span>
                        <span className="text-[7.5px] text-yellow-300 font-mono">
                          MATCH LOG
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายประวัติการแข่งขันเมื่อทีมรองสามารถพลิกชนะทีมต่อได้
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.upsetVictory.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              upsetVictory: {
                                ...prev.upsetVictory,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.upsetVictory.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              upsetVictory: {
                                ...prev.upsetVictory,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                          placeholder="ชื่อ Badge..."
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-amber-950 text-amber-300 border border-amber-400`}
                        >
                          {badgeConfigState.upsetVictory.icon}{" "}
                          {badgeConfigState.upsetVictory.name}
                        </span>
                      </div>
                    </div>

                    {/* 6. First Place */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>อันดับ 1 (ทอง)</span>
                        <span className="text-[7.5px] text-yellow-400 font-mono">
                          PODIUM
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายอันดับที่ 1 บนโพเดียมของซีซัน
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.firstPlace.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              firstPlace: {
                                ...prev.firstPlace,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.firstPlace.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              firstPlace: {
                                ...prev.firstPlace,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-yellow-950 text-yellow-300 border border-yellow-400`}
                        >
                          {badgeConfigState.firstPlace.icon}{" "}
                          {badgeConfigState.firstPlace.name}
                        </span>
                      </div>
                    </div>

                    {/* 7. Second Place */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>อันดับ 2 (เงิน)</span>
                        <span className="text-[7.5px] text-slate-300 font-mono">
                          PODIUM
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายรองชนะเลิศอันดับ 1 บนโพเดียม
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.secondPlace.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              secondPlace: {
                                ...prev.secondPlace,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.secondPlace.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              secondPlace: {
                                ...prev.secondPlace,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-slate-900 text-slate-200 border border-slate-400`}
                        >
                          {badgeConfigState.secondPlace.icon}{" "}
                          {badgeConfigState.secondPlace.name}
                        </span>
                      </div>
                    </div>

                    {/* 8. Third Place */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>อันดับ 3 (ทองแดง)</span>
                        <span className="text-[7.5px] text-orange-400 font-mono">
                          PODIUM
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายรองชนะเลิศอันดับ 2 บนโพเดียม
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.thirdPlace.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              thirdPlace: {
                                ...prev.thirdPlace,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.thirdPlace.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              thirdPlace: {
                                ...prev.thirdPlace,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-orange-950 text-amber-400 border border-orange-500`}
                        >
                          {badgeConfigState.thirdPlace.icon}{" "}
                          {badgeConfigState.thirdPlace.name}
                        </span>
                      </div>
                    </div>

                    {/* 9. Last Place */}
                    <div className={styles.badgeCard}>
                      <span className={styles.badgeCardTitle}>
                        <span>อันดับสุดท้าย (บ๊วย)</span>
                        <span className="text-[7.5px] text-red-400 font-mono">
                          PODIUM
                        </span>
                      </span>
                      <p className={styles.badgeCardDesc}>
                        ป้ายสำหรับผู้เล่นอันดับสุดท้ายของซีซัน
                      </p>
                      <div className={styles.badgeInputsRow}>
                        <input
                          type="text"
                          value={badgeConfigState.lastPlace.icon}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              lastPlace: {
                                ...prev.lastPlace,
                                icon: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeIconInput}
                          title="Icon / Emoji"
                        />
                        <input
                          type="text"
                          value={badgeConfigState.lastPlace.name}
                          onChange={(e) =>
                            setBadgeConfigState((prev) => ({
                              ...prev,
                              lastPlace: {
                                ...prev.lastPlace,
                                name: e.target.value,
                              },
                            }))
                          }
                          className={styles.badgeNameInput}
                        />
                      </div>
                      <div className={styles.badgePreviewRow}>
                        <span>PREVIEW:</span>
                        <span
                          className={`${styles.badgePreviewPill} bg-red-950 text-red-300 border border-red-500`}
                        >
                          {badgeConfigState.lastPlace.icon}{" "}
                          {badgeConfigState.lastPlace.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {badgeSuccess && (
                  <div className={styles.statusSuccess}>{badgeSuccess}</div>
                )}
                {badgeError && (
                  <div className={styles.statusError}>⚠️ {badgeError}</div>
                )}

                <div className={styles.formActions}>
                  <button
                    type="submit"
                    disabled={badgeLoading}
                    className={styles.submitBtn}
                  >
                    <span>
                      {badgeLoading
                        ? "SAVING BADGES..."
                        : "💾 SAVE BADGE SETTINGS"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBadges}
                    disabled={badgeLoading}
                    className={styles.resetBtn}
                  >
                    🔄 RESET TO DEFAULTS
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </main>

        {/* Footer banner */}
        <footer className={styles.footer}>
          <span>
            HEROES OF MADNESS PRO v{pkg.version} © Geminus-Dev 2026 by nutty
            dev`~`
          </span>
        </footer>

        {/* Debug Bar */}
        <DebugBar />
      </div>
    </CRTOverlay>
  );
}
