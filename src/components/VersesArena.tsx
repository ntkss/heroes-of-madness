"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { playLockName, playExplosion, speakAnnounce, playBeep } from "@/utils/audio";
import { SQUAD_NAMES, Player } from "@/constants/players";

const ROLES = ["EXP LANE", "JUNGLE", "MIDDLE", "GOLD LANE", "ROAMER"];

// ─── SVG Icons for Spells ──────────────────────────────────────────────────
function SpellIcon({ name }: { name: string }) {
  const baseClass = "w-full h-full";
  switch (name) {
    case "Retribution":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#ff3e3e]`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="11" className="fill-[#1a0508] stroke-[#ff3e3e]/50" />
          <path d="M12 4c-1 2-2 4-2 6 0 3.5 2.5 6 6 6 .5 0 1 0 1.5-.2C16 19 12 21 9 21c-3.5 0-6-2.5-6-6 0-5 5-9 9-11z" fill="#ff7700" />
          <path d="M14 6l-2 3h3l-2 3" stroke="#ffd200" strokeWidth="1.5" />
        </svg>
      );
    case "Flicker":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#00d2ff]`} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="11" className="fill-[#051329] stroke-[#00d2ff]/50" />
          <path d="M12 4L6 11h5l-1 9 7-8h-5l1-8z" fill="#00d2ff" />
          <circle cx="12" cy="12" r="2" className="fill-white animate-ping" />
        </svg>
      );
    case "Execute":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#ffd200]`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="11" className="fill-[#1c1c0a] stroke-[#ffd200]/50" />
          <path d="M14.5 9.5L9.5 14.5M10.5 8.5L7 12M12 6.5l5.5 5.5M7 17l1.5-1.5M17 7l1.5-1.5" stroke="#ffd200" />
          <path d="M7 17l-1 1 .5.5 1-1-.5-.5z" fill="#ffd200" />
        </svg>
      );
    case "Flameshot":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#ff7700]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#1a0c02] stroke-[#ff7700]/50" />
          <circle cx="12" cy="12" r="4" fill="#ff3e3e" className="animate-pulse" />
          <path d="M5 12h14M12 5v14M7 7l10 10M17 7L7 17" stroke="#ffd200" strokeWidth="1" />
        </svg>
      );
    case "Inspire":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#d480ff]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#14051a] stroke-[#d480ff]/50" />
          <path d="M12 6v12M6 12h12M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="1" />
          <circle cx="12" cy="12" r="3" fill="#d480ff" />
        </svg>
      );
    case "Purify":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#00ff88]`} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="11" className="fill-[#021a0e] stroke-[#00ff88]/50" />
          <path d="M12 6a6 6 0 00-6 6c0 3.3 2.7 6 6 6s6-2.7 6-6a6 6 0 00-6-6z" fill="#00ff88" fillOpacity="0.2" />
          <path d="M12 9v6M9 12h6" stroke="#fff" />
        </svg>
      );
    case "Aegis":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#ffb300]`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="11" className="fill-[#1c1405] stroke-[#ffb300]/50" />
          <path d="M12 6s-5 1.5-5 5v3.5c0 2.5 5 4.5 5 4.5s5-2 5-4.5V11c0-3.5-5-5-5-5z" fill="#ffb300" fillOpacity="0.2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#00d2ff]`} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="11" className="fill-[#051329] stroke-[#00d2ff]/50" />
          <path d="M12 4L6 11h5l-1 9 7-8h-5l1-8z" fill="#00d2ff" />
        </svg>
      );
  }
}

