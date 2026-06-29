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

export default function SettingsPage() {
  const { user: currentAdmin, isAdmin, loading: authLoading } = useAuth();
  const [settingsTab, setSettingsTab] = useState<"ranks" | "users" | "seasons">("ranks");
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
      `Are you sure you want to change ${targetUser.name || targetUser.email}'s role to ${newRole.toUpperCase()}?`
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
        speakAnnounce(`SEASON ${seasonConfig.activeSeasonId} COMPLETED. NEW SEASON INITIALIZED.`);
        playCoin();
        alert(`SUCCESS! Season ${seasonConfig.activeSeasonId} closed. Season ${seasonConfig.activeSeasonId + 1} has begun!`);
        
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
        <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#050508] font-pixel text-neon-yellow">
          <span className="text-[10px] uppercase tracking-widest animate-pulse">
            CONNECTING TO SECURITY CABINET...
          </span>
        </div>
      </CRTOverlay>
    );
  }

  if (!isAdmin) {
    return (
      <CRTOverlay>
        <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#050508] p-6 relative font-pixel">
          <div className="border-4 border-neon-red bg-slate-950/95 max-w-[500px] p-8 text-center shadow-[0_0_25px_rgba(239,68,68,0.5)] flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-4 border-neon-red flex items-center justify-center text-neon-red text-3xl animate-bounce">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold tracking-tighter text-neon-red uppercase animate-pulse">
              SECURITY VIOLATION
            </h1>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-red to-transparent" />
            <p className="text-[10px] text-slate-400 uppercase leading-relaxed tracking-wider">
              UNAUTHORIZED ACCESS DETECTED. THIS TERMINAL IS RESTRICTED TO ADMINISTRATORS ONLY. YOUR ATTEMPT HAS BEEN LOGGED.
            </p>
            <Link
              href="/"
              onClick={() => playBeep(250, 0.1, "sawtooth")}
              className="flex items-center gap-2 border-2 border-neon-blue bg-neon-blue/10 text-neon-blue hover:bg-neon-blue hover:text-white px-5 py-2.5 text-[9px] cursor-pointer transition-all duration-200 glow-blue uppercase tracking-widest mt-2"
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
      <div
        className="flex-grow flex flex-col justify-between"
        onClick={initAudioFeedback}
      >
        {/* Esports Header */}
        <header className="border-b-4 border-neon-red bg-slate-950 py-4 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 relative">
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red" />

          <div className="flex flex-col items-center md:items-start text-center md:text-left select-none">
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red">
              HEROES OF MADNESS
            </h1>
            <p className="text-[10px] font-pixel text-neon-yellow tracking-widest mt-1.5 uppercase glow-yellow">
              RANK SYSTEM RULEBOOK SETTINGS
            </p>
          </div>

          <Link
            href="/"
            onClick={() => playBeep(250, 0.1, "sawtooth")}
            className="flex items-center gap-1 border-2 border-neon-red bg-neon-red/10 text-neon-red hover:bg-neon-red hover:text-white px-3 py-1.5 font-pixel text-[9px] cursor-pointer transition-all duration-200 glow-red select-none"
          >
            ✕ BACK TO ARENA
          </Link>
        </header>

        {/* Settings Control Panel Form Container */}
        <main className={`mx-auto w-full p-4 md:p-8 flex-grow flex flex-col justify-center items-center transition-all duration-300 ${
          settingsTab === "users" ? "max-w-[850px]" : "max-w-[650px]"
        }`}>
          <div
            className="w-full bg-[#161622]/90 border-4 border-slate-700 p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5 rounded-md"
            style={{
              boxShadow:
                "0 0 15px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.05)",
            }}
          >
            {/* Retro cabinet aesthetic rivets */}
            <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
            <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
            <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
            <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />

            {/* Cabinet Subheader */}
            <div className="border-b-4 border-slate-700 pb-3 mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow select-none">
                ⚙️ CONFIGURATION ENGINE
              </h2>
              <span className="font-pixel text-[8px] text-[#a0a0c0]">
                STATUS: SECURE_CONNECTED
              </span>
            </div>

            {/* Admin Page Tabs */}
            <div className="flex border-b border-slate-700/50 pb-2 gap-4 select-none">
              <button
                type="button"
                onClick={() => {
                  playBeep(330, 0.1, "sawtooth");
                  setSettingsTab("ranks");
                }}
                className={`font-pixel text-[9px] px-3 py-1 cursor-pointer transition-all ${
                  settingsTab === "ranks"
                    ? "border-b-2 border-neon-yellow text-neon-yellow glow-yellow"
                    : "text-slate-500 hover:text-slate-300"
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
                className={`font-pixel text-[9px] px-3 py-1 cursor-pointer transition-all ${
                  settingsTab === "users"
                    ? "border-b-2 border-neon-yellow text-neon-yellow glow-yellow"
                    : "text-slate-500 hover:text-slate-300"
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
                className={`font-pixel text-[9px] px-3 py-1 cursor-pointer transition-all ${
                  settingsTab === "seasons"
                    ? "border-b-2 border-neon-yellow text-neon-yellow glow-yellow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                🏆 SEASON ENGINE
              </button>
            </div>

            {rankConfig === null ? (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="font-pixel text-[10px] text-neon-yellow uppercase tracking-widest mb-2 animate-pulse">
                  CONNECTING STORAGE...
                </span>
              </div>
            ) : settingsTab === "ranks" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* 1. Tiers Labels */}
                <div className="flex flex-col gap-2">
                  <span className="font-pixel text-[8.5px] text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-1">
                    Rank Tier Titles
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-purple-400 font-pixel text-[7px] uppercase tracking-wide text-center block">
                        High Tier
                      </label>
                      <input
                        type="text"
                        value={highName}
                        onChange={(e) => setHighName(e.target.value)}
                        className="bg-slate-950 border border-purple-500/30 text-purple-200 text-sm p-2 focus:outline-none focus:border-purple-500 font-sans text-center rounded-sm"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-orange-400 font-pixel text-[7px] uppercase tracking-wide text-center block">
                        Normal Tier
                      </label>
                      <input
                        type="text"
                        value={normalName}
                        onChange={(e) => setNormalName(e.target.value)}
                        className="bg-slate-950 border border-orange-500/30 text-orange-200 text-sm p-2 focus:outline-none focus:border-orange-500 font-sans text-center rounded-sm"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-green-400 font-pixel text-[7px] uppercase tracking-wide text-center block">
                        Low Tier
                      </label>
                      <input
                        type="text"
                        value={lowName}
                        onChange={(e) => setLowName(e.target.value)}
                        className="bg-slate-950 border border-green-500/30 text-green-200 text-sm p-2 focus:outline-none focus:border-green-500 font-sans text-center rounded-sm"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Thresholds rules */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="font-pixel text-[8.5px] text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-1">
                    Evaluation Thresholds
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-tech text-xs">
                    {/* Minimum Matches */}
                    <div className="flex flex-col gap-1 sm:col-span-3">
                      <label className="text-slate-400 font-pixel text-[7.5px] uppercase">
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
                        className="bg-slate-950 border border-slate-800 text-white p-2.5 focus:outline-none focus:border-neon-yellow rounded-sm"
                        disabled={loading}
                      />
                      <span className="text-[6.5px] text-slate-500 font-sans italic mt-0.5">
                        Players with total games below this threshold will
                        default to Normal rank.
                      </span>
                    </div>

                    {/* High Winrate threshold */}
                    <div className="flex flex-col gap-1 sm:col-span-1.5">
                      <label className="text-purple-400 font-pixel text-[7px] uppercase">
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
                        className="bg-slate-950 border border-purple-500/20 text-white p-2.5 focus:outline-none focus:border-purple-500 rounded-sm"
                        disabled={loading}
                      />
                      <span className="text-[6.5px] text-slate-500 font-sans italic mt-0.5">
                        Qualifies for the high rank.
                      </span>
                    </div>

                    {/* Low Winrate threshold */}
                    <div className="flex flex-col gap-1 sm:col-span-1.5">
                      <label className="text-green-400 font-pixel text-[7px] uppercase">
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
                        className="bg-slate-950 border border-green-500/20 text-white p-2.5 focus:outline-none focus:border-green-500 rounded-sm"
                        disabled={loading}
                      />
                      <span className="text-[6.5px] text-slate-500 font-sans italic mt-0.5">
                        Relegates to the low rank.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status messages display */}
                {error && (
                  <div className="text-[8.5px] font-pixel text-neon-red glow-red uppercase mt-2">
                    ⚠️ RULES ERROR: {error}
                  </div>
                )}

                {success && (
                  <div className="text-[8.5px] font-pixel text-neon-yellow glow-yellow uppercase mt-2">
                    ✅ Rules Success: {success}
                  </div>
                )}

                {/* Actions bottom row */}
                <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-2 select-none">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="font-pixel text-[8.5px] text-slate-400 hover:text-white bg-slate-900 border border-slate-700 px-3 py-2 hover:bg-slate-800 transition-all cursor-pointer uppercase font-bold"
                  >
                    RESET DEFAULT
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="font-pixel text-[8.5px] text-black bg-neon-yellow border-2 border-white px-5 py-2 hover:bg-white transition-all cursor-pointer uppercase font-bold disabled:opacity-50"
                  >
                    {loading ? "SAVING RULES..." : "APPLY SETTINGS"}
                  </button>
                </div>
              </form>
            ) : settingsTab === "users" ? (
              /* User management UI */
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center select-none">
                  <span className="font-pixel text-[8.5px] text-slate-400 uppercase tracking-wide">
                    Registered Cabinet Operators
                  </span>
                  <button
                    onClick={loadUsers}
                    disabled={usersLoading}
                    className="font-pixel text-[7.5px] border border-slate-600 hover:border-neon-yellow text-slate-400 hover:text-neon-yellow px-2.5 py-1.5 cursor-pointer bg-slate-950 transition-all uppercase font-bold"
                  >
                    {usersLoading ? "LOADING..." : "🔄 REFRESH USERS"}
                  </button>
                </div>

                {usersLoading && users.length === 0 ? (
                  <div className="flex justify-center py-12 select-none">
                    <span className="font-pixel text-[8.5px] text-neon-yellow uppercase tracking-widest animate-pulse">
                      SCANNING RETINAL SIGNATURES...
                    </span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex justify-center py-12 select-none">
                    <span className="font-pixel text-[8.5px] text-slate-500 uppercase tracking-widest">
                      NO REGISTERED USERS FOUND.
                    </span>
                  </div>
                ) : (
                  <div className="border border-slate-800 overflow-hidden bg-slate-950 rounded-sm">
                    <table className="w-full text-left font-sans text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 font-pixel text-[7px] text-[#a0a0c0] uppercase select-none">
                          <th className="p-3">Fighter</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Role</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const isSelf = u.uid === currentAdmin?.uid;
                          return (
                            <tr
                              key={u.uid}
                              className="border-b border-slate-900/50 hover:bg-slate-900/20 transition-colors"
                            >
                              <td className="p-3 flex items-center gap-2.5">
                                <div className="w-6 h-6 border border-slate-700 relative overflow-hidden">
                                  <img
                                    src={u.photoURL || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${u.uid}`}
                                    alt={u.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="font-semibold text-slate-200">
                                  {u.name} {isSelf && <span className="text-[7px] font-pixel text-neon-yellow ml-1 border border-neon-yellow/30 bg-neon-yellow/5 px-1 py-0.5 select-none">YOU</span>}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 font-mono text-[10px]">
                                {u.email}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`text-[8.5px] font-pixel px-1.5 py-0.5 select-none ${
                                    u.role === "admin"
                                      ? "text-neon-yellow border border-neon-yellow/20 bg-neon-yellow/5"
                                      : "text-neon-blue border border-neon-blue/20 bg-neon-blue/5"
                                  }`}
                                >
                                  {u.role.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {!isSelf ? (
                                  <button
                                    onClick={() => handleToggleUserRole(u)}
                                    className={`font-pixel text-[7px] px-2.5 py-1.5 cursor-pointer transition-all duration-150 uppercase border font-bold ${
                                      u.role === "admin"
                                        ? "border-neon-red/30 hover:border-neon-red text-neon-red/70 hover:text-neon-red hover:bg-neon-red/5"
                                        : "border-neon-yellow/30 hover:border-neon-yellow text-neon-yellow/70 hover:text-neon-yellow hover:bg-neon-yellow/5"
                                    }`}
                                  >
                                    {u.role === "admin" ? "✕ DEMOTE" : "👑 PROMOTE"}
                                  </button>
                                ) : (
                                  <span className="text-[7.5px] font-pixel text-slate-600 uppercase select-none italic mr-1">
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
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <span className="font-pixel text-[8.5px] text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-1">
                    🏆 Season Engine
                  </span>
                  
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-sm flex flex-col gap-4 font-pixel text-xs text-slate-300">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-[9px] text-[#a0a0c0]">ACTIVE SEASON ID</span>
                      <span className="text-neon-yellow glow-yellow text-sm font-bold">
                        SEASON {seasonConfig?.activeSeasonId || 1}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-[9px] text-[#a0a0c0]">START DATE</span>
                      <span className="text-slate-400 text-[10px] font-sans">
                        {seasonConfig?.seasonStart 
                          ? new Date(seasonConfig.seasonStart).toLocaleString()
                          : "UNKNOWN"}
                      </span>
                    </div>

                    <p className="font-sans text-[10px] text-slate-400 leading-relaxed uppercase mt-2">
                      Ending the season finalizes fighter ratings, freezes the leaderboard records, determines the Top 3 and Last Place performers, and archives them. Current season wins, losses, matches, and ranks will be reset back to 0. All-time winrate statistics will remain unchanged.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center border-t border-slate-800 pt-6 mt-4">
                  <button
                    type="button"
                    onClick={handleEndSeason}
                    disabled={seasonEnding || !seasonConfig}
                    className="font-pixel text-[10px] text-white bg-neon-red hover:bg-red-600 border-2 border-white px-6 py-3 cursor-pointer transition-all duration-200 glow-red select-none uppercase font-bold disabled:opacity-50"
                    style={{
                      boxShadow: "0 0 15px rgba(239, 68, 68, 0.4)"
                    }}
                  >
                    {seasonEnding ? "ROLLING OVER SEASON..." : "🏆 END CURRENT SEASON & START NEW"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer banner */}
        <footer className="border-t-4 border-slate-800 bg-[#050508] py-4 text-center text-[9px] font-pixel text-slate-600 tracking-widest uppercase relative select-none">
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
