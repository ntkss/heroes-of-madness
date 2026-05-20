"use client";

import React, { useState, useEffect } from "react";
import CRTOverlay from "@/components/CRTOverlay";
import PlayerInput from "@/components/PlayerInput";
import VersesArena from "@/components/VersesArena";
import HistoryDashboard from "@/components/HistoryDashboard";
import { Match, fetchMatches, saveMatch, updateMatchWinner, deleteMatch } from "@/utils/firebase";
import { playBeep, playCoin, speakAnnounce } from "@/utils/audio";

const HERO_POOL = [
  "Layla", "Miya", "Alucard", "Gusion", "Chou", "Fanny", "Saber", "Tigreal", "Balmond", "Eudora",
  "Bruno", "Zilong", "Kagura", "Lancelot", "Akai", "Rafaela", "Estes", "Hayabusa", "Nana", "Karina",
  "Franco", "Freya", "Lolita", "Johnson", "Ruby", "Yi Sun-shin", "Aurora", "Lapu-Lapu", "Roger", "Karrie"
];

export default function Home() {
  const [names, setNames] = useState<string[]>([]);
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [activeWinner, setActiveWinner] = useState<"teamA" | "teamB" | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [audioInitialized, setAudioInitialized] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      const data = await fetchMatches();
      setMatches(data);
    };
    loadLogs();
  }, []);

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

    let draftNames = [...names];
    if (draftNames.length < 10) {
      const needed = 10 - draftNames.length;
      const availableHeroes = HERO_POOL.filter(h => !draftNames.map(n => n.toLowerCase()).includes(h.toLowerCase()));
      const shuffledHeroes = [...availableHeroes].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < needed; i++) {
        const hero = shuffledHeroes[i] || `BOT_${i + 1}`;
        draftNames.push(hero);
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
          createdAt: Date.now()
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

  const handleMarkWinner = async (winningTeam: "teamA" | "teamB") => {
    if (!activeMatchId) return;
    setActiveWinner(winningTeam);
    await updateMatchWinner(activeMatchId, winningTeam);

    const updatedLogs = await fetchMatches();
    setMatches(updatedLogs);
  };

  const handleUpdatePastWinner = async (matchId: string, winner: "teamA" | "teamB") => {
    await updateMatchWinner(matchId, winner);
    
    const updatedLogs = await fetchMatches();
    setMatches(updatedLogs);
  };

  const handleDeleteMatch = async (matchId: string) => {
    await deleteMatch(matchId);
    
    const updatedLogs = await fetchMatches();
    setMatches(updatedLogs);
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
            <div className="flex flex-col items-end text-[9px] font-pixel text-[#a0a0c0] uppercase">
              <span>SYSTEM PORT: ONLINE</span>
              <span className="text-neon-blue glow-blue mt-1">CRT SYSTEM CONNECTED</span>
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
                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02M3 9v6h4l5 5V4L7 9H3z"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Dashboard Main Grid Area */}
        <main className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-grow grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Left Column: Fighters Selection list (4 cols) */}
          <section className="xl:col-span-4 flex flex-col">
            <PlayerInput 
              names={names}
              onChange={setNames}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </section>

          {/* Right Column: Verses Arena and Ledgers (8 cols) */}
          <section className="xl:col-span-8 flex flex-col">
            <div className="flex flex-col bg-slate-950/80 border-4 border-slate-700/80 shadow-2xl min-h-[500px] rounded-md transition-all duration-300">
              
              {/* Cabinet Frame Header */}
              <div className="bg-[#161622] border-b-4 border-slate-700/80 px-6 py-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-red animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-blue animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neon-yellow animate-pulse" />
                </div>
                <span className="font-pixel text-[9px] text-[#a0a0c0] uppercase tracking-widest">
                  {isGenerating ? "DRAFT GENERATOR ACTIVE" : "VERSUS ARENA STANDARD"}
                </span>
              </div>

              {/* Arena Grid */}
              <VersesArena 
                teamA={teamA}
                teamB={teamB}
                winner={activeWinner}
                isGenerating={isGenerating}
                onMarkWinner={handleMarkWinner}
                triggerScreenShake={triggerScreenShake}
              />
            </div>

            {/* History ledgers matches list */}
            <HistoryDashboard 
              matches={matches}
              onDeleteMatch={handleDeleteMatch}
              onUpdateWinner={handleUpdatePastWinner}
            />
          </section>

        </main>

        {/* Footer banner */}
        <footer className="border-t-4 border-slate-800 bg-[#050508] py-4 text-center text-[9px] font-pixel text-slate-600 tracking-widest uppercase relative select-none">
          <span>HEROES OF MADNESS PRO v1.0.0 © Geminus-Dev 2026</span>
        </footer>

      </div>
    </CRTOverlay>
  );
}