// ─── SVG Icons for Emblems ──────────────────────────────────────────────────
function EmblemIcon({ name }: { name: string }) {
  const baseClass = "w-full h-full";
  switch (name) {
    case "Assassin":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#d946ef]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#1c0222] stroke-[#d946ef]/40" />
          <path d="M12 5l4 4-4 4-4-4 4-4z" fill="#d946ef" fillOpacity="0.3" />
          <path d="M6 12h12M12 6v12" stroke="#d946ef" strokeWidth="1" />
          <circle cx="12" cy="12" r="2" fill="#fff" />
        </svg>
      );
    case "Mage":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#3b82f6]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#02132c] stroke-[#3b82f6]/40" />
          <path d="M12 7a3 3 0 100 6 3 3 0 000-6z" fill="#3b82f6" fillOpacity="0.3" />
          <path d="M12 13v5M9 18h6" stroke="#3b82f6" />
          <circle cx="12" cy="10" r="1" fill="#fff" />
        </svg>
      );
    case "Fighter":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#ef4444]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#240404] stroke-[#ef4444]/40" />
          <path d="M9 15v-3.5a3 3 0 016 0v3.5M8 15h8M12 8v3" stroke="#ef4444" strokeLinecap="round" />
          <circle cx="12" cy="15" r="1.5" fill="#fff" />
        </svg>
      );
    case "Marksman":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#eab308]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#201802] stroke-[#eab308]/40" />
          <path d="M7 12h10M13 8l4 4-4 4" stroke="#eab308" strokeLinecap="round" />
          <circle cx="9" cy="12" r="2" fill="#eab308" />
        </svg>
      );
    case "Tank":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#06b6d4]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#021a22] stroke-[#06b6d4]/40" />
          <rect x="8" y="7" width="8" height="10" rx="1" fill="#06b6d4" fillOpacity="0.3" stroke="#06b6d4" />
          <path d="M12 7v10" stroke="#fff" strokeWidth="1" />
        </svg>
      );
    case "Support":
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#22c55e]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#02200a] stroke-[#22c55e]/40" />
          <path d="M12 6v12M6 12h12" stroke="#22c55e" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" fill="#22c55e" fillOpacity="0.3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={`${baseClass} fill-none stroke-[#64748b]`} strokeWidth="2">
          <circle cx="12" cy="12" r="11" className="fill-[#0f172a] stroke-[#64748b]/40" />
          <circle cx="12" cy="12" r="4" stroke="#64748b" />
        </svg>
      );
  }
}

// ─── Deterministic Cosmetics Builder ─────────────────────────────────────────
const getCosmetics = (name: string, role: string) => {
  if (!name || name === "???" || name === "DRAFTING") {
    return {
      flag: "🏳️",
      skinTier: null,
      skinName: "",
      spell: "Flicker",
      emblem: "Common",
      heroName: "HERO DRAFT"
    };
  }

  // Simple deterministic hash based on name characters
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const flags = ["🇺🇸", "🇵🇭", "🇸🇬", "🇮🇩", "🇲🇾", "🇹🇭", "🇻🇳", "🇯🇵", "🇰🇷", "🇧🇷", "🇨🇦"];
  const flag = flags[hash % flags.length];

  // Skin tiers & names
  const tierChance = hash % 10;
  let skinTier: string | null = null;
  let skinName = "";

  const skins = [
    { tier: "LEGEND", name: "Obsidian Blade" },
    { tier: "EPIC", name: "Soul Revelation" },
    { tier: "LIMITED", name: "Honor" },
    { tier: "SPECIAL", name: "Zombie Bambino" },
    { tier: "ELITE", name: "King of Muay Thai" },
    { tier: "STARLIGHT", name: "Street Blow" },
    { tier: "COLLECTOR", name: "Doom Duelist" },
    { tier: "LIGHTBORN", name: "Defender" }
  ];

  // 60% chance to have a skin tier badge
  if (tierChance > 3) {
    const skinObj = skins[hash % skins.length];
    skinTier = skinObj.tier;
    skinName = skinObj.name;
  }

  // Spell based on role and hash
  let spell = "Flicker";
  if (role === "JUNGLE") {
    spell = "Retribution";
  } else if (role === "EXP LANE") {
    const expSpells = ["Execute", "Vengeance", "Flicker"];
    spell = expSpells[hash % expSpells.length];
  } else if (role === "MIDDLE") {
    const midSpells = ["Flameshot", "Flicker", "Purify"];
    spell = midSpells[hash % midSpells.length];
  } else if (role === "GOLD LANE") {
    const goldSpells = ["Inspire", "Flicker", "Purify"];
    spell = goldSpells[hash % goldSpells.length];
  } else if (role === "ROAMER") {
    const roamSpells = ["Revitalize", "Aegis", "Flicker", "Sprint"];
    spell = roamSpells[hash % roamSpells.length];
  }

  // Emblem based on role
  let emblem = "Common";
  if (role === "JUNGLE") {
    const jungleEmblems = ["Assassin", "Fighter", "Mage"];
    emblem = jungleEmblems[hash % jungleEmblems.length];
  } else if (role === "EXP LANE") {
    const expEmblems = ["Fighter", "Tank"];
    emblem = expEmblems[hash % expEmblems.length];
  } else if (role === "MIDDLE") {
    const midEmblems = ["Mage", "Support"];
    emblem = midEmblems[hash % midEmblems.length];
  } else if (role === "GOLD LANE") {
    const goldEmblems = ["Marksman", "Assassin"];
    emblem = goldEmblems[hash % goldEmblems.length];
  } else if (role === "ROAMER") {
    const roamEmblems = ["Tank", "Support"];
    emblem = roamEmblems[hash % roamEmblems.length];
  }

  // Pick a random cool MLBB hero name
  const heroes = [
    "Angela", "Karina", "Lesley", "Cyclops", "Miya", 
    "Gusion", "Chou", "Lancelot", "Cecilion", "Tigreal", 
    "Balmond", "Bruno", "Layla", "Fanny", "Saber", 
    "Hayabusa", "Zilong", "Eudora", "Nana", "Rafaela",
    "Franco", "Akai", "Alice", "Clint", "Alucard"
  ];
  const heroName = heroes[hash % heroes.length];

  return { flag, skinTier, skinName, spell, emblem, heroName };
};

