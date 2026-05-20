"use client";

import React from "react";
import { Match } from "@/utils/firebase";
import { playBeep, playWin } from "@/utils/audio";

interface HistoryDashboardProps {
  matches: Match[];
  onDeleteMatch: (id: string) => void;
  onUpdateWinner: (id: string, winner: "teamA" | "teamB") => void;
}

export default function HistoryDashboard({ matches, onDeleteMatch, onUpdateWinner }: HistoryDashboardProps) {
  
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const handleDelete = (id: string) => {
    playBeep(150, 0.15, "sawtooth");
    onDeleteMatch(id);
  };

  const handleWinnerChange = (id: string, winner: "teamA" | "teamB") => {
    playWin();
    onUpdateWinner(id, winner);
  };

  return (
    <div className="flex flex-col bg-bg-cabinet border-4 border-slate-700/80 p-6 shadow-2xl relative overflow-hidden mt-8 transition-all duration-300">
      {/* Decorative metal rivets */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />

      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-slate-700 pb-3 mb-6">
        <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow">
          ARENA LOGBOOK
        </h2>
        <span className="font-pixel text-[10px] text-[#a0a0c0]">
          RECORDS: {matches.length}
        </span>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-800 bg-black/40">
          <span className="font-pixel text-[10px] text-neon-red uppercase tracking-widest mb-2 glow-red">NO RECORDS FOUND</span>
          <span className="font-pixel text-[8px] text-slate-500 uppercase">ARENA VACANT. START DRAFT TO INITIALIZE LOGS.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2">
          {matches.map((match) => (
            <div 
              key={match.id}
              className="bg-black/60 border-2 border-slate-800 p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 hover:border-slate-500 transition-colors relative"
            >
              {/* Match Details */}
              <div className="flex flex-col flex-grow gap-2">
                {/* Header labels */}
                <div className="flex items-center justify-between md:justify-start gap-4">
                  <span className="font-pixel text-[8px] text-neon-yellow bg-neon-yellow/10 px-2 py-0.5 border border-neon-yellow/20">
                    MATCH LOG
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
                    {formatDate(match.createdAt)}
                  </span>
                </div>

                {/* Team roster names grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 border-t border-slate-800/60 pt-2.5">
                  {/* Blue */}
                  <div className="flex flex-col">
                    <span className="font-pixel text-[8px] text-neon-blue uppercase mb-1">BLUE TEAM</span>
                    <span className="text-xs text-slate-100 font-mono tracking-tight uppercase truncate">
                      {match.teamA.join(" • ") || "EMPTY"}
                    </span>
                  </div>
                  {/* Red */}
                  <div className="flex flex-col">
                    <span className="font-pixel text-[8px] text-neon-red uppercase mb-1">RED TEAM</span>
                    <span className="text-xs text-slate-100 font-mono tracking-tight uppercase truncate">
                      {match.teamB.join(" • ") || "EMPTY"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action column */}
              <div className="flex flex-row md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-4 gap-3 min-w-[140px]">
                
                {/* Winner tag */}
                {match.winner ? (
                  <div className="flex flex-col items-center select-none">
                    <span className="font-pixel text-[8px] text-slate-500 uppercase mb-1">WINNER</span>
                    <span 
                      className={`font-action text-2xl font-bold tracking-widest px-3 py-0.5 border-2 uppercase leading-none ${
                        match.winner === "teamA" 
                          ? "border-neon-blue text-neon-blue glow-blue bg-neon-blue/10" 
                          : "border-neon-red text-neon-red glow-red bg-neon-red/10"
                      }`}
                    >
                      {match.winner === "teamA" ? "BLUE TEAM" : "RED TEAM"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    <span className="font-pixel text-[8px] text-neon-yellow uppercase mb-1.5 animate-pulse glow-yellow">PENDING OUTCOME</span>
                    <div className="flex gap-2 w-full font-pixel">
                      <button 
                        onClick={() => handleWinnerChange(match.id, "teamA")}
                        className="flex-grow font-pixel text-[8px] text-neon-blue bg-neon-blue/10 border border-neon-blue/40 py-1 px-1.5 hover:bg-neon-blue hover:text-black transition-all duration-200 uppercase cursor-pointer"
                      >
                        BLUE W
                      </button>
                      <button 
                        onClick={() => handleWinnerChange(match.id, "teamB")}
                        className="flex-grow font-pixel text-[8px] text-neon-red bg-neon-red/10 border border-neon-red/40 py-1 px-1.5 hover:bg-neon-red hover:text-black transition-all duration-200 uppercase cursor-pointer"
                      >
                        RED W
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(match.id)}
                  className="font-pixel text-[8px] text-slate-500 hover:text-neon-red border border-transparent hover:border-neon-red bg-transparent p-1.5 mt-0 md:mt-2 transition-all cursor-pointer uppercase flex items-center gap-1 select-none"
                  title="Purge record"
                >
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9m2 2h2v1h-2V5m-3 3h2v10H8V8m4 0h2v10h-2V8m4 0h2v10h-2V8z"/>
                  </svg>
                  PURGE
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
