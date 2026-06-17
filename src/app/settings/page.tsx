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
} from "@/utils/firebase";
import { playBeep, playCoin, speakAnnounce } from "@/utils/audio";

export default function SettingsPage() {
  const [rankConfig, setRankConfig] = useState<RankConfig | null>(null);

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

  useEffect(() => {
    const loadConfig = async () => {
      const config = await fetchRankConfig();
      setRankConfig(config);
      setHighName(config.tiers.high);
      setNormalName(config.tiers.normal);
      setLowName(config.tiers.low);
      setMinMatches(config.minMatches);
      setHighWinrate(config.highTierWinrate);
      setLowWinrate(config.lowTierWinrate);
    };
    loadConfig();
  }, []);

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
        <main className="mx-auto w-full max-w-[650px] p-4 md:p-8 flex-grow flex flex-col justify-center items-center">
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
            <div className="border-b-4 border-slate-700 pb-3 mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow select-none">
                ⚙️ CONFIGURATION ENGINE
              </h2>
              <span className="font-pixel text-[8px] text-[#a0a0c0]">
                STATUS: CONNECTED
              </span>
            </div>

            {rankConfig === null ? (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="font-pixel text-[10px] text-neon-yellow uppercase tracking-widest mb-2 animate-pulse">
                  CONNECTING STORAGE...
                </span>
              </div>
            ) : (
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
