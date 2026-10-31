"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  playLockName,
  playExplosion,
  speakAnnounce,
  playBeep,
} from "@/utils/audio";
import { SQUAD_NAMES } from "@/constants/players";
import {
  DbPlayer,
  RankConfig,
  Match,
  MatchMode,
  Season,
} from "@/utils/firebase";
import {
  calculateTeamWinRates,
  PlayerOverallStats,
  isUnderdogMatch,
  getUnderdogTeam,
} from "@/utils/winrate";
import { useBadgeConfig, BadgeConfig } from "@/utils/badgeConfig";
import PlayerCard from "@/components/PlayerCard";
import styles from "./styles.module.css";

const ROLES = ["Exp", "Jungle", "Mid", "Gold", "Roam"];

interface VersesArenaProps {
  teamA: string[];
  teamB: string[];
  teamALanes?: string[];
  teamBLanes?: string[];
  teamAHeroes?: string[];
  teamBHeroes?: string[];
  winner: "teamA" | "teamB" | null;
  isGenerating: boolean;
  triggerScreenShake: () => void;
  squad: DbPlayer[];
  rankConfig: RankConfig;
  matches?: Match[];
  seasons?: Season[];
  mode?: MatchMode;
}

// ─── Team Row ──────────────────────────────────────────────────────────────────
interface TeamRowProps {
  label: string;
  side: "A" | "B";
  finalNames: string[];
  displayNames: string[];
  lanes?: string[];
  heroes?: string[];
  locked: boolean[];
  lockedOffset: number;
  winner: "teamA" | "teamB" | null;
  squad: DbPlayer[];
  percentages: number[];
  rankConfig: RankConfig;
  teamWinRate: number;
  isFavored: boolean;
  laneStats: PlayerOverallStats[];
  showShine: boolean;
  playerChampionMap: Record<string, number[]>;
  isUnderdogTeam?: boolean;
  badgeConfig?: BadgeConfig;
}

function findSquadPlayer(
  idOrNameOrAlias: string,
  squadList: DbPlayer[],
): DbPlayer | undefined {
  if (!idOrNameOrAlias) return undefined;
  const key = idOrNameOrAlias.toLowerCase().trim();
  return squadList.find(
    (p) =>
      (p.alias && p.alias.toLowerCase() === key) ||
      p.id.toLowerCase() === key ||
      p.id === idOrNameOrAlias.trim() ||
      p.name.toLowerCase() === key,
  );
}

