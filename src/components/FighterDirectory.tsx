"use client";

import React, { useState } from "react";
import Image from "next/image";
import { DbPlayer } from "@/utils/firebase";

interface FighterDirectoryProps {
  availablePlayers: DbPlayer[];
  names: string[];
  onTogglePlayer: (player: DbPlayer) => void;
}

export default function FighterDirectory({
  availablePlayers,
  names,
  onTogglePlayer,
}: FighterDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlayers = availablePlayers.filter((player) => {
    const search = searchTerm.toLowerCase();
    return (
      player.name.toLowerCase().includes(search) ||
      player.alias.toLowerCase().includes(search)
    );
  });

  return (
    <div className="border-t border-slate-800 pt-4 flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <span className="font-pixel text-[9px] text-neon-yellow glow-yellow uppercase">
          FIGHTER DIRECTORY (CLICK TO TOGGLE DRAFT)
        </span>

        {/* Search Input */}
        <input
          type="text"
          placeholder="SEARCH FIGHTER..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-60 bg-slate-950/80 border border-slate-700 p-1.5 px-3 text-[10px] text-white font-mono placeholder-slate-600 focus:border-neon-blue focus:outline-none transition-all duration-200"
        />
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 text-[8.5px] font-pixel text-slate-500 uppercase">
          NO FIGHTERS FOUND MATCHING "{searchTerm}"
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-1">
          {filteredPlayers.map((player) => {
            const isSelected = names.includes(player.name);
            const isThaiName = /[\u0E00-\u0E7F]/.test(player.name);
            const isThaiRank = /[\u0E00-\u0E7F]/.test(player.current_rank);

            const rankColor =
              player.current_rank.includes("Mythic")
                ? "text-purple-400"
                : player.current_rank === "Legend"
                ? "text-orange-400"
                : player.current_rank === "Epic"
                ? "text-green-400"
                : "text-slate-400";

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onTogglePlayer(player)}
                className={`flex items-center gap-2.5 p-1.5 px-3 border transition-all duration-200 cursor-pointer font-tech text-xs select-none ${
                  isSelected
                    ? "border-neon-blue bg-neon-blue/10 text-white shadow-[0_0_8px_rgba(0,210,255,0.3)] font-bold scale-[1.02]"
                    : "border-slate-800 bg-slate-950/60 text-[#a0a0c0] hover:border-slate-600 hover:text-white"
                }`}
              >
                {/* Small Avatar */}
                <div className="w-5 h-5 relative overflow-hidden rounded-sm border border-slate-700">
                  <Image
                    src={player.avatar}
                    alt={player.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex flex-col items-start leading-none gap-0.5">
                  <span className={`tracking-wide ${isThaiName ? 'font-thai text-[13px] font-bold' : 'font-bold'}`}>{player.name}</span>
                  <span className="text-[7.5px] uppercase text-slate-500">
                    {player.alias} • <span className={`${rankColor} ${isThaiRank ? 'font-thai text-[8.5px]' : ''}`}>{player.current_rank}</span>
                  </span>
                </div>
                {/* WR badge if match played > 0 */}
                {player.total_match_played > 0 && (
                  <span className="text-[7.5px] font-mono bg-black/40 px-1 border border-slate-800/80 text-neon-yellow">
                    {player.winrate}% WR
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
