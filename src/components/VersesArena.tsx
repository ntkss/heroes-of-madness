"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { playLockName, playExplosion, speakAnnounce, playBeep } from "@/utils/audio";
import { SQUAD_NAMES, Player } from "@/constants/players";

const ROLES = ["EXP LANE", "JUNGLE", "MID", "GOLD LANE", "ROAMING"];

// ─── Deterministic Cosmetics Builder ─────────────────────────────────────────
const getCosmetics = (name: string, role: string) => {
  if (!name || name === "???" || name === "DRAFTING") {
    return {
      flag: "🏳️",
      skinTier: null,
      skinName: "",
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

  // Pick a random cool MLBB hero name
  const heroes = [
    "Angela", "Karina", "Lesley", "Cyclops", "Miya",
    "Gusion", "Chou", "Lancelot", "Cecilion", "Tigreal",
    "Balmond", "Bruno", "Layla", "Fanny", "Saber",
    "Hayabusa", "Zilong", "Eudora", "Nana", "Rafaela",
    "Franco", "Akai", "Alice", "Clint", "Alucard"
  ];
  const heroName = heroes[hash % heroes.length];

  return { flag, skinTier, skinName, heroName };
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
        maxHeight: "300px",
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
        {/* {name !== "???" && name !== "DRAFTING" && (
          <div className="absolute top-0.5 left-0.5 z-20 w-4.5 h-4.5 rounded-full overflow-hidden bg-slate-900 border border-white/20 flex items-center justify-center shadow-md text-[8.5px]">
            {cosmetics.flag}
          </div>
        )} */}

        {/* Skin Tier Banner (Top Center) */}
        {name !== "???" && name !== "DRAFTING" && (
          <SkinTierBadge tier={cosmetics.skinTier} />
        )}

        {/* Slot level indicator (Top Right) */}
        {/* <div className="absolute top-0.5 right-0.5 z-20 w-4.5 h-4.5 rounded-full bg-black/60 border border-white/20 flex items-center justify-center font-pixel text-[6px] text-slate-300 shadow-md">
          {isBlue ? "L12" : "S17"}
        </div> */}

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
          {/* {cosmetics.skinName && (
            <span className={`text-[6px] sm:text-[7px] font-pixel tracking-wider text-center block truncate leading-tight uppercase ${cosmetics.skinTier === "LEGEND" ? "text-red-400 glow-red" :
              cosmetics.skinTier === "EPIC" ? "text-purple-400 glow-purple" :
                cosmetics.skinTier === "LIMITED" ? "text-cyan-400 glow-blue" :
                  "text-emerald-400"
              }`}>
              {cosmetics.skinName}
            </span>
          )} */}

          {/* Hero Name (Medium font) */}
          {/* <span className="font-action text-[9px] sm:text-[10px] md:text-[11px] font-bold text-slate-300 text-center block truncate leading-none mt-0.5 tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
            {cosmetics.heroName}
          </span> */}

          {/* Player drafted Name (Large font, full-width focus) */}
          <span className="font-action text-sm sm:text-base md:text-lg lg:text-4xl font-black text-white text-center block truncate mt-0.5 tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {name}
          </span>

          {/* Player Role / Lane */}
          {role && (
            <span className="font-pixel text-sm sm:text-base italic text-amber-400 text-center block tracking-widest leading-none mt-1 uppercase drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
              {role}
            </span>
          )}

          {/* Loading Stats Bottom row (Stretched full-width) */}
          <div className="flex flex-col w-full mt-1.5 p-1 bg-black/60 rounded border border-white/5 shadow-inner">
            <div className="flex justify-between items-center w-full leading-none mb-1">
              <span className="font-mono text-[8px] sm:text-[9.5px] font-bold text-white pl-0.5 leading-none">
                {percentage}%
              </span>
              <span className="text-[6.5px] sm:text-[7.5px] text-slate-400 font-pixel uppercase tracking-tighter leading-none">
                LOADING
              </span>
            </div>
            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${isBlue
                  ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                  }`}
                style={{ width: `${percentage}%` }}
              />
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
          className={`font-pixel text-[7.5px] md:text-[8.5px] uppercase tracking-widest ${isBlue ? "text-cyan-400 glow-blue" : "text-rose-500 glow-red"
            }`}
        >
          {label}
        </span>
        <span
          className={`font-pixel text-[6.5px] px-1 py-0.2 border ${isBlue
            ? "border-cyan-500/20 text-cyan-400/60 bg-cyan-950/20"
            : "border-rose-500/20 text-rose-400/60 bg-rose-950/20"
            }`}
        >
          TEAM {side}
        </span>
      </div>

      {/* 5 slanted cards - staggered left (Blue) or right (Red) on large screens, centered on mobile */}
      <div className={`flex gap-1 md:gap-1.5 w-full max-w-5xl mx-auto ${isBlue
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
      className="flex flex-col justify-center gap-3 p-3 md:p-4 w-full relative overflow-hidden rounded-md transition-all duration-300 lg:aspect-[16/9] min-h-[380px] lg:min-h-[70vh]"
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
              className={`font-action font-black italic text-base tracking-tighter transition-all duration-150 ${isGenerating
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