function TeamRow({
  label,
  side,
  finalNames,
  displayNames,
  lanes,
  heroes,
  locked,
  lockedOffset,
  winner,
  squad,
  percentages,
  rankConfig,
  teamWinRate,
  isFavored,
  laneStats,
  showShine,
  playerChampionMap,
  isUnderdogTeam,
  badgeConfig,
}: TeamRowProps) {
  const isBlue = side === "A";
  const isWinner = winner === (isBlue ? "teamA" : "teamB");
  const isLoser = winner !== null && !isWinner;

  const getPlayer = (idOrName: string) => findSquadPlayer(idOrName, squad);

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

  const getPlayerChampionSeasons = (nameOrId: string, player?: DbPlayer) => {
    const key = nameOrId.toLowerCase();
    const seasonsFromKey = playerChampionMap[key] || [];
    const seasonsFromAlias = player?.alias
      ? playerChampionMap[player.alias.toLowerCase()] || []
      : [];
    const seasonsFromId = player
      ? playerChampionMap[player.id.toLowerCase()] || []
      : [];
    const seasonsFromName = player
      ? playerChampionMap[player.name.toLowerCase()] || []
      : [];

    const combined = Array.from(
      new Set([
        ...seasonsFromKey,
        ...seasonsFromAlias,
        ...seasonsFromId,
        ...seasonsFromName,
      ]),
    ).sort((a, b) => a - b);

    return combined;
  };

  return (
    <div className={styles.teamRow}>
      {/* Team lane role markers */}
      <div
        className={`${styles.teamRowHeader} ${
          isBlue ? styles.teamRowHeaderBlue : styles.teamRowHeaderRed
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`${styles.teamLabel} ${
              isBlue ? styles.teamLabelBlue : styles.teamLabelRed
            }`}
          >
            {label}
          </span>

          {isUnderdogTeam && (
            <span className={styles.underdogTeamBadge}>
              {badgeConfig?.underdogMatch.icon || "🔥"}{" "}
              {badgeConfig?.underdogMatch.name || "สู้ยิบตา"} (UNDERDOG)
            </span>
          )}
          <span
            className={`${styles.teamBadge} ${
              isBlue ? styles.teamBadgeBlue : styles.teamBadgeRed
            }`}
          >
            TEAM {side}
          </span>
        </div>

        {/* Win Rate Percentage & Higher Win Rate Indicator */}
        <div className="flex items-center gap-1.5">
          {isFavored && (
            <span className={styles.favoredBadge}>🔥 HIGHER WIN RATE</span>
          )}
          <span
            className={`${styles.teamWinrateBadge} ${
              isBlue ? styles.teamWinrateBadgeBlue : styles.teamWinrateBadgeRed
            }`}
          >
            EST. WIN RATE: {teamWinRate}%
          </span>
        </div>
      </div>

      {/* 5 slanted cards wrapped in relative container to position the side winrate overlay */}
      <div className="relative w-full">
        {/* Big Winrate Display (Desktop only) */}
        <div
          className={`${styles.bigWinrateContainer} ${
            isBlue ? styles.bigWinrateLeft : styles.bigWinrateRight
          } ${isBlue ? styles.bigWinrateBlue : styles.bigWinrateRed}`}
        >
          <span className={styles.bigWinrateLabel}>EST. WINRATE</span>
          <span
            className={`${styles.bigWinrateValue} ${
              isBlue ? styles.bigWinrateValueBlue : styles.bigWinrateValueRed
            } ${
              showShine
                ? isBlue
                  ? styles.shiningNumberBlue
                  : styles.shiningNumberRed
                : ""
            }`}
          >
            {teamWinRate}%
          </span>
          {isFavored && (
            <span
              className={`${styles.bigWinrateFavored} ${
                isBlue
                  ? styles.bigWinrateFavoredBlue
                  : styles.bigWinrateFavoredRed
              }`}
            >
              FAVORED
            </span>
          )}
        </div>

        <div
          className={`${styles.cardsRow} ${
            isBlue ? styles.cardsRowBlue : styles.cardsRowRed
          }`}
        >
          {finalNames.map((name, idx) => {
            const player = getPlayer(name);
            const rankClass = getPlayerRankClass(player);
            const champSeasons = getPlayerChampionSeasons(name, player);
            const playerAlias =
              player?.alias ||
              (name !== "???" && name !== "DRAFTING" ? name : undefined);
            const playerDisplayName = player ? player.name : displayNames[idx];
            return (
              <PlayerCard
                key={idx}
                name={name}
                alias={playerAlias}
                displayName={playerDisplayName}
                role={lanes?.[idx] || ROLES[idx]}
                hero={heroes?.[idx]}
                locked={locked[idx + lockedOffset]}
                team={side}
                imageURL={player?.imageURL}
                isWinner={isWinner}
                isLoser={isLoser}
                percentage={percentages[idx + lockedOffset]}
                currentRank={player?.current_rank}
                rankClass={rankClass}
                laneWinRate={laneStats?.[idx]?.laneWinRate}
                championSeasons={champSeasons}
                underdogMvpCount={player?.underdogMvpCount}
                underdogComebackCount={player?.underdogComebackCount}
                badgeConfig={badgeConfig}
              />
            );
          })}
        </div>
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
  teamALanes,
  teamBLanes,
  teamAHeroes,
  teamBHeroes,
  winner,
  isGenerating,
  triggerScreenShake,
  squad,
  rankConfig,
  matches,
  seasons,
  mode,
}: VersesArenaProps) {
  const [dispA, setDispA] = useState<string[]>(Array(5).fill("???"));
  const [dispB, setDispB] = useState<string[]>(Array(5).fill("???"));
  const [lockedSlots, setLockedSlots] = useState<boolean[]>(
    Array(10).fill(true),
  );
  const badgeConfig = useBadgeConfig();

  // Compute map of player -> list of season IDs won (e.g. { "nutty": [1], "bas": [2] })
  const playerChampionMap = useMemo(() => {
    const map: Record<string, number[]> = {};

    if (seasons && seasons.length > 0) {
      seasons.forEach((season) => {
        let champStat = season.podium?.[0];
        if (!champStat && season.fighterStats?.length) {
          const sorted = [...season.fighterStats].sort(
            (a, b) => (b.winrate || 0) - (a.winrate || 0),
          );
          champStat = sorted[0];
        }
        if (champStat && champStat.name) {
          const nameKey = champStat.name.toLowerCase();
          if (!map[nameKey]) map[nameKey] = [];
          if (!map[nameKey].includes(season.id)) map[nameKey].push(season.id);

          if (champStat.id) {
            const idKey = champStat.id.toLowerCase();
            if (!map[idKey]) map[idKey] = [];
            if (!map[idKey].includes(season.id)) map[idKey].push(season.id);
          }
        }
      });
    }

    // Fallback mock champion seasons mapping if DB has no archived seasons yet
    // Expanded for easy localhost visual testing of champion shimmer effects
    if (Object.keys(map).length === 0) {
      map["nutty"] = [1, 3]; // Multi-season champion (2x) — prismatic glow
      map["bas"] = [2];
      map["jajou"] = [3];
      map["jimmy"] = [1];
      map["moonshadow"] = [2];
      map["beer"] = [1];
    }

    return map;
  }, [seasons]);

  // Loading percentage state (climbing from 5% to 100%)
  const [percentages, setPercentages] = useState<number[]>(Array(10).fill(100));

  const [currentTip, setCurrentTip] = useState(TIPS[0]);

  // Animated team win rates states
  const [animatedWinRateA, setAnimatedWinRateA] = useState(50);
  const [animatedWinRateB, setAnimatedWinRateB] = useState(50);
  const [showShine, setShowShine] = useState(false);

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

  const winRateSummary = useMemo(() => {
    if (!teamA.length || !teamB.length) {
      return {
        teamAWinRate: 50,
        teamBWinRate: 50,
        teamALaneStats: [],
        teamBLaneStats: [],
        favoredTeam: "tie" as const,
      };
    }
    return calculateTeamWinRates(teamA, teamB, matches || [], squad, mode);
  }, [teamA, teamB, matches, squad, mode]);

  const isUnderdog =
    !isGenerating &&
    isUnderdogMatch(winRateSummary.teamAWinRate, winRateSummary.teamBWinRate);
  const underdogSide = isUnderdog
    ? getUnderdogTeam(winRateSummary.teamAWinRate, winRateSummary.teamBWinRate)
    : null;

  // Synchronize or reset animation win rates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isGenerating) {
        setAnimatedWinRateA(winRateSummary.teamAWinRate);
        setAnimatedWinRateB(winRateSummary.teamBWinRate);
        setShowShine(true);
      } else {
        setAnimatedWinRateA(0);
        setAnimatedWinRateB(0);
        setShowShine(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isGenerating, winRateSummary.teamAWinRate, winRateSummary.teamBWinRate]);

  // Count up animation utilizing requestAnimationFrame for buttery 60fps
  const animateWinrates = useCallback(() => {
    const targetA = winRateSummary.teamAWinRate;
    const targetB = winRateSummary.teamBWinRate;
    const duration = 1200; // 1.2 seconds count up duration
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // Ease out quad

      setAnimatedWinRateA(Math.round(easeProgress * targetA));
      setAnimatedWinRateB(Math.round(easeProgress * targetB));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setShowShine(true);
        playBeep(880, 0.35, "sine");
      }
    };

    requestAnimationFrame(step);
  }, [winRateSummary.teamAWinRate, winRateSummary.teamBWinRate]);

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

      const rollPool =
        teamA.length || teamB.length
          ? [...teamA, ...teamB].map((idOrName) => {
              const p = findSquadPlayer(idOrName, squad);
              return p ? p.name : idOrName;
            })
          : SQUAD_NAMES;

      let currentLockedIndex = -1;

      // Single batched interval for rolling names (drastically reduces mobile CPU churn from 200 renders/s to ~13/s)
      const rollInterval = setInterval(() => {
        const pickRand = () =>
          rollPool[Math.floor(Math.random() * rollPool.length)];
        setDispA((prev) => {
          const next = [...prev];
          for (let s = currentLockedIndex + 1; s < 5; s++) {
            next[s] = pickRand();
          }
          return next;
        });
        setDispB((prev) => {
          const next = [...prev];
          for (let s = currentLockedIndex + 1; s < 5; s++) {
            next[s] = pickRand();
          }
          return next;
        });
      }, 80);
      intervalsRef.current.push(rollInterval);

      for (let i = 0; i < 5; i++) {
        const delay = 400 + i * 450;

        const timerId = setTimeout(() => {
          currentLockedIndex = i;

          setDispA((prev) => {
            const next = [...prev];
            const p = findSquadPlayer(teamA[i] || "", squad);
            next[i] = p ? p.name : teamA[i] || "BOT";
            return next;
          });
          setDispB((prev) => {
            const next = [...prev];
            const p = findSquadPlayer(teamB[i] || "", squad);
            next[i] = p ? p.name : teamB[i] || "BOT";
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
            clearInterval(rollInterval);
            triggerScreenShake();
            playExplosion();
            if (pctIntervalRef.current) {
              clearInterval(pctIntervalRef.current);
              pctIntervalRef.current = null;
            }
            animateWinrates();
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
        const resolvedTeamA = teamA.map((idOrName) => {
          const p = findSquadPlayer(idOrName, squad);
          return p ? p.name : idOrName;
        });
        const resolvedTeamB = teamB.map((idOrName) => {
          const p = findSquadPlayer(idOrName, squad);
          return p ? p.name : idOrName;
        });
        setDispA(
          resolvedTeamA.length ? resolvedTeamA : Array(5).fill("DRAFTING"),
        );
        setDispB(
          resolvedTeamB.length ? resolvedTeamB : Array(5).fill("DRAFTING"),
        );
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
  }, [isGenerating, teamA, teamB, triggerScreenShake, squad, animateWinrates]);

  return (
    <div className={styles.arenaBackground}>
      {/* Dynamic ambient color nodes */}
      <div className={styles.ambientBlue} />
      <div className={styles.ambientRed} />
      <div className={styles.ambientYellow} />

      {/* Dramatic 45-degree Z-Axis Underdog Background Overlay */}
      {isUnderdog && (
        <div className={styles.underdogWatermarkOverlay} aria-hidden="true">
          <div className={styles.underdogWatermarkBand}>
            <div className={styles.underdogHazardStrip}>
              <span>
                ⚡ HIGH RISK • HIGH BOUNTY • UNDERDOG REBELLION • COMEBACK OR
                DIE ⚡
              </span>
            </div>
            <div className={styles.underdogWatermarkTitle}>
              🔥 UNDERDOG BATTLE 🔥
            </div>
            <div className={styles.underdogHazardStrip}>
              <span>
                ⚡ HIGH RISK • HIGH BOUNTY • UNDERDOG REBELLION • COMEBACK OR
                DIE ⚡
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Team A (Top Row) */}
      <TeamRow
        label="BLUE"
        side="A"
        finalNames={teamA.length >= 5 ? teamA : Array(5).fill("DRAFTING")}
        displayNames={dispA}
        lanes={teamALanes}
        heroes={teamAHeroes}
        locked={lockedSlots}
        lockedOffset={0}
        winner={winner}
        squad={squad}
        percentages={percentages}
        rankConfig={rankConfig}
        teamWinRate={animatedWinRateA}
        isFavored={winRateSummary.favoredTeam === "teamA"}
        laneStats={winRateSummary.teamALaneStats}
        showShine={showShine}
        playerChampionMap={playerChampionMap}
        isUnderdogTeam={underdogSide === "teamA"}
        badgeConfig={badgeConfig}
      />

      {/* VS Banner & Win Rate Prediction Section */}
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
        label="RED"
        side="B"
        finalNames={teamB.length >= 5 ? teamB : Array(5).fill("DRAFTING")}
        displayNames={dispB}
        lanes={teamBLanes}
        heroes={teamBHeroes}
        locked={lockedSlots}
        lockedOffset={5}
        winner={winner}
        squad={squad}
        percentages={percentages}
        rankConfig={rankConfig}
        teamWinRate={animatedWinRateB}
        isFavored={winRateSummary.favoredTeam === "teamB"}
        laneStats={winRateSummary.teamBLaneStats}
        showShine={showShine}
        playerChampionMap={playerChampionMap}
        isUnderdogTeam={underdogSide === "teamB"}
        badgeConfig={badgeConfig}
      />

      {/* Loading screen tips at the bottom */}
      <div className={styles.tipsText}>{currentTip}</div>
    </div>
  );
}
