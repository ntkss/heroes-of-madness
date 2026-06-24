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
import PlayerCard from "@/components/PlayerCard";
import styles from "./styles.module.css";

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

  const getPlayer = (idOrName: string) =>
    squad.find(
      (p) =>
        p.id === idOrName.toLowerCase() ||
        p.name.toLowerCase() === idOrName.toLowerCase(),
    );

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
    <div className={styles.teamRow}>
      {/* Team lane role markers */}
      <div
        className={`${styles.teamRowHeader} ${
          isBlue ? styles.teamRowHeaderBlue : styles.teamRowHeaderRed
        }`}
      >
        <span
          className={`${styles.teamLabel} ${
            isBlue ? styles.teamLabelBlue : styles.teamLabelRed
          }`}
        >
          {label}
        </span>
        <span
          className={`${styles.teamBadge} ${
            isBlue ? styles.teamBadgeBlue : styles.teamBadgeRed
          }`}
        >
          TEAM {side}
        </span>
      </div>

      {/* 5 slanted cards - staggered left (Blue) or right (Red) on large screens, centered on mobile */}
      <div
        className={`${styles.cardsRow} ${
          isBlue ? styles.cardsRowBlue : styles.cardsRowRed
        }`}
      >
        {finalNames.map((name, idx) => {
          const player = getPlayer(name);
          const rankClass = getPlayerRankClass(player);
          return (
            <PlayerCard
              key={idx}
              name={name}
              displayName={player ? player.name : displayNames[idx]}
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

      const rollPool =
        teamA.length || teamB.length
          ? [...teamA, ...teamB].map((idOrName) => {
              const p = squad.find(
                (x) =>
                  x.id === idOrName.toLowerCase() ||
                  x.name.toLowerCase() === idOrName.toLowerCase(),
              );
              return p ? p.name : idOrName;
            })
          : SQUAD_NAMES;

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
  }, [isGenerating, teamA, teamB, triggerScreenShake, squad]);

  return (
    <div className={styles.arenaBackground}>
      {/* Dynamic ambient color nodes */}
      <div className={styles.ambientBlue} />
      <div className={styles.ambientRed} />
      <div className={styles.ambientYellow} />

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

      {/* VS Banner Separator */}
      <div className={styles.vsContainer}>
        {/* VS emblem and dividing lines */}
        <div className={styles.vsWrapper}>
          <div className={styles.vsLineBlue} />
          <div className={styles.vsCircle}>
            <span
              className={`${styles.vsText} ${
                isGenerating ? styles.vsTextGenerating : styles.vsTextNormal
              }`}
            >
              VS
            </span>
          </div>
          <div className={styles.vsLineRed} />
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

      {/* Loading screen tips at the bottom */}
      <div className={styles.tipsText}>{currentTip}</div>
    </div>
  );
}