// ─── Skin Tier Badge component ──────────────────────────────────────────────
function SkinTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  
  let bgGradient = "from-slate-600 to-slate-800 border-slate-400 text-white";
  
  if (tier === "LEGEND") {
    bgGradient = "from-red-600 via-yellow-500 to-red-600 border-yellow-400 text-yellow-100 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]";
  } else if (tier === "EPIC" || tier === "COLLECTOR") {
    bgGradient = "from-purple-800 to-indigo-900 border-purple-400 text-yellow-300 shadow-[0_0_6px_rgba(168,85,247,0.5)]";
  } else if (tier === "LIMITED") {
    bgGradient = "from-cyan-700 to-blue-800 border-cyan-400 text-teal-100 shadow-[0_0_6px_rgba(6,182,212,0.5)]";
  } else if (tier === "SPECIAL") {
    bgGradient = "from-teal-700 to-emerald-800 border-teal-400 text-yellow-200";
  } else if (tier === "ELITE") {
    bgGradient = "from-emerald-600 to-green-700 border-green-300 text-white";
  } else if (tier === "STARLIGHT") {
    bgGradient = "from-pink-600 to-fuchsia-800 border-pink-400 text-white";
  } else if (tier === "LIGHTBORN") {
    bgGradient = "from-amber-600 to-yellow-700 border-yellow-300 text-white";
  }

  return (
    <div className={`absolute top-1 left-1/2 transform -translate-x-1/2 z-20 px-1 py-0.5 border text-[5.5px] font-pixel uppercase tracking-wider leading-none rounded-sm bg-gradient-to-r ${bgGradient}`}>
      {tier}
    </div>
  );
}

interface VersesArenaProps {
  teamA: string[];
  teamB: string[];
  winner: "teamA" | "teamB" | null;
  isGenerating: boolean;
  triggerScreenShake: () => void;
  squad: Player[];
}

// ─── Player Card ───────────────────────────────────────────────────────────────
interface PlayerCardProps {
  name: string;
  role: string;
  slotIndex: number;
  locked: boolean;
  team: "A" | "B";
  imageURL?: string;
  isWinner: boolean;
  isLoser: boolean;
  percentage: number;
}

