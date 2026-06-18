"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  playLockName,
  playExplosion,
  speakAnnounce,
  playBeep,
} from "@/utils/audio";
import { SQUAD_NAMES } from "@/constants/players";
import { DbPlayer, RankConfig } from "@/utils/firebase";
import PlayerCard from "./PlayerCard";

const ROLES = ["EXP", "JUNGLE", "MID", "GOLD", "ROAMING"];

interface VersesArenaProps {
  teamA: string[];
  teamB: string[];
  winner: "teamA" | "teamB" | null;
  isGenerating: boolean;
  triggerScreenShake: () => void;
  squad: DbPlayer[];
  rankConfig: RankConfig;
}

// ─── Team Row ──────────────────────────────────────────────────────────────────
interface TeamRowProps {
  label: string;
  side: "A" | "B";
  finalNames: string[];
  displayNames: string[];
  locked: boolean[];
  lockedOffset: number;
  winner: "teamA" | "teamB" | null;
  squad: DbPlayer[];
  percentages: number[];
  rankConfig: RankConfig;
}

function TeamRow({
  label,
  side,
  finalNames,
  displayNames,
  locked,
  lockedOffset,
  winner,
  squad,
  percentages,
  rankConfig,
}: TeamRowProps) {
  const isBlue = side === "A";
  const isWinner = winner === (isBlue ? "teamA" : "teamB");
  const isLoser = winner !== null && !isWinner;

  const getPlayer = (name: string) =>
    squad.find((p) => p.name.toLowerCase() === name.toLowerCase());

  const getPlayerRankClass = (player: DbPlayer | undefined) => {
    if (!player || !rankConfig) return null;
    if (player.current_rank === rankConfig.tiers.high) return "high";
    if (player.current_rank === rankConfig.tiers.normal) return "normal";
    if (player.current_rank === rankConfig.tiers.low) return "low";

    // Legacy string fallbacks
    if (player.current_rank.includes("Mythic")) return "high";
    if (player.current_rank === "Legend") return "normal";
    if (player.current_rank === "Epic") return "low";

    return "normal";
  };

  return (
    <div className="relative flex flex-col gap-1 w-full shrink-0">
      {/* Team lane role markers */}
      <div
        className={`flex items-center justify-between mb-0.5 px-1 max-w-5xl w-full mx-auto ${isBlue ? "lg:pl-[8%]" : "lg:pr-[8%]"}`}
      >
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
      <div
        className={`flex gap-1 md:gap-1.5 w-full max-w-5xl mx-auto ${
          isBlue
            ? "justify-center lg:justify-start lg:pl-[8%]"
            : "justify-center lg:justify-end lg:pr-[8%]"
        }`}
      >
        {finalNames.map((name, idx) => {
          const player = getPlayer(name);
          const rankClass = getPlayerRankClass(player);
          return (
            <PlayerCard
              key={idx}
              name={name}
              displayName={displayNames[idx]}
              role={ROLES[idx]}
              locked={locked[idx + lockedOffset]}
              team={side}
              imageURL={player?.imageURL}
              isWinner={isWinner}
              isLoser={isLoser}
              percentage={percentages[idx + lockedOffset]}
              currentRank={player?.current_rank}
              rankClass={rankClass}
            />
          );
        })}
      </div>
    </div>
  );
}

const TIPS = [
  "Tip: When your team is behind, try to only engage the enemy when you have the numbers advantage.",
  "Tip: Check the mini-map frequently to avoid being ambushed by enemy Junglers.",
  "Tip: Destroying enemy turrets is the key to victory, not just getting hero kills.",
  "Tip: The Lord can help you push lanes and break the enemy base. Secure it when possible.",
  "Tip: Keep an eye on the enemy's battle spells and cooldowns before starting a team fight.",
  "Tip: The Turtle provides valuable shield and gold buffs. Fight for it in the early game.",
  "Tip: Protect your gold laner and jungler so they can carry the team to victory.",
  "Tip: Communication is key. Use signals to coordinate with your teammates.",
];

