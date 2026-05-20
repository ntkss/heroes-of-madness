"use client";

import React, { useEffect, useState, useRef } from "react";
import { playLockName, playExplosion, playWin, speakAnnounce, playBeep } from "@/utils/audio";
import { PRESET_CUSTOM } from "./PlayerInput";

interface VersesArenaProps {
  teamA: string[];
  teamB: string[];
  winner: "teamA" | "teamB" | null;
  isGenerating: boolean;
  onMarkWinner: (winner: "teamA" | "teamB") => void;
  triggerScreenShake: () => void;
}
const ROLES = ["EXP LANE", "JUNGLE", "MIDDLE", "GOLD LANE", "ROAMER"];
export default function VersesArena({
  teamA,
  teamB,
  winner,
  isGenerating,
  onMarkWinner,
  triggerScreenShake
}: VersesArenaProps) {
  const [dispA, setDispA] = useState<string[]>(Array(5).fill("???"));
  const [dispB, setDispB] = useState<string[]>(Array(5).fill("???"));
  const [lockedSlots, setLockedSlots] = useState<boolean[]>(Array(10).fill(true));
  
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const lockTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    intervalsRef.current.forEach(clearInterval);
    lockTimersRef.current.forEach(clearTimeout);
    intervalsRef.current = [];
    lockTimersRef.current = [];
  };

  useEffect(() => {
    return clearAllTimers;
  }, []);

  useEffect(() => {
    if (isGenerating) {
      clearAllTimers();
      setLockedSlots(Array(10).fill(false));
      playBeep(440, 0.2, "sawtooth");
      
      const activeDispA = [...dispA];
      const activeDispB = [...dispB];

      const startRoll = (teamIndex: number, slotIndex: number) => {
        const intervalId = setInterval(() => {
          const randIndex = Math.floor(Math.random() * PRESET_CUSTOM.length);
          const randomName = PRESET_CUSTOM[randIndex];
          if (teamIndex === 0) {
            activeDispA[slotIndex] = randomName;
            setDispA([...activeDispA]);
          } else {
            activeDispB[slotIndex] = randomName;
            setDispB([...activeDispB]);
          }
        }, 50 + slotIndex * 10);
        intervalsRef.current.push(intervalId);
      };

      for (let i = 0; i < 5; i++) {
        startRoll(0, i);
        startRoll(1, i);
      }

      for (let i = 0; i < 5; i++) {
        const delay = 400 + i * 450;
        
        const timerId = setTimeout(() => {
          clearInterval(intervalsRef.current[i]);
          clearInterval(intervalsRef.current[i + 5]);

          setDispA(prev => {
            const next = [...prev];
            next[i] = teamA[i] || "BOT";
            return next;
          });
          setDispB(prev => {
            const next = [...prev];
            next[i] = teamB[i] || "BOT";
            return next;
          });

          playLockName();

          setLockedSlots(prev => {
            const next = [...prev];
            next[i] = true;
            next[i + 5] = true;
            return next;
          });

          if (i === 4) {
            triggerScreenShake();
            playExplosion();
            setTimeout(() => {
              speakAnnounce("ROUND ONE. FIGHT!");
            }, 300);
          }
        }, delay);

        lockTimersRef.current.push(timerId);
      }
    } else {
      setDispA(teamA.length ? teamA : Array(5).fill("DRAFTING"));
      setDispB(teamB.length ? teamB : Array(5).fill("DRAFTING"));
      setLockedSlots(Array(10).fill(true));
    }
  }, [isGenerating, teamA, teamB]);

  const handleWinnerSelection = (winningTeam: "teamA" | "teamB") => {
    if (isGenerating) return;
    playWin();
    onMarkWinner(winningTeam);
    
    const teamLabel = winningTeam === "teamA" ? "BLUE TEAM" : "RED TEAM";
    setTimeout(() => {
      speakAnnounce(`${teamLabel} VICTORIOUS!`);
    }, 450);
  };

  return (
    <div className="flex flex-col flex-grow p-4 md:p-8">
      {/* VS Screen Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-stretch flex-grow">
        
        {/* Team A (Blue Team Side) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="flex flex-col bg-slate-950/70 border-t-4 border-l-4 border-b-4 border-neon-blue p-5 shadow-[0_0_25px_rgba(0,210,255,0.15)] relative h-full justify-between stripes-blue min-h-[420px] rounded-l-md transition-all duration-300">
            
            {/* Victory overlay banner */}
            {winner === "teamA" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-20 border-2 border-neon-yellow animate-bounce rounded-l-sm">
                <span className="font-action text-8xl font-black text-neon-yellow tracking-widest glow-yellow -rotate-12 uppercase select-none">
                  K. O. WIN
                </span>
              </div>
            )}
            {winner === "teamB" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 grayscale opacity-45 rounded-l-sm">
                <span className="font-action text-7xl font-black text-slate-600 tracking-widest -rotate-12 uppercase select-none">
                  DEFEATED
                </span>
              </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b border-neon-blue/20 pb-2.5">
              <span className="font-pixel text-[11px] text-neon-blue tracking-wider glow-blue uppercase">TEAM BLUE DRAGON</span>
              <span className="font-pixel text-[9px] text-white bg-neon-blue/20 border border-neon-blue/30 px-2 py-0.5 rounded-sm">SIDE A</span>
            </div>

            {/* 5 Fighter Cards */}
            <div className="flex flex-col gap-3.5 flex-grow justify-center font-mono">
              {dispA.map((name, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 border-2 transition-all duration-200 ${
                    lockedSlots[idx] 
                      ? "border-neon-blue/20 bg-slate-950/90 hover:border-neon-blue/40" 
                      : "border-neon-yellow bg-neon-yellow/10 animate-pulse"
                  }`}
                >
                  <div className="flex flex-col">
                    <span 
                      className={`text-2xl font-bold uppercase tracking-wider font-action leading-none ${
                        lockedSlots[idx] ? "text-white" : "text-neon-yellow"
                      }`}
                    >
                      {name}
                    </span>
                    <span className="text-[9px] text-neon-blue font-pixel tracking-tighter uppercase mt-1.5">{ROLES[idx]}</span>
                  </div>
                  <span className="font-pixel text-[8px] text-slate-500">A0{idx + 1}</span>
                </div>
              ))}
            </div>

            {!winner && teamA.length > 0 && !isGenerating && (
              <button 
                onClick={() => handleWinnerSelection("teamA")}
                className="mt-6 font-pixel text-[10px] bg-transparent border-2 border-neon-blue text-neon-blue py-3 px-4 hover:bg-neon-blue hover:text-black transition-all duration-200 uppercase cursor-pointer text-center block w-full select-none"
              >
                CROWN BLUE TEAM
              </button>
            )}
          </div>
        </div>

        {/* VS Divider column */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center py-4 lg:py-0 select-none">
          <div 
            className={`font-action text-7xl md:text-8xl font-black italic select-none tracking-tighter transition-transform duration-100 ${
              isGenerating ? "scale-125 text-neon-yellow glow-yellow animate-ping" : "text-neon-yellow glow-yellow scale-100 hover:scale-110"
            }`}
            style={{ 
              textShadow: "0 0 10px #ff8800, 0 0 30px #ffd200"
            }}
          >
            VS
          </div>
          <div className="w-1 h-32 bg-gradient-to-b from-neon-blue via-neon-yellow to-neon-red hidden lg:block opacity-40 mt-4" />
        </div>

        {/* Team B (Red Team Side) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="flex flex-col bg-slate-950/70 border-t-4 border-r-4 border-b-4 border-neon-red p-5 shadow-[0_0_25px_rgba(255,42,95,0.15)] relative h-full justify-between stripes-red min-h-[420px] rounded-r-md transition-all duration-300">
            
            {/* Victory overlay banner */}
            {winner === "teamB" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-20 border-2 border-neon-yellow animate-bounce rounded-r-sm">
                <span className="font-action text-8xl font-black text-neon-yellow tracking-widest glow-yellow rotate-12 uppercase select-none">
                  K. O. WIN
                </span>
              </div>
            )}
            {winner === "teamA" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 grayscale opacity-45 rounded-r-sm">
                <span className="font-action text-7xl font-black text-slate-600 tracking-widest rotate-12 uppercase select-none">
                  DEFEATED
                </span>
              </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b border-neon-red/20 pb-2.5">
              <span className="font-pixel text-[9px] text-white bg-neon-red/20 border border-neon-red/30 px-2 py-0.5 rounded-sm">SIDE B</span>
              <span className="font-pixel text-[11px] text-neon-red tracking-wider glow-red uppercase">TEAM RED TIGER</span>
            </div>

            {/* 5 Fighter Cards */}
            <div className="flex flex-col gap-3.5 flex-grow justify-center font-mono">
              {dispB.map((name, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 border-2 transition-all duration-200 ${
                    lockedSlots[idx + 5] 
                      ? "border-neon-red/20 bg-slate-950/90 hover:border-neon-red/40" 
                      : "border-neon-yellow bg-neon-yellow/10 animate-pulse"
                  }`}
                >
                  <div className="flex flex-col">
                    <span 
                      className={`text-2xl font-bold uppercase tracking-wider font-action leading-none ${
                        lockedSlots[idx + 5] ? "text-white" : "text-neon-yellow"
                      }`}
                    >
                      {name}
                    </span>
                    <span className="text-[9px] text-neon-red font-pixel tracking-tighter uppercase mt-1.5">{ROLES[idx]}</span>
                  </div>
                  <span className="font-pixel text-[8px] text-slate-500">B0{idx + 1}</span>
                </div>
              ))}
            </div>

            {!winner && teamB.length > 0 && !isGenerating && (
              <button 
                onClick={() => handleWinnerSelection("teamB")}
                className="mt-6 font-pixel text-[10px] bg-transparent border-2 border-neon-red text-neon-red py-3 px-4 hover:bg-neon-red hover:text-black transition-all duration-200 uppercase cursor-pointer text-center block w-full select-none"
              >
                CROWN RED TEAM
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
