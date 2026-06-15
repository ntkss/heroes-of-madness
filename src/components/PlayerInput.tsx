"use client";

import React, { useState } from "react";
import Image from "next/image";
import { playBeep, playCoin } from "@/utils/audio";
import { DbPlayer } from "@/utils/firebase";

interface PlayerInputProps {
  names: string[];
  onChange: (names: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  availablePlayers: DbPlayer[];
  onAddPlayer: (player: Omit<DbPlayer, "id">) => Promise<DbPlayer>;
}

const RANKS = [
  "Warrior", "Elite", "Master", "Grandmaster", "Epic", 
  "Legend", "Mythic", "Mythical Honor", "Mythical Glory", "Mythical Immortal"
];

const ROLES = ["EXP LANE", "JUNGLE", "MID LANE", "GOLD LANE", "ROAMER", "ALL-ROUNDER"];

export default function PlayerInput({
  names,
  onChange,
  onGenerate,
  isGenerating,
  availablePlayers,
  onAddPlayer,
}: PlayerInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // New Player Form States
  const [newName, setNewName] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [newAvatarSeed, setNewAvatarSeed] = useState("");
  const [newRank, setNewRank] = useState("Epic");
  const [newHighestRank, setNewHighestRank] = useState("Legend");
  const [newWinrate, setNewWinrate] = useState("50");
  const [newMatches, setNewMatches] = useState("0");
  const [newRole, setNewRole] = useState("ALL-ROUNDER");
  const [formError, setFormError] = useState("");

  const currentCount = names.length;
  const isReady = currentCount >= 10;

  // Filter available players by search term
  const filteredPlayers = availablePlayers.filter((player) => {
    const search = searchTerm.toLowerCase();
    return (
      player.name.toLowerCase().includes(search) ||
      player.alias.toLowerCase().includes(search)
    );
  });

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
    const unselected = availablePlayers.filter(p => !names.includes(p.name));
    // Shuffle unselected
    const shuffled = [...unselected].sort(() => Math.random() - 0.5);
    // Take what is needed to reach 10
    const needed = 10 - names.length;
    if (needed <= 0) return;
    const toAdd = shuffled.slice(0, needed).map(p => p.name);
    onChange([...names, ...toAdd]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newName.trim()) {
      setFormError("FIGHTER NAME REQUIRED!");
      return;
    }

    // Check uniqueness
    const nameExists = availablePlayers.some(
      (p) => p.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (nameExists) {
      setFormError("FIGHTER NAME ALREADY EXISTS!");
      return;
    }

    const seed = newAvatarSeed.trim() || newName.trim().toLowerCase();
    const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=1a1a2e`;

    try {
      const added = await onAddPlayer({
        name: newName.trim(),
        alias: newAlias.trim() || newName.trim().toLowerCase(),
        avatar: avatarUrl,
        avartar: avatarUrl,
        imageURL: avatarUrl,
        winrate: Number(newWinrate) || 0,
        current_rank: newRank,
        highest_rank: newHighestRank,
        total_match_played: Number(newMatches) || 0,
        role: newRole,
      });

      // Clear Form
      setNewName("");
      setNewAlias("");
      setNewAvatarSeed("");
      setNewRank("Epic");
      setNewHighestRank("Legend");
      setNewWinrate("50");
      setNewMatches("0");
      setNewRole("ALL-ROUNDER");
      setIsAdding(false);
      playCoin();

      // Auto-add new player to draft if there's space
      if (names.length < 10) {
        onChange([...names, added.name]);
      }
    } catch (err) {
      setFormError("FAILED TO SAVE PLAYER!");
    }
  };

  const toggleAddForm = () => {
    playBeep(440, 0.08, "triangle");
    setIsAdding(!isAdding);
    setFormError("");
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
            isReady ? "border-neon-blue text-neon-blue glow-blue" : "border-neon-red text-neon-red glow-red"
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
              const playerObj = availablePlayers.find((p) => p.name === selectedName);

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
                    <span className="font-pixel text-[8px] text-neon-red tracking-tight">REMOVE</span>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="bg-black/20 border border-dashed border-slate-800 flex flex-col items-center justify-center p-2 text-center text-slate-600 select-none"
                >
                  <span className="font-pixel text-[14px] leading-none mb-1">+</span>
                  <span className="font-pixel text-[6.5px] uppercase tracking-tighter">VACANT</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Quick Fill, Clear, Add new, Fight */}
        <div className="lg:w-80 flex flex-col justify-between gap-4">
          <p className="text-[10.5px] text-[#a0a0c0] uppercase tracking-wider leading-relaxed font-mono">
            SELECT 10 PLAYERS FROM THE DATABASE BELOW. IF YOU DRAFT FEWER THAN 10, RANDOM BOTS WILL FILL THE VOID.
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
              disabled={isGenerating}
              className="font-pixel text-xs text-black bg-neon-yellow border-4 border-white py-3 cursor-pointer shadow-[0_0_0_4px_#121214,0_5px_0_#121214,0_6px_12px_rgba(255,210,0,0.25)] hover:bg-white hover:shadow-[0_0_0_4px_#121214,0_5px_0_#121214,0_6px_15px_rgba(255,255,255,0.35)] active:translate-y-0.5 active:shadow-[0_0_0_4px_#121214,0_0_0_#121214] transition-all transform -translate-y-0.5 uppercase font-bold tracking-wide w-full select-none"
            >
              {isGenerating ? "DRAFTING..." : "FIGHT! RANDOMIZE"}
            </button>

            {!isReady && currentCount > 0 && (
              <div className="text-[8.5px] text-neon-red font-pixel text-center uppercase mt-1 animate-pulse">
                ⚠️ SHORT DRAFT ({currentCount}/10). BOTS JOIN!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Fighter Form Pane */}
      {isAdding && (
        <form
          onSubmit={handleFormSubmit}
          className="bg-black/60 border-2 border-neon-yellow/30 p-4 mb-5 flex flex-col gap-3 animate-scaleUp"
        >
          <div className="font-pixel text-[10px] text-neon-yellow uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-1 glow-yellow">
            NEW FIGHTER REGISTRATION
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-tech text-xs">
            {/* Fighter Name */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">NAME (REQ)</label>
              <input
                type="text"
                placeholder="e.g. Nutty"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              />
            </div>

            {/* Alias */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">ALIAS</label>
              <input
                type="text"
                placeholder="e.g. nutty"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              />
            </div>

            {/* Avatar Seed */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">AVATAR SEED</label>
              <input
                type="text"
                placeholder="Leave blank to use name"
                value={newAvatarSeed}
                onChange={(e) => setNewAvatarSeed(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              />
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">PRIMARY LANE</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Rank */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">CURRENT RANK</label>
              <select
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Highest Rank */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">HIGHEST RANK</label>
              <select
                value={newHighestRank}
                onChange={(e) => setNewHighestRank(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Win rate */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">WINRATE %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newWinrate}
                onChange={(e) => setNewWinrate(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              />
            </div>

            {/* Total Matches */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-pixel text-[7.5px] uppercase">MATCHES PLAYED</label>
              <input
                type="number"
                min="0"
                value={newMatches}
                onChange={(e) => setNewMatches(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
              />
            </div>
          </div>

          {formError && (
            <div className="text-[8.5px] font-pixel text-neon-red glow-red uppercase">
              ⚠️ {formError}
            </div>
          )}

          <button
            type="submit"
            className="self-end mt-2 font-pixel text-[9px] text-black bg-neon-yellow border-2 border-white px-4 py-2 hover:bg-white transition-colors cursor-pointer uppercase font-bold"
          >
            SUBMIT FIGHTER
          </button>
        </form>
      )}

      {/* Bottom section: filterable list of player buttons */}
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
                  onClick={() => handleTogglePlayer(player)}
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
                    <span className="font-bold tracking-wide">{player.name}</span>
                    <span className="text-[7.5px] uppercase text-slate-500">
                      {player.alias} • <span className={rankColor}>{player.current_rank}</span>
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
    </div>
  );
}