// ─── VersesArena Main component ────────────────────────────────────────────────
export default function VersesArena({
  teamA,
  teamB,
  winner,
  isGenerating,
  triggerScreenShake,
  squad,
  rankConfig,
}: VersesArenaProps) {
  const [dispA, setDispA] = useState<string[]>(Array(5).fill("???"));
  const [dispB, setDispB] = useState<string[]>(Array(5).fill("???"));
  const [lockedSlots, setLockedSlots] = useState<boolean[]>(
    Array(10).fill(true),
  );

  // Loading percentage state (climbing from 5% to 100%)
  const [percentages, setPercentages] = useState<number[]>(Array(10).fill(100));

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
    if (isGenerating) {
      clearAllTimers();

      // Defer state updates to avoid synchronous setState inside effect warnings
      const initTimer = setTimeout(() => {
        setLockedSlots(Array(10).fill(false));
        const randomTip = TIPS[Math.floor(Math.random() * TIPS.length)];
        setCurrentTip(randomTip);

        const initialPcts = Array(10)
          .fill(0)
          .map(() => Math.floor(Math.random() * 15) + 5);
        setPercentages(initialPcts);
      }, 0);
      lockTimersRef.current.push(initTimer);

      playBeep(440, 0.2, "sawtooth");

      // Increment progress timers
      pctIntervalRef.current = setInterval(() => {
        setPercentages((prev) => {
          return prev.map((pct) => {
            if (pct >= 99) return pct;
            const step = Math.floor(Math.random() * 8) + 2; // Increments of 2% to 9%
            const next = pct + step;
            return next >= 99 ? 99 : next;
          });
        });
      }, 100);

      const activeDispA = Array(5).fill("???");
      const activeDispB = Array(5).fill("???");

      const rollPool = teamA.length || teamB.length ? [...teamA, ...teamB] : SQUAD_NAMES;

      const startRoll = (teamIndex: number, slotIndex: number) => {
        const intervalId = setInterval(
          () => {
            const randIndex = Math.floor(Math.random() * rollPool.length);
            const randomName = rollPool[randIndex];
            if (teamIndex === 0) {
              activeDispA[slotIndex] = randomName;
              setDispA([...activeDispA]);
            } else {
              activeDispB[slotIndex] = randomName;
              setDispB([...activeDispB]);
            }
          },
          50 + slotIndex * 10,
        );
        intervalsRef.current.push(intervalId);
      };

      for (let i = 0; i < 5; i++) {
        startRoll(0, i);
        startRoll(1, i);
      }

      for (let i = 0; i < 5; i++) {
        const delay = 400 + i * 450;

        const timerId = setTimeout(() => {
          clearInterval(intervalsRef.current[2 * i]);
          clearInterval(intervalsRef.current[2 * i + 1]);

          setDispA((prev) => {
            const next = [...prev];
            next[i] = teamA[i] || "BOT";
            return next;
          });
          setDispB((prev) => {
            const next = [...prev];
            next[i] = teamB[i] || "BOT";
            return next;
          });

          playLockName();

          setLockedSlots((prev) => {
            const next = [...prev];
            next[i] = true;
            next[i + 5] = true;
            return next;
          });

          // Set locked slots percentage immediately to 100%
          setPercentages((prev) => {
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
      // Defer state updates to avoid synchronous setState inside effect warnings
      const resetTimer = setTimeout(() => {
        setDispA(teamA.length ? teamA : Array(5).fill("DRAFTING"));
        setDispB(teamB.length ? teamB : Array(5).fill("DRAFTING"));
        setLockedSlots(Array(10).fill(true));
        setPercentages(Array(10).fill(100));
      }, 0);
      lockTimersRef.current.push(resetTimer);

      if (pctIntervalRef.current) {
        clearInterval(pctIntervalRef.current);
        pctIntervalRef.current = null;
      }
    }
    return clearAllTimers;
  }, [isGenerating, teamA, teamB, triggerScreenShake]);

  return (
    <div
      className="flex flex-col justify-center gap-3 p-3 md:p-4 w-full relative overflow-hidden rounded-md transition-all duration-300 lg:aspect-[16/9] min-h-[380px] lg:min-h-[70vh]"
      style={{
        background:
          "linear-gradient(180deg, #0f172a 0%, #090d16 50%, #030712 100%)",
        backgroundImage:
          "radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)",
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
        finalNames={teamA.length >= 5 ? teamA : Array(5).fill("DRAFTING")}
        displayNames={dispA}
        locked={lockedSlots}
        lockedOffset={0}
        winner={winner}
        squad={squad}
        percentages={percentages}
        rankConfig={rankConfig}
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
        finalNames={teamB.length >= 5 ? teamB : Array(5).fill("DRAFTING")}
        displayNames={dispB}
        locked={lockedSlots}
        lockedOffset={5}
        winner={winner}
        squad={squad}
        percentages={percentages}
        rankConfig={rankConfig}
      />
    </div>
  );
}