function PlayerCard({ name, role, slotIndex, locked, team, imageURL, isWinner, isLoser, percentage }: PlayerCardProps) {
  const isBlue = team === "A";
  const rolling = !locked;

  // Use fallback Dicebear pixel-art avatar if no imageURL is provided to prevent ugly empty avatars
  const avatarSeed = name.toLowerCase();
  const finalImageURL = name !== "???" && name !== "DRAFTING"
    ? (imageURL || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${avatarSeed}&backgroundColor=1a1a2e`)
    : null;

  const cosmetics = getCosmetics(name, role);

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden border-2
        transition-all duration-300 origin-bottom transform -skew-x-[6deg]
        ${rolling ? "scale-105 z-10" : "scale-100"}
        ${isLoser ? "opacity-35 grayscale" : "opacity-100"}
        ${rolling
          ? "border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)] animate-pulse"
          : isBlue
            ? "border-[#c5a059] shadow-[0_0_8px_rgba(0,191,255,0.2)]"
            : "border-[#b85b5b] shadow-[0_0_8px_rgba(239,68,68,0.2)]"
        }
      `}
      style={{ 
        flex: "1 1 0", 
        minWidth: 0,
        aspectRatio: "1/2.2",
        maxHeight: "235px",
        minHeight: "130px",
        background: isBlue
          ? "linear-gradient(to bottom, #071324 0%, #0d1e36 50%, #0b1522 100%)"
          : "linear-gradient(to bottom, #1d050a 0%, #2e0911 50%, #1c050a 100%)",
      }}
    >
      {/* Glow highlight on drafting slot */}
      {rolling && (
        <div className="absolute inset-0 bg-yellow-400/5 animate-pulse z-0 pointer-events-none" />
      )}

      {/* Unskewed Content Wrapper */}
      <div className="w-full h-full transform skew-x-[6deg] relative flex flex-col justify-between p-0.5 sm:p-1 z-10 select-none">
        
        {/* Country Flag (Top Left) */}
        {name !== "???" && name !== "DRAFTING" && (
          <div className="absolute top-0.5 left-0.5 z-20 w-4.5 h-4.5 rounded-full overflow-hidden bg-slate-900 border border-white/20 flex items-center justify-center shadow-md text-[8.5px]">
            {cosmetics.flag}
          </div>
        )}

        {/* Skin Tier Banner (Top Center) */}
        {name !== "???" && name !== "DRAFTING" && (
          <SkinTierBadge tier={cosmetics.skinTier} />
        )}

        {/* Slot level indicator (Top Right) */}
        <div className="absolute top-0.5 right-0.5 z-20 w-4.5 h-4.5 rounded-full bg-black/60 border border-white/20 flex items-center justify-center font-pixel text-[6px] text-slate-300 shadow-md">
          {isBlue ? "L12" : "S17"}
        </div>

        {/* Background Portrait Image (Unskewed and stretched slightly to cover bounds) */}
        <div className="absolute inset-0 w-[140%] -left-[20%] h-full pointer-events-none z-0">
          {finalImageURL ? (
            <Image
              src={finalImageURL}
              alt={name}
              fill
              className="object-cover object-top opacity-85"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
              <span className="text-slate-600 font-pixel text-[6px] animate-pulse">DRAFT</span>
            </div>
          )}
        </div>

        {/* Ambient Dark Gradient Bottom Overlay to make text legible */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none z-10"
          style={{
            background: isBlue
              ? "linear-gradient(to top, rgba(3, 8, 20, 0.98) 0%, rgba(3, 8, 20, 0.8) 55%, rgba(3, 8, 20, 0.1) 85%, transparent 100%)"
              : "linear-gradient(to top, rgba(20, 3, 5, 0.98) 0%, rgba(20, 3, 5, 0.8) 55%, rgba(20, 3, 5, 0.1) 85%, transparent 100%)",
          }}
        />

        {/* Winner Badge Banner */}
        {isWinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <span className="text-yellow-400 font-action text-[12px] sm:text-base font-black rotate-[-15deg] glow-yellow tracking-wider select-none border border-yellow-400/80 px-1.5 py-0.5 bg-black/80 shadow-[0_0_10px_rgba(250,204,21,0.5)]">
              WIN
            </span>
          </div>
        )}

        {/* Bottom Hero & Player detail card */}
        <div className="mt-auto w-full relative z-20 flex flex-col pt-2">
          
          {/* Skin Name */}
          {cosmetics.skinName && (
            <span className={`text-[6px] sm:text-[7px] font-pixel tracking-wider text-center block truncate leading-tight uppercase ${
              cosmetics.skinTier === "LEGEND" ? "text-red-400 glow-red" :
              cosmetics.skinTier === "EPIC" ? "text-purple-400 glow-purple" :
              cosmetics.skinTier === "LIMITED" ? "text-cyan-400 glow-blue" :
              "text-emerald-400"
            }`}>
              {cosmetics.skinName}
            </span>
          )}

          {/* Hero Name (Large font) */}
          <span className="font-action text-[9.5px] sm:text-[11px] md:text-[12px] font-bold text-white text-center block truncate leading-none mt-0.5 tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
            {cosmetics.heroName}
          </span>

          {/* Player drafted Name */}
          <span className="font-mono text-[7px] sm:text-[8.5px] text-slate-300 text-center block truncate mt-0.5 opacity-90 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.8)]">
            {name}
          </span>

          {/* Loading Stats Bottom row */}
          <div className="flex items-center justify-between w-full mt-1 p-0.5 sm:p-1 bg-black/60 rounded border border-white/5 shadow-inner">
            
            {/* Progress bar container */}
            <div className="flex-grow flex flex-col mr-1">
              <span className="font-mono text-[7px] sm:text-[8px] font-bold text-white text-left pl-0.5 leading-none mb-0.5">
                {percentage}%
              </span>
              <div className="w-full h-0.5 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-150 ${
                    isBlue 
                      ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]' 
                      : 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Emblem and Spell badges */}
            <div className="flex gap-0.5 shrink-0">
              <div className="w-3 h-3 rounded-full overflow-hidden bg-slate-950 border border-white/10" title={`Emblem: ${cosmetics.emblem}`}>
                <EmblemIcon name={cosmetics.emblem} />
              </div>
              <div className="w-3 h-3 rounded-full overflow-hidden bg-slate-950 border border-white/10" title={`Spell: ${cosmetics.spell}`}>
                <SpellIcon name={cosmetics.spell} />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

