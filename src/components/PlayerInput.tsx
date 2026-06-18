"use client";

import React, { useState } from "react";
import Image from "next/image";
import { playBeep, playCoin } from "@/utils/audio";
import { DbPlayer } from "@/utils/firebase";
import RegisterFighterForm from "@/components/RegisterFighterForm";
import FighterDirectory from "@/components/FighterDirectory";

interface PlayerInputProps {
  names: string[];
  onChange: (names: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  availablePlayers: DbPlayer[];
  onAddPlayer: (player: Omit<DbPlayer, "id">) => Promise<DbPlayer>;
}

export default function PlayerInput({
  names,
  onChange,
  onGenerate,
  isGenerating,
  availablePlayers,
  onAddPlayer,
}: PlayerInputProps) {
  const [isAdding, setIsAdding] = useState(false);

  const currentCount = names.length;
  const isReady = currentCount >= 10;

  const handleTogglePlayer = (player: DbPlayer) => {
    if (isGenerating) return;

    const exists = names.includes(player.name);
    if (exists) {
      playBeep(220, 0.1, "sawtooth");
      onChange(names.filter((n) => n !== player.name));
    } else {
      if (names.length >= 10) {
        playBeep(120, 0.2, "sawtooth"); // Error beep, draft full
        return;
      }
      playCoin();
      onChange([...names, player.name]);
    }
  };

  const handleRemoveName = (nameToRemove: string) => {
    if (isGenerating) return;
    playBeep(220, 0.1, "sawtooth");
    onChange(names.filter((n) => n !== nameToRemove));
  };

  const handleClear = () => {
    playBeep(220, 0.15, "sawtooth");
    onChange([]);
  };

  const handleQuickFill = () => {
    playCoin();
    // Find players not yet selected
    const unselected = availablePlayers.filter((p) => !names.includes(p.name));
    // Shuffle unselected
    const shuffled = [...unselected].sort(() => Math.random() - 0.5);
    // Take what is needed to reach 10
    const needed = 10 - names.length;
    if (needed <= 0) return;
    const toAdd = shuffled.slice(0, needed).map((p) => p.name);
    onChange([...names, ...toAdd]);
  };

  const toggleAddForm = () => {
    playBeep(440, 0.08, "triangle");
    setIsAdding(!isAdding);
  };

  return (
    <div className="flex flex-col bg-bg-cabinet border-4 border-slate-700/80 p-5 shadow-2xl relative overflow-hidden transition-all duration-300 w-full">
      {/* Decorative metal rivets/screws */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />

      {/* Screen Title */}
      <div className="flex items-center justify-between border-b-4 border-slate-700 pb-3 mb-4 select-none">
        <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow">
          SELECT FIGHTERS
        </h2>
        <span
          className={`font-pixel text-[10px] px-2.5 py-0.5 border-2 transition-all duration-300 ${
            isReady
              ? "border-neon-blue text-neon-blue glow-blue"
              : "border-neon-red text-neon-red glow-red"
          }`}
        >
          DRAFT: {currentCount}/10
        </span>
      </div>

      {/* Split layout: Left (Active Roster) & Right (Draft Actions) */}
      <div className="flex flex-col lg:flex-row gap-5 mb-5">
        {/* Left Side: Visual Draft Queue Grid */}
        <div className="flex-1 flex flex-col">
          <span className="font-pixel text-[8px] text-slate-500 uppercase mb-2">
            ACTIVE FIGHTER ROSTER SLOTS
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-black/40 border-2 border-slate-800 p-3 h-auto min-h-[170px]">
            {Array.from({ length: 10 }).map((_, index) => {
              const selectedName = names[index];
              const playerObj = availablePlayers.find(
                (p) => p.name === selectedName,
              );

              return selectedName ? (
                <div
                  key={index}
                  onClick={() => handleRemoveName(selectedName)}
                  className="relative group bg-slate-900 border border-neon-blue/40 p-2 flex flex-col items-center justify-center text-center cursor-pointer hover:border-neon-red transition-all duration-200"
                >
                  <div className="w-10 h-10 relative mb-1 overflow-hidden border border-slate-700 rounded-sm">
                    <Image
                      src={
                        playerObj?.avatar ||
                        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${selectedName.toLowerCase()}&backgroundColor=1a1a2e`
                      }
                      alt={selectedName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <span className="text-[10px] text-white font-bold tracking-wide truncate w-full">
                    {selectedName}
                  </span>
                  <span className="text-[7px] text-neon-blue font-pixel block truncate w-full uppercase">
                    {playerObj?.alias || "Fighter"}
                  </span>
                  {/* Remove Hover overlay */}
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <span className="font-pixel text-[8px] text-neon-red tracking-tight">
                      REMOVE
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="bg-black/20 border border-dashed border-slate-800 flex flex-col items-center justify-center p-2 text-center text-slate-600 select-none"
                >
                  <span className="font-pixel text-[14px] leading-none mb-1">
                    +
                  </span>
                  <span className="font-pixel text-[6.5px] uppercase tracking-tighter">
                    VACANT
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Quick Fill, Clear, Add new, Fight */}
        <div className="lg:w-80 flex flex-col justify-between gap-4">
          <p className="text-[10.5px] text-[#a0a0c0] uppercase tracking-wider leading-relaxed font-mono">
            SELECT 10 PLAYERS FROM THE DATABASE BELOW. USE QUICK FILL TO LET RANDOM BOTS FILL THE VOID.
          </p>

          <div className="grid grid-cols-2 gap-2 font-pixel">
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[9px] text-neon-blue bg-transparent border-2 border-neon-blue/40 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-neon-blue hover:text-white active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter font-bold"
              disabled={isGenerating}
            >
              QUICK FILL
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] text-neon-red/80 bg-transparent border-2 border-neon-red/40 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-neon-red hover:text-neon-red active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter font-bold"
              disabled={isGenerating}
            >
              CLEAR ALL
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleAddForm}
              className={`font-pixel text-[9px] py-2.5 border-2 uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                isAdding
                  ? "border-neon-yellow text-neon-yellow bg-neon-yellow/5 glow-yellow"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
              }`}
            >
              {isAdding ? "✕ CLOSE FORM" : "➕ ADD NEW FIGHTER"}
            </button>

            <button
              type="button"
              onClick={() => {
                playBeep(880, 0.15, "sawtooth");
                onGenerate();
              }}
              disabled={isGenerating || !isReady}
              className={`font-pixel text-xs py-3 w-full select-none uppercase font-bold tracking-wide transition-all transform border-4 ${
                isGenerating || !isReady
                  ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed shadow-none"
                  : "text-black bg-neon-yellow border-white cursor-pointer shadow-[0_0_0_4px_#121214,0_5px_0_#121214,0_6px_12px_rgba(255,210,0,0.25)] hover:bg-white hover:shadow-[0_0_0_4px_#121214,0_5px_0_#121214,0_6px_15px_rgba(255,255,255,0.35)] active:translate-y-0.5 active:shadow-[0_0_0_4px_#121214,0_0_0_#121214] -translate-y-0.5"
              }`}
            >
              {isGenerating ? "DRAFTING..." : "FIGHT! RANDOMIZE"}
            </button>

            {!isReady && (
              <div className="text-[8.5px] text-neon-red font-pixel text-center uppercase mt-1 animate-pulse">
                ⚠️ DRAFT INCOMPLETE ({currentCount}/10). SELECT 10 PLAYERS!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Fighter Form Pane */}
      {isAdding && (
        <RegisterFighterForm
          onSubmit={async (data) => {
            const trimmedName = (data.name || "").trim();
            if (!trimmedName) {
              throw new Error("FIGHTER NAME REQUIRED!");
            }

            // Check uniqueness
            const nameExists = availablePlayers.some(
              (p) =>
                p.name.toLowerCase() === trimmedName.toLowerCase() ||
                p.id.toLowerCase() === trimmedName.toLowerCase(),
            );
            if (nameExists) {
              throw new Error("FIGHTER NAME ALREADY EXISTS!");
            }

            const added = await onAddPlayer({
              name: trimmedName,
              alias: (data.alias || "").trim() || trimmedName.toLowerCase(),
              avatar: data.avatar,
              imageURL: data.avatar,
              winrate: 0,
              current_rank: "Epic",
              highest_rank: "Legend",
              total_match_played: 0,
              role: "ALL-ROUNDER",
            });

            setIsAdding(false);
            playCoin();

            // Auto-add new player to draft if there's space
            if (names.length < 10) {
              onChange([...names, added.name]);
            }
          }}
          onClose={() => setIsAdding(false)}
        />
      )}

      {/* Bottom section: filterable list of player buttons */}
      <FighterDirectory
        availablePlayers={availablePlayers}
        names={names}
        onTogglePlayer={handleTogglePlayer}
      />
    </div>
  );
}
