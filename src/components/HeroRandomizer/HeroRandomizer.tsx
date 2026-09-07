"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GameType,
  HeroLane,
  HERO_LANES,
  HERO_POOLS,
  HeroRandomResult,
  getRandomHero,
  getHeroCount,
} from "@/constants/heroes";
import {
  playBeep,
  playCoin,
  playLockName,
  playExplosion,
  speakAnnounce,
} from "@/utils/audio";
import styles from "./styles.module.css";

interface HeroRandomizerProps {
  game?: GameType;
  triggerScreenShake?: () => void;
  onSelectGame?: (game: GameType) => void;
}

export default function HeroRandomizer({
  game = "ROV",
  triggerScreenShake,
  onSelectGame,
}: HeroRandomizerProps) {
  const [activeGame, setActiveGame] = useState<GameType>(game);
  const [prevGame, setPrevGame] = useState<GameType>(game);
  const [selectedLaneFilter, setSelectedLaneFilter] = useState<
    HeroLane | "ANY"
  >("ANY");
  const [isRolling, setIsRolling] = useState(false);
  const [displayResult, setDisplayResult] = useState<HeroRandomResult | null>(
    null,
  );
  const [displayLane, setDisplayLane] = useState<HeroLane>("Mid");
  const [displayHero, setDisplayHero] = useState<string>("READY?");
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [showPoolDrawer, setShowPoolDrawer] = useState(false);
  const [history, setHistory] = useState<
    (HeroRandomResult & { timestamp: number })[]
  >([]);
  const [copied, setCopied] = useState(false);

  // Sync state during render when game prop changes
  if (game !== prevGame) {
    setPrevGame(game);
    setActiveGame(game);
    setDisplayResult(null);
    setIsLockedIn(false);
    setDisplayHero("READY?");
  }

  const rollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSwitchGame = (game: GameType) => {
    if (isRolling) return;
    playBeep(330, 0.08, "triangle");
    setActiveGame(game);
    setDisplayResult(null);
    setIsLockedIn(false);
    setDisplayHero("READY?");
    if (onSelectGame) {
      onSelectGame(game);
    }
  };

  const handleRoll = useCallback(() => {
    if (isRolling) return;

    setIsRolling(true);
    setIsLockedIn(false);
    playCoin();

    // 1. Determine final target result
    const targetOverrideLane =
      selectedLaneFilter === "ANY" ? undefined : selectedLaneFilter;
    const finalResult = getRandomHero(activeGame, targetOverrideLane);

    // Roll animation sequence:
    // Phase 1: Fast random flicking through lanes and heroes
    // Phase 2: Lock lane, then flick heroes within that lane
    // Phase 3: Lock hero with explosion sound and screen shake
    let tickCount = 0;
    const totalTicks = 24;
    const pool = HERO_POOLS[activeGame];

    const interval = setInterval(() => {
      tickCount++;

      // Rapid audio ticks
      playBeep(300 + tickCount * 25, 0.04, "sawtooth", 0.06);

      if (tickCount < 14) {
        // Phase 1: Lane & hero both cycling
        const tempLane =
          selectedLaneFilter === "ANY"
            ? HERO_LANES[Math.floor(Math.random() * HERO_LANES.length)]
            : selectedLaneFilter;
        const tempHeroes = pool[tempLane];
        const tempHero =
          tempHeroes[Math.floor(Math.random() * tempHeroes.length)];

        setDisplayLane(tempLane);
        setDisplayHero(tempHero);
      } else if (tickCount < totalTicks) {
        // Phase 2: Lane locked to final, heroes in final lane cycling
        setDisplayLane(finalResult.lane);
        const targetHeroes = pool[finalResult.lane];
        const tempHero =
          targetHeroes[Math.floor(Math.random() * targetHeroes.length)];
        setDisplayHero(tempHero);
      } else {
        // Phase 3: Final lock-in
        clearInterval(interval);
        setDisplayLane(finalResult.lane);
        setDisplayHero(finalResult.hero);
        setDisplayResult(finalResult);
        setIsRolling(false);
        setIsLockedIn(true);

        // Sound effects
        playLockName();
        setTimeout(() => {
          playExplosion();
          speakAnnounce(`${finalResult.lane}. ${finalResult.hero}!`);
        }, 120);

        if (triggerScreenShake) {
          triggerScreenShake();
        }

        // Add to recent history
        setHistory((prev) => [
          {
            ...finalResult,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 9),
        ]);
      }
    }, 70);

    rollTimerRef.current = interval as unknown as NodeJS.Timeout;
  }, [activeGame, isRolling, selectedLaneFilter, triggerScreenShake]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (rollTimerRef.current) {
        clearInterval(rollTimerRef.current);
      }
    };
  }, []);

  const handleCopyResult = () => {
    if (!displayResult) return;
    const text = `Game: ${displayResult.game} | Lane: ${displayResult.lane} | Hero: ${displayResult.hero}`;
    navigator.clipboard.writeText(text);
    playBeep(880, 0.1, "sine");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLaneBadgeClass = (lane: HeroLane) => {
    switch (lane) {
      case "Support":
        return styles.laneBadgeTankSupport;
      case "Top":
        return styles.laneBadgeFighter;
      case "Jungle":
        return styles.laneBadgeAssassin;
      case "Mid":
        return styles.laneBadgeMage;
      case "ADC":
        return styles.laneBadgeMarksman;
      default:
        return "";
    }
  };

  const getLaneIcon = (lane: HeroLane) => {
    switch (lane) {
      case "Support":
        return "🛡️";
      case "Top":
        return "⚔️";
      case "Jungle":
        return "🗡️";
      case "Mid":
        return "🔮";
      case "ADC":
        return "🏹";
      default:
        return "⚡";
    }
  };

  return (
    <div className={styles.container}>
      {/* Decorative metal rivets/screws */}
      <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

      {/* Screen Title & Game Selection Tabs */}
      <div className={styles.header}>
        <div className="flex items-center gap-3">
          <h2 className={styles.title}>🎲 RANDOM HERO GENERATOR</h2>
          <span className="text-[9px] font-pixel text-slate-500 hidden sm:inline">
            • {getHeroCount(activeGame)} HEROES POOLED
          </span>
        </div>

        {/* 2 Game Options: Random Hero – ROV / Random Hero – MLBB */}
        <div className={styles.gameTabs}>
          <button
            type="button"
            onClick={() => handleSwitchGame("ROV")}
            disabled={isRolling}
            className={`${styles.tabBtn} ${
              activeGame === "ROV"
                ? styles.tabBtnActiveROV
                : styles.tabBtnInactiveROV
            }`}
            title="Switch to Random Hero – ROV"
          >
            🔥 RANDOM HERO – ROV
          </button>
          <button
            type="button"
            onClick={() => handleSwitchGame("MLBB")}
            disabled={isRolling}
            className={`${styles.tabBtn} ${
              activeGame === "MLBB"
                ? styles.tabBtnActiveMLBB
                : styles.tabBtnInactiveMLBB
            }`}
            title="Switch to Random Hero – MLBB"
          >
            ⚡ RANDOM HERO – MLBB
          </button>
        </div>
      </div>

      {/* Main Split Layout: Display Screen on Left, Controls on Right */}
      <div className={styles.mainLayout}>
        {/* Left Side: Arcade Visual Screen */}
        <div className={styles.displayScreen}>
          <div className={styles.screenScanline} />

          <div className={styles.screenHeader}>
            <span>ARCADE CABIN SELECTOR // {activeGame}</span>
            <div className={styles.statusIndicator}>
              <span
                className={`${styles.statusDot} ${
                  isRolling ? styles.statusDotRolling : styles.statusDotIdle
                }`}
              />
              <span>{isRolling ? "RANDOMIZING..." : "SYSTEM READY"}</span>
            </div>
          </div>

          {/* Result Showcase */}
          <div className={styles.resultContainer}>
            {/* Badges for Game & Lane */}
            <div className={styles.resultBadgeGroup}>
              {/* Game Badge */}
              <div
                className={`${styles.gameBadge} ${
                  activeGame === "ROV"
                    ? styles.gameBadgeROV
                    : styles.gameBadgeMLBB
                }`}
              >
                GAME: {activeGame}
              </div>

              {/* Lane Badge */}
              <div
                className={`${styles.laneBadge} ${getLaneBadgeClass(
                  displayResult ? displayResult.lane : displayLane,
                )}`}
              >
                <span>
                  {getLaneIcon(
                    displayResult ? displayResult.lane : displayLane,
                  )}
                </span>
                <span>
                  LANE: {displayResult ? displayResult.lane : displayLane}
                </span>
              </div>
            </div>

            {/* Central Hero Name Showcase */}
            <div
              className={`${styles.heroShowcase} ${
                isLockedIn ? styles.heroShowcaseLockin : ""
              }`}
            >
              <span className={styles.heroShowcaseLabel}>
                {isRolling
                  ? "ROLLING HERO POOL..."
                  : isLockedIn
                    ? "SELECTED HERO"
                    : "PRESS ROLL TO RANDOMIZE"}
              </span>
              <div
                className={`${styles.heroName} ${
                  isLockedIn
                    ? styles.heroNameGlowing
                    : isRolling
                      ? styles.heroNameRolling
                      : ""
                }`}
              >
                {displayHero}
              </div>
            </div>

            {/* Result actions */}
            {displayResult && !isRolling && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="font-pixel text-[8px] px-3 py-1 bg-slate-900 border border-slate-700 hover:border-neon-yellow text-slate-300 hover:text-neon-yellow transition-all uppercase cursor-pointer flex items-center gap-1.5"
                >
                  <span>{copied ? "✓ COPIED" : "📋 COPY RESULT"}</span>
                </button>
                <span className="text-[8px] font-pixel text-slate-500">
                  {displayResult.game} • {displayResult.lane} •{" "}
                  {displayResult.hero}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Roll Action, Lane Filters & History */}
        <div className={styles.controlsCol}>
          {/* Main Action Roll Button */}
          <button
            type="button"
            onClick={handleRoll}
            disabled={isRolling}
            className={`${styles.rollBtn} ${
              isRolling ? styles.rollBtnRolling : styles.rollBtnReady
            }`}
          >
            {isRolling ? "DRAFTING HERO..." : `ROLL HERO (${activeGame})`}
          </button>

          {/* Lane Filter Selector */}
          <div className={styles.laneFilterBox}>
            <div className={styles.boxTitle}>
              <span>LANE SELECTION MODE</span>
              <span className="text-[7.5px] text-slate-500">
                {selectedLaneFilter === "ANY" ? "RANDOM LANE" : "FIXED LANE"}
              </span>
            </div>
            <div className={styles.laneButtons}>
              <button
                type="button"
                onClick={() => {
                  playBeep(440, 0.05, "sine");
                  setSelectedLaneFilter("ANY");
                }}
                disabled={isRolling}
                className={`${styles.laneSelectBtn} ${
                  selectedLaneFilter === "ANY"
                    ? styles.laneSelectBtnActive
                    : styles.laneSelectBtnInactive
                }`}
              >
                <span>🎲 ALL 5 LANES (RANDOM FIRST)</span>
                {selectedLaneFilter === "ANY" && <span>✓</span>}
              </button>
              {HERO_LANES.map((lane) => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => {
                    playBeep(440, 0.05, "sine");
                    setSelectedLaneFilter(lane);
                  }}
                  disabled={isRolling}
                  className={`${styles.laneSelectBtn} ${
                    selectedLaneFilter === lane
                      ? styles.laneSelectBtnActive
                      : styles.laneSelectBtnInactive
                  }`}
                >
                  <span>
                    {getLaneIcon(lane)} {lane}
                  </span>
                  <span className="text-[7.5px] text-slate-500">
                    ({HERO_POOLS[activeGame][lane].length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Roll History */}
          {history.length > 0 && (
            <div className={styles.historyBox}>
              <div className={styles.boxTitle}>
                <span>RECENT ROLLS</span>
                <span className="text-[7.5px] text-slate-500">
                  {history.length} ROLLS
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {history.map((item, idx) => (
                  <div key={idx} className={styles.historyItem}>
                    <span className="text-slate-400">
                      [{item.game}] {item.hero}
                    </span>
                    <span className="text-[7.5px] text-slate-500">
                      {item.lane}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Hero Pool Directory */}
      <div className={styles.poolDrawer}>
        <button
          type="button"
          onClick={() => {
            playBeep(440, 0.05, "triangle");
            setShowPoolDrawer(!showPoolDrawer);
          }}
          className={styles.poolToggleBtn}
        >
          <span>{showPoolDrawer ? "▼" : "▶"}</span>
          <span>
            {showPoolDrawer ? "HIDE" : "BROWSE"} {activeGame} HERO POOL BY 5
            LANES ({getHeroCount(activeGame)} HEROES)
          </span>
        </button>

        {showPoolDrawer && (
          <div className={styles.poolGrid}>
            {HERO_LANES.map((lane) => {
              const heroes = HERO_POOLS[activeGame][lane];
              return (
                <div key={lane} className={styles.lanePoolCol}>
                  <div className={styles.lanePoolTitle}>
                    <span>{getLaneIcon(lane)}</span>
                    <span className="ml-1 text-slate-200">{lane}</span>
                    <span className="ml-auto text-slate-500 text-[7px]">
                      ({heroes.length})
                    </span>
                  </div>
                  <div className={styles.heroTagList}>
                    {heroes.map((hero) => (
                      <span key={hero} className={styles.heroTag}>
                        {hero}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
