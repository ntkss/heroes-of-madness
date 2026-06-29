"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
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
  const [activeTab, setActiveTab] = useState<"leaderboard" | "matches">("leaderboard");
  const [audioInitialized, setAudioInitialized] = useState(false);

  const handleSeedMockData = async () => {
    playBeep(220, 0.15, "sawtooth");
    const confirmSeed = window.confirm("Do you want to seed mock Season 1 and Season 2 data for testing?");
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
    const confirmClear = window.confirm("Are you sure you want to delete mock Season 1 and Season 2 and reset config to Season 1?");
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
  const seasonMatches = selectedSeasonId !== null
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
      (fs) => fs.id === nameOrId.toLowerCase() || fs.name.toLowerCase() === nameOrId.toLowerCase()
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
        <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#050508] font-pixel text-neon-yellow">
          <span className="text-[10px] uppercase tracking-widest animate-pulse">
            LOADING HISTORICAL INDEXES...
          </span>
        </div>
      </CRTOverlay>
    );
  }

  return (
    <CRTOverlay>
      <div
        className="flex-grow flex flex-col justify-between min-h-screen text-slate-100 font-sans"
        onClick={initAudioFeedback}
      >
        {/* Header */}
        <header className="border-b-4 border-neon-red bg-slate-950 py-4 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 relative">
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red" />

          <div className="flex flex-col items-center md:items-start text-center md:text-left select-none">
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red">
              HEROES OF MADNESS
            </h1>
            <p className="text-[10px] font-pixel text-neon-yellow tracking-widest mt-1.5 uppercase glow-yellow">
              🏆 SEASON HALL OF FAME RECORD
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

        <main className="mx-auto w-full max-w-[850px] p-4 md:p-8 flex-grow flex flex-col gap-6">
          {seasons.length === 0 ? (
            <div className="w-full bg-[#161622]/90 border-4 border-slate-700 p-8 shadow-2xl rounded-md text-center flex flex-col items-center justify-center py-16 gap-4">
              <span className="text-3xl">🏜️</span>
              <span className="font-pixel text-[12px] text-neon-yellow uppercase tracking-widest">
                NO SEASONS ARCHIVED YET
              </span>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-wide max-w-sm leading-relaxed">
                THE FIRST SEASON IS CURRENTLY RUNNING. ONCE AN ADMIN CLOSES THE SEASON IN SETTINGS, ITS ARCHIVES WILL RECORD HERE!
              </p>
              
              <button
                onClick={handleSeedMockData}
                className="mt-4 border-2 border-neon-yellow bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow hover:text-black px-4 py-2 font-pixel text-[8px] cursor-pointer transition-all duration-200 uppercase tracking-wide font-bold"
                style={{
                  boxShadow: "0 0 10px rgba(251, 191, 36, 0.2)"
                }}
              >
                🛠️ SEED SEASONS MOCK DATA
              </button>

              <Link
                href="/"
                onClick={() => playBeep(250, 0.1, "sawtooth")}
                className="mt-2 border-2 border-neon-blue bg-neon-blue/10 text-neon-blue hover:bg-neon-blue hover:text-white px-4 py-2 font-pixel text-[8px] cursor-pointer transition-all duration-200"
              >
                ✕ RETURN TO PLAY
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Season Selector Card */}
              <div className="bg-[#161622]/95 border-4 border-slate-700 p-4 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 rounded-sm">
                <div className="flex items-center gap-3">
                  <span className="font-pixel text-[9px] text-[#a0a0c0] uppercase">
                    BROWSE RECORD:
                  </span>
                  <select
                    value={selectedSeasonId || ""}
                    onChange={(e) => {
                      playBeep(330, 0.1, "sine");
                      setSelectedSeasonId(Number(e.target.value));
                    }}
                    className="bg-slate-950 border border-slate-800 text-neon-yellow font-pixel text-[9.5px] p-2 focus:outline-none focus:border-neon-yellow rounded-sm cursor-pointer select-none"
                  >
                    {[...seasons].sort((a, b) => b.id - a.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleClearMockData}
                    className="ml-3 border border-neon-red/30 hover:border-neon-red text-neon-red/70 hover:text-neon-red bg-neon-red/5 px-2.5 py-1.5 font-pixel text-[7.5px] cursor-pointer transition-all duration-150 uppercase font-bold"
                  >
                    ✕ CLEAR MOCK DATA
                  </button>
                </div>

                <div className="text-right font-mono text-[9px] text-slate-400 uppercase select-none">
                  {selectedSeason && (
                    <>
                      DURATION: {new Date(selectedSeason.startDate).toLocaleDateString()} - {new Date(selectedSeason.endDate).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>

              {/* PODIUM STANDINGS DISPLAY */}
              {selectedSeason && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end select-none">
                  
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center">
                    {secondPlace && (
                      <div className="w-full flex flex-col items-center">
                        <div className="w-14 h-14 relative border-2 border-slate-300 rounded-sm overflow-hidden bg-slate-900 shadow-lg mb-2">
                          <Image
                            src={secondPlace.avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${secondPlace.name.toLowerCase()}`}
                            alt={secondPlace.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <span className="font-semibold text-slate-200 text-xs truncate max-w-full text-center">
                          {secondPlace.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {secondPlace.winrate}% WR ({secondPlace.total_match_played}M)
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-[#1e1e2d] border-t-2 border-l-2 border-r-2 border-slate-400 h-24 flex items-center justify-center flex-col mt-2">
                      <span className="font-pixel text-slate-300 text-lg font-bold">2</span>
                      <span className="font-pixel text-slate-400 text-[6.5px] tracking-wide mt-1 uppercase">2ND PLACE</span>
                    </div>
                  </div>

                  {/* 1st Place (Gold/Leader) */}
                  <div className="flex flex-col items-center order-first md:order-none">
                    {firstPlace && (
                      <div className="w-full flex flex-col items-center">
                        <div className="text-xl mb-1 animate-bounce">👑</div>
                        <div className="w-18 h-18 relative border-4 border-neon-yellow rounded-sm overflow-hidden bg-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.3)] mb-2">
                          <Image
                            src={firstPlace.avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${firstPlace.name.toLowerCase()}`}
                            alt={firstPlace.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <span className="font-bold text-neon-yellow text-sm glow-yellow truncate max-w-full text-center">
                          {firstPlace.name}
                        </span>
                        <span className="text-[10px] text-yellow-300/80 font-mono font-bold">
                          {firstPlace.winrate}% WR ({firstPlace.total_match_played}M)
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-[#27273a] border-t-4 border-l-2 border-r-2 border-neon-yellow h-32 flex items-center justify-center flex-col mt-2 shadow-[inset_0_0_15px_rgba(251,191,36,0.1)]">
                      <span className="font-pixel text-neon-yellow text-2xl font-bold glow-yellow">1</span>
                      <span className="font-pixel text-neon-yellow text-[7.5px] tracking-wider mt-1 uppercase glow-yellow">CHAMPION</span>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center">
                    {thirdPlace && (
                      <div className="w-full flex flex-col items-center">
                        <div className="w-14 h-14 relative border-2 border-amber-600 rounded-sm overflow-hidden bg-slate-900 shadow-lg mb-2">
                          <Image
                            src={thirdPlace.avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${thirdPlace.name.toLowerCase()}`}
                            alt={thirdPlace.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <span className="font-semibold text-slate-300 text-xs truncate max-w-full text-center">
                          {thirdPlace.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {thirdPlace.winrate}% WR ({thirdPlace.total_match_played}M)
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-[#1a1a26] border-t-2 border-l-2 border-r-2 border-amber-700 h-20 flex items-center justify-center flex-col mt-2">
                      <span className="font-pixel text-amber-600 text-lg font-bold">3</span>
                      <span className="font-pixel text-amber-600 text-[6.5px] tracking-wide mt-1 uppercase">3RD PLACE</span>
                    </div>
                  </div>

                  {/* Wooden Spoon (Last Place) */}
                  <div className="flex flex-col items-center">
                    {lastPlace && (
                      <div className="w-full flex flex-col items-center">
                        <div className="w-14 h-14 relative border-2 border-neon-red rounded-sm overflow-hidden bg-slate-900 shadow-lg mb-2 opacity-80">
                          <Image
                            src={lastPlace.avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${lastPlace.name.toLowerCase()}`}
                            alt={lastPlace.name}
                            fill
                            className="object-cover grayscale"
                            unoptimized
                          />
                        </div>
                        <span className="font-semibold text-neon-red text-xs truncate max-w-full text-center">
                          {lastPlace.name}
                        </span>
                        <span className="text-[9px] text-neon-red/70 font-mono">
                          {lastPlace.winrate}% WR ({lastPlace.total_match_played}M)
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-[#1a1010] border-t-2 border-l-2 border-r-2 border-neon-red/50 h-20 flex items-center justify-center flex-col mt-2">
                      <span className="text-neon-red text-sm">🥄</span>
                      <span className="font-pixel text-neon-red text-[6px] tracking-widest mt-1 uppercase glow-red">WOODEN SPOON</span>
                    </div>
                  </div>

                </div>
              )}

              {/* TABS FOR STANDINGS VS MATCHES */}
              <div className="flex border-b-4 border-slate-700 pb-2.5 gap-4 mt-2 select-none">
                <button
                  onClick={() => {
                    playBeep(330, 0.1, "sine");
                    setActiveTab("leaderboard");
                  }}
                  className={`font-pixel text-[9px] px-3.5 py-1.5 cursor-pointer transition-all ${
                    activeTab === "leaderboard"
                      ? "border-b-2 border-neon-yellow text-neon-yellow glow-yellow"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  🏆 FINAL LEADERBOARD
                </button>
                <button
                  onClick={() => {
                    playBeep(330, 0.1, "sine");
                    setActiveTab("matches");
                  }}
                  className={`font-pixel text-[9px] px-3.5 py-1.5 cursor-pointer transition-all ${
                    activeTab === "matches"
                      ? "border-b-2 border-neon-yellow text-neon-yellow glow-yellow"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  📜 SEASON MATCHES
                </button>
              </div>

              {/* Leaderboard Table Tab */}
              {activeTab === "leaderboard" && selectedSeason && (
                <div className="border border-slate-800 bg-[#161622]/80 p-5 shadow-xl rounded-sm">
                  <span className="font-pixel text-[8px] text-[#a0a0c0] uppercase tracking-wider block mb-4">
                    FINAL STANDINGS RULEBOOK
                  </span>

                  <div className="border border-slate-800 overflow-hidden bg-slate-950 rounded-sm">
                    <table className="w-full text-left font-sans text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 font-pixel text-[7px] text-[#a0a0c0] uppercase select-none">
                          <th className="p-3">Rank</th>
                          <th className="p-3">Fighter</th>
                          <th className="p-3">Matches</th>
                          <th className="p-3">Win Rate</th>
                          <th className="p-3">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.fighterStats
                          .sort((a, b) => b.winrate - a.winrate || b.total_match_played - a.total_match_played)
                          .map((stat, idx) => (
                            <tr
                              key={stat.id}
                              className="border-b border-slate-900/50 hover:bg-slate-900/10 transition-colors"
                            >
                              <td className="p-3 font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </td>
                              <td className="p-3 flex items-center gap-2">
                                <div className="w-6 h-6 border border-slate-800 relative overflow-hidden bg-slate-950">
                                  <Image
                                    src={stat.avatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${stat.name.toLowerCase()}`}
                                    alt={stat.name}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <span className="font-semibold text-slate-200">{stat.name}</span>
                              </td>
                              <td className="p-3 text-slate-400 font-mono">
                                {stat.total_match_played} M
                              </td>
                              <td className="p-3 font-mono text-neon-blue font-bold">
                                {stat.winrate}%
                              </td>
                              <td className="p-3">
                                <span className="text-[8.5px] font-pixel px-1.5 py-0.5 border border-slate-800 text-slate-400 bg-slate-900/50 select-none">
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
                <div className="border border-slate-800 bg-[#161622]/80 p-5 shadow-xl rounded-sm flex flex-col gap-4">
                  <span className="font-pixel text-[8px] text-[#a0a0c0] uppercase tracking-wider block">
                    ARCHIVED BATTLE LOGS ({seasonMatches.length} RECORDS)
                  </span>

                  {seasonMatches.length === 0 ? (
                    <div className="text-center py-12 select-none">
                      <span className="font-pixel text-[8.5px] text-slate-500 uppercase tracking-widest">
                        NO BATTLES RECORDED IN THIS SEASON.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {seasonMatches.map((match) => (
                        <div
                          key={match.id}
                          className="bg-slate-950 border border-slate-800 p-4 relative flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-1.5 w-full md:w-auto">
                            <div className="flex justify-between items-center md:justify-start gap-4">
                              <span className="font-pixel text-[7.5px] text-[#a0a0c0] uppercase">
                                ARCHIVED RECORD
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {formatDate(match.createdAt)}
                              </span>
                            </div>
                            
                            {/* Teams render */}
                            <div className="flex flex-col sm:flex-row gap-4 mt-1 font-mono text-xs select-none">
                              <div className="flex flex-col gap-1">
                                <span className="text-blue-400 font-bold text-[9px] font-pixel">
                                  {match.winner === "teamA" ? "👑 TEAM BLUE (WIN)" : "TEAM BLUE"}
                                </span>
                                <span className="text-slate-300 leading-relaxed text-[11px]">
                                  {match.teamA.map((p) => getFighterDisplayName(p)).join(", ")}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                                <span className="text-red-400 font-bold text-[9px] font-pixel">
                                  {match.winner === "teamB" ? "👑 TEAM RED (WIN)" : "TEAM RED"}
                                </span>
                                <span className="text-slate-300 leading-relaxed text-[11px]">
                                  {match.teamB.map((p) => getFighterDisplayName(p)).join(", ")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-pixel text-[7.5px] border border-slate-800 bg-slate-900 px-2 py-1 text-slate-400 select-none">
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
        <footer className="border-t-4 border-slate-800 bg-[#050508] py-4 text-center text-[9px] font-pixel text-slate-600 tracking-widest uppercase relative select-none">
          <span>
            HEROES OF MADNESS PRO v1.0.0 © Geminus-Dev 2026 by nutty dev`~`
          </span>
        </footer>

        <DebugBar />
      </div>
    </CRTOverlay>
  );
}
