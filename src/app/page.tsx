"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import PlayerInput from "@/components/PlayerInput";
import VersesArena from "@/components/VersesArena";
import HistoryDashboard from "@/components/HistoryDashboard";
import DebugBar from "@/components/DebugBar";
import {
  Match,
  DbPlayer,
  fetchMatches,
  saveMatch,
  updateMatchWinner,
  deleteMatch,
  fetchPlayers,
  savePlayer,
  RankConfig,
  fetchRankConfig,
  DEFAULT_RANK_CONFIG,
} from "@/utils/firebase";
import { playBeep, playCoin, speakAnnounce } from "@/utils/audio";
import { FILL_POOL_NAMES } from "@/constants/players";

export default function Home() {
  const [names, setNames] = useState<string[]>([]);
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [activeWinner, setActiveWinner] = useState<"teamA" | "teamB" | null>(
    null,
  );
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<DbPlayer[]>([]);
  const [rankConfig, setRankConfig] = useState<RankConfig | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const showArena = teamA.length > 0 || isGenerating;

  useEffect(() => {
    if (showArena) {
      const timer = setTimeout(() => {
        arenaRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showArena]);

  useEffect(() => {
    const loadData = async () => {
      const [logs, players, config] = await Promise.all([
        fetchMatches(),
        fetchPlayers(),
        fetchRankConfig(),
      ]);
      setMatches(logs);
      setAvailablePlayers(players);
      setRankConfig(config);
    };
    loadData();
  }, []);

  const handleAddPlayer = async (newPlayer: Omit<DbPlayer, "id">) => {
    const saved = await savePlayer(newPlayer);
    setAvailablePlayers((prev) => [...prev, saved]);
    return saved;
  };

  const triggerScreenShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;

    if (!audioInitialized) {
      setAudioInitialized(true);
      playCoin();
    }

    setIsGenerating(true);
    setActiveWinner(null);
    setActiveMatchId(null);

    const draftNames = [...names];
    if (draftNames.length < 10) {
      const needed = 10 - draftNames.length;
      const availableBots = FILL_POOL_NAMES.filter(
        (p) =>
          !draftNames.map((n) => n.toLowerCase()).includes(p.toLowerCase()),
      );
      const shuffledBots = [...availableBots].sort(() => Math.random() - 0.5);

      for (let i = 0; i < needed; i++) {
        const placeholder = shuffledBots[i] || `PLAYER_${i + 1}`;
        draftNames.push(placeholder);
      }
    }

    const shuffled = [...draftNames];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const finalTeamA = shuffled.slice(0, 5);
    const finalTeamB = shuffled.slice(5, 10);

    setTeamA(finalTeamA);
    setTeamB(finalTeamB);

    setTimeout(async () => {
      try {
        const saved = await saveMatch({
          teamA: finalTeamA,
          teamB: finalTeamB,
          winner: null,
          createdAt: Date.now(),
        });
        setActiveMatchId(saved.id);

        const updatedLogs = await fetchMatches();
        setMatches(updatedLogs);
      } catch (error) {
        console.error("Failed to log draft match:", error);
      } finally {
        setIsGenerating(false);
      }
    }, 2400);
  };

  const handleUpdatePastWinner = async (
    matchId: string,
    winner: "teamA" | "teamB",
  ) => {
    await updateMatchWinner(matchId, winner);
    if (matchId === activeMatchId) {
      setActiveWinner(winner);
    }

    const [updatedLogs, updatedPlayers] = await Promise.all([
      fetchMatches(),
      fetchPlayers(),
    ]);
    setMatches(updatedLogs);
    setAvailablePlayers(updatedPlayers);
  };

  const handleDeleteMatch = async (matchId: string) => {
    await deleteMatch(matchId);

    const [updatedLogs, updatedPlayers] = await Promise.all([
      fetchMatches(),
      fetchPlayers(),
    ]);
    setMatches(updatedLogs);
    setAvailablePlayers(updatedPlayers);
  };

  const initAudioFeedback = () => {
    if (audioInitialized) return;
    setAudioInitialized(true);
    playCoin();
    speakAnnounce("WELCOME TO THE MOBILE LEGENDS RANDOM TEAM ARENA!");
  };

  return (
    <CRTOverlay isShaking={isShaking}>
      <div
        className="flex-grow flex flex-col justify-between"
        onClick={initAudioFeedback}
      >
        {/* Esports Header */}
        <header className="border-b-4 border-neon-red bg-slate-950 py-4 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 relative">
          {/* Decorative neon bottom bar line */}
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red" />

          <div className="flex flex-col items-center md:items-start text-center md:text-left select-none">
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-red">
              HEROES OF MADNESS
            </h1>
            <p className="text-[10px] font-pixel text-neon-yellow tracking-widest mt-1.5 uppercase glow-yellow">
              MLBB RANDOM TEAM GENERATOR
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-[9px] font-pixel text-[#a0a0c0] uppercase text-right">
              <span className="text-neon-blue glow-blue">
                CRT SYSTEM CONNECTED
              </span>
              <span className="text-slate-500 mt-1">DIAGNOSTICS OK</span>
            </div>

            {/* Announcer Synth Activator */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAudioInitialized(true);
                playCoin();
                speakAnnounce("VOICE LOG INITIALIZED");
              }}
              className={`w-10 h-10 border-2 rounded-none flex items-center justify-center cursor-pointer transition-all duration-200 ${
                audioInitialized
                  ? "border-neon-yellow text-neon-yellow bg-neon-yellow/10 glow-yellow"
                  : "border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300"
              }`}
              title="Click to boot cabinet announcer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02M3 9v6h4l5 5V4L7 9H3z" />
              </svg>
            </button>

            {/* Rank Config Settings Gear Button */}
            {rankConfig && (
              <Link
                href="/settings"
                onClick={() => {
                  playBeep(300, 0.15, "sawtooth");
                }}
                className="w-10 h-10 border-2 border-slate-600 text-slate-500 hover:border-neon-yellow hover:text-neon-yellow hover:bg-neon-yellow/10 hover:glow-yellow rounded-none flex items-center justify-center cursor-pointer transition-all duration-200"
                title="Configure Ranks Settings"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </Link>
            )}
          </div>
        </header>

        {/* Dashboard Main Area */}
        <main className="mx-auto w-full p-4 md:p-8 flex-grow flex flex-col gap-8 items-center">
          {/* Top Section: PlayerInput (Centered, Max 800px) */}
          <section className="w-full max-w-[800px] flex flex-col">
            <PlayerInput
              names={names}
              onChange={setNames}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              availablePlayers={availablePlayers}
              onAddPlayer={handleAddPlayer}
            />
          </section>

          {/* Middle Section: Verses Arena (Full Width, Animate Reveal) */}
          <section
            ref={arenaRef}
            className={`w-full transition-all duration-700 ease-out origin-top overflow-hidden ${
              showArena
                ? "max-h-[1000px] opacity-100 my-8 scale-y-100"
                : "max-h-0 opacity-0 my-0 scale-y-0 pointer-events-none"
            }`}
          >
            <div className="flex flex-col bg-slate-950/80 border-4 border-slate-700/80 shadow-2xl min-h-[500px] rounded-md transition-all duration-300">
              {/* Cabinet Frame Header */}
              <div className="bg-[#161622] border-b-4 border-slate-700/80 px-6 py-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-red animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-blue animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-yellow animate-pulse" />
                </div>
                <span className="font-pixel text-[9px] text-[#a0a0c0] uppercase tracking-widest">
                  {isGenerating
                    ? "DRAFT GENERATOR ACTIVE"
                    : "VERSUS ARENA STANDARD"}
                </span>
              </div>

              {/* Arena Grid */}
              <VersesArena
                teamA={teamA}
                teamB={teamB}
                winner={activeWinner}
                isGenerating={isGenerating}
                triggerScreenShake={triggerScreenShake}
                squad={availablePlayers}
                rankConfig={rankConfig || DEFAULT_RANK_CONFIG}
              />
            </div>
          </section>

          {/* Bottom Section: History logs Dashboard */}
          <section className="w-full max-w-5xl flex flex-col">
            <HistoryDashboard
              matches={matches}
              onDeleteMatch={handleDeleteMatch}
              onUpdateWinner={handleUpdatePastWinner}
              availablePlayers={availablePlayers}
              rankConfig={rankConfig || DEFAULT_RANK_CONFIG}
            />
          </section>
        </main>

        {/* Footer banner */}
        <footer className="border-t-4 border-slate-800 bg-[#050508] py-4 text-center text-[9px] font-pixel text-slate-600 tracking-widest uppercase relative select-none">
          <span>
            HEROES OF MADNESS PRO v1.0.0 © Geminus-Dev 2026 by nutty dev`~`
          </span>
        </footer>

        {/* Floating Debug Bar Overlay */}
        <DebugBar />
      </div>
    </CRTOverlay>
  );
}