// ─── Team Row ──────────────────────────────────────────────────────────────────
interface TeamRowProps {
  label: string;
  side: "A" | "B";
  display: string[];
  locked: boolean[];
  lockedOffset: number;
  winner: "teamA" | "teamB" | null;
  squad: Player[];
  percentages: number[];
}

function TeamRow({ label, side, display, locked, lockedOffset, winner, squad, percentages }: TeamRowProps) {
  const isBlue = side === "A";
  const isWinner = winner === (isBlue ? "teamA" : "teamB");
  const isLoser = winner !== null && !isWinner;

  const getPlayer = (name: string) => squad.find(p => p.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="relative flex flex-col gap-1 w-full shrink-0">
      {/* Team lane role markers */}
      <div className={`flex items-center justify-between mb-0.5 px-1 max-w-5xl w-full mx-auto ${isBlue ? 'lg:pl-[8%]' : 'lg:pr-[8%]'}`}>
        <span
          className={`font-pixel text-[7.5px] md:text-[8.5px] uppercase tracking-widest ${
            isBlue ? "text-cyan-400 glow-blue" : "text-rose-500 glow-red"
          }`}
        >
          {label}
        </span>
        <span
          className={`font-pixel text-[6.5px] px-1 py-0.2 border ${
            isBlue
              ? "border-cyan-500/20 text-cyan-400/60 bg-cyan-950/20"
              : "border-rose-500/20 text-rose-400/60 bg-rose-950/20"
          }`}
        >
          TEAM {side}
        </span>
      </div>

      {/* 5 slanted cards - staggered left (Blue) or right (Red) on large screens, centered on mobile */}
      <div className={`flex gap-1 md:gap-1.5 w-full max-w-5xl mx-auto ${
        isBlue 
          ? 'justify-center lg:justify-start lg:pl-[8%]' 
          : 'justify-center lg:justify-end lg:pr-[8%]'
      }`}>
        {display.map((name, idx) => {
          const player = getPlayer(name);
          return (
            <PlayerCard
              key={idx}
              name={name}
              role={ROLES[idx]}
              slotIndex={idx}
              locked={locked[idx + lockedOffset]}
              team={side}
              imageURL={player?.imageURL}
              isWinner={isWinner}
              isLoser={isLoser}
              percentage={percentages[idx + lockedOffset]}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── VersesArena Main component ────────────────────────────────────────────────
export default function VersesArena({
  teamA,
  teamB,
  winner,
  isGenerating,
  triggerScreenShake,
  squad,
}: VersesArenaProps) {
  const [dispA, setDispA] = useState<string[]>(Array(5).fill("???"));
  const [dispB, setDispB] = useState<string[]>(Array(5).fill("???"));
  const [lockedSlots, setLockedSlots] = useState<boolean[]>(Array(10).fill(true));
  
  // Loading percentage state (climbing from 5% to 100%)
  const [percentages, setPercentages] = useState<number[]>(Array(10).fill(100));

  const TIPS = [
    "Tip: When your team is behind, try to only engage the enemy when you have the numbers advantage.",
    "Tip: Check the mini-map frequently to avoid being ambushed by enemy Junglers.",
    "Tip: Destroying enemy turrets is the key to victory, not just getting hero kills.",
    "Tip: The Lord can help you push lanes and break the enemy base. Secure it when possible.",
    "Tip: Keep an eye on the enemy's battle spells and cooldowns before starting a team fight.",
    "Tip: The Turtle provides valuable shield and gold buffs. Fight for it in the early game.",
    "Tip: Protect your gold laner and jungler so they can carry the team to victory.",
    "Tip: Communication is key. Use signals to coordinate with your teammates."
  ];
  const [currentTip, setCurrentTip] = useState(TIPS[0]);

  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const lockTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Independent ref for the simulated percentage incremental tick to avoid React state closure stale bugs
  const pctIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = () => {
    intervalsRef.current.forEach(clearInterval);
    lockTimersRef.current.forEach(clearTimeout);
    intervalsRef.current = [];
    lockTimersRef.current = [];
    if (pctIntervalRef.current) {
      clearInterval(pctIntervalRef.current);
      pctIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return clearAllTimers;
  }, []);

  useEffect(() => {
    if (isGenerating) {
      clearAllTimers();
      setLockedSlots(Array(10).fill(false));
      playBeep(440, 0.2, "sawtooth");

      // Pick random tips on draft start
      const randomTip = TIPS[Math.floor(Math.random() * TIPS.length)];
      setCurrentTip(randomTip);

      // Set initial mock progress (5% - 19%)
      const initialPcts = Array(10).fill(0).map(() => Math.floor(Math.random() * 15) + 5);
      setPercentages(initialPcts);

      // Increment progress timers
      pctIntervalRef.current = setInterval(() => {
        setPercentages(prev => {
          return prev.map(pct => {
            if (pct >= 99) return pct;
            const step = Math.floor(Math.random() * 8) + 2; // Increments of 2% to 9%
            const next = pct + step;
            return next >= 99 ? 99 : next;
          });
        });
      }, 100);

      const activeDispA = [...dispA];
      const activeDispB = [...dispB];

      const startRoll = (teamIndex: number, slotIndex: number) => {
        const intervalId = setInterval(() => {
          const randIndex = Math.floor(Math.random() * SQUAD_NAMES.length);
          const randomName = SQUAD_NAMES[randIndex];
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

          // Set locked slots percentage immediately to 100%
          setPercentages(prev => {
            const next = [...prev];
            next[i] = 100;
            next[i + 5] = 100;
            return next;
          });

          if (i === 4) {
            triggerScreenShake();
            playExplosion();
            if (pctIntervalRef.current) {
              clearInterval(pctIntervalRef.current);
              pctIntervalRef.current = null;
            }
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
      setPercentages(Array(10).fill(100));
      if (pctIntervalRef.current) {
        clearInterval(pctIntervalRef.current);
        pctIntervalRef.current = null;
      }
    }
  }, [isGenerating, teamA, teamB]);

  return (
    <div 
      className="flex flex-col justify-center gap-3 p-3 md:p-4 w-full relative overflow-hidden rounded-md transition-all duration-300 lg:aspect-[16/9] min-h-[380px] lg:max-h-[500px]"
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #090d16 50%, #030712 100%)",
        backgroundImage: "radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)",
      }}
    >
      {/* Dynamic ambient color nodes */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-rose-500/10 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Team A (Top Row) */}
      <TeamRow
        label="TEAM BLUE DRAGON"
        side="A"
        display={dispA}
        locked={lockedSlots}
        lockedOffset={0}
        winner={winner}
        squad={squad}
        percentages={percentages}
      />

      {/* VS Banner Separator & Loading screen tips */}
      <div className="flex flex-col items-center justify-center my-0.5 select-none relative z-10 w-full shrink-0">
        {/* Loading Tip */}
        <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-sans tracking-wide mb-1.5 text-center max-w-xl px-4 italic opacity-95">
          {currentTip}
        </div>

        {/* VS emblem and dividing lines */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-yellow-500/40" />
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full border border-yellow-500/30 bg-slate-950/90 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
            <span
              className={`font-action font-black italic text-base tracking-tighter transition-all duration-150 ${
                isGenerating
                  ? "text-yellow-400 glow-yellow scale-110 animate-pulse"
                  : "text-yellow-500 glow-yellow"
              }`}
              style={{ textShadow: "0 0 6px rgba(234, 179, 8, 0.6)" }}
            >
              VS
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-rose-500/30 to-yellow-500/40" />
        </div>
      </div>

      {/* Team B (Bottom Row) */}
      <TeamRow
        label="TEAM RED TIGER"
        side="B"
        display={dispB}
        locked={lockedSlots}
        lockedOffset={5}
        winner={winner}
        squad={squad}
        percentages={percentages}
      />
    </div>
  );
}
