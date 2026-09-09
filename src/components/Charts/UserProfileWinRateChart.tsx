"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarElement,
  CategoryScale,
  LinearScale,
  BarController,
} from "chart.js";
import { DbPlayer, Match, MatchMode, Season } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

// Register Chart.js modules
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarElement,
  CategoryScale,
  LinearScale,
  BarController,
);

interface UserProfileWinRateChartProps {
  player: DbPlayer;
  allMatches: Match[];
  seasons: Season[];
  activeSeasonId: number;
  currentMode?: MatchMode;
}

export default function UserProfileWinRateChart({
  player,
  allMatches,
  seasons,
  activeSeasonId,
  currentMode = "TEAM_LANE",
}: UserProfileWinRateChartProps) {
  const doughnutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutChartRef = useRef<ChartJS | null>(null);

  const seasonalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seasonalChartRef = useRef<ChartJS | null>(null);

  const [viewMode, setViewMode] = useState<"dual" | "overall" | "seasonal">(
    "dual",
  );
  const [filterMode, setFilterMode] = useState<"current_mode" | "all_modes">(
    "current_mode",
  );
  const [selectedInspectSeason, setSelectedInspectSeason] = useState<
    number | null
  >(null);

  // Compute player's matches filtered by mode
  const relevantMatches = useMemo(() => {
    if (!player || allMatches.length === 0) return [];

    const playerId = player.id.toLowerCase();
    const playerName = player.name.toLowerCase();

    return allMatches.filter((m) => {
      // Must have resolved winner
      if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) {
        return false;
      }

      // Mode filter
      if (filterMode === "current_mode") {
        const mMode = m.mode || "TEAM_LANE";
        if (mMode !== currentMode) return false;
      }

      // Check player participation
      const isTeamA = m.teamA?.some(
        (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
      );
      const isTeamB = m.teamB?.some(
        (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
      );

      return isTeamA || isTeamB;
    });
  }, [player, allMatches, filterMode, currentMode]);

  // Overall lifetime stats across relevant matches
  const overallData = useMemo(() => {
    const playerId = player.id.toLowerCase();
    const playerName = player.name.toLowerCase();

    let wins = 0;
    let losses = 0;

    relevantMatches.forEach((m) => {
      const isTeamA = m.teamA?.some(
        (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
      );
      const isTeamB = m.teamB?.some(
        (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
      );

      const won =
        (m.winner === "teamA" && isTeamA) || (m.winner === "teamB" && isTeamB);

      if (won) wins++;
      else losses++;
    });

    const total = wins + losses;
    const winrate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;
    const ratio =
      losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? "MAX" : "0.00";

    return {
      wins,
      losses,
      total,
      winrate,
      ratio,
    };
  }, [player, relevantMatches]);

  // Seasonal breakdown data
  const seasonalData = useMemo(() => {
    const playerId = player.id.toLowerCase();
    const playerName = player.name.toLowerCase();

    // Collect all season IDs
    const seasonIdsSet = new Set<number>();
    seasonIdsSet.add(activeSeasonId || 1);
    seasons.forEach((s) => seasonIdsSet.add(s.id));
    relevantMatches.forEach((m) => {
      if (m.seasonId !== undefined) seasonIdsSet.add(Number(m.seasonId));
    });

    const sortedSeasonIds = Array.from(seasonIdsSet).sort((a, b) => a - b);

    return sortedSeasonIds.map((sId) => {
      const seasonMatches = relevantMatches.filter(
        (m) => (m.seasonId !== undefined ? Number(m.seasonId) : 1) === sId,
      );

      let wins = 0;
      let losses = 0;

      seasonMatches.forEach((m) => {
        const isTeamA = m.teamA?.some(
          (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
        );
        const isTeamB = m.teamB?.some(
          (p) => p.toLowerCase() === playerId || p.toLowerCase() === playerName,
        );

        const won =
          (m.winner === "teamA" && isTeamA) ||
          (m.winner === "teamB" && isTeamB);

        if (won) wins++;
        else losses++;
      });

      const total = wins + losses;
      const winrate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;

      const archiveSeason = seasons.find((s) => s.id === sId);
      const isCurrent = sId === activeSeasonId;
      const label = archiveSeason?.name
        ? archiveSeason.name.toUpperCase()
        : `SEASON ${sId}`;

      return {
        seasonId: sId,
        label: isCurrent ? `${label} (ACTIVE)` : label,
        shortLabel: `S${sId}`,
        wins,
        losses,
        total,
        winrate,
        isCurrent,
      };
    });
  }, [player, relevantMatches, activeSeasonId, seasons]);

  // Active inspect season data
  const inspectedSeasonData = useMemo(() => {
    if (selectedInspectSeason === null) {
      return (
        seasonalData.find((s) => s.seasonId === activeSeasonId) ||
        seasonalData[0] ||
        null
      );
    }
    return (
      seasonalData.find((s) => s.seasonId === selectedInspectSeason) || null
    );
  }, [selectedInspectSeason, seasonalData, activeSeasonId]);

  // Render Overall Doughnut Chart
  useEffect(() => {
    if (viewMode === "seasonal") return;
    if (!doughnutCanvasRef.current) return;

    if (doughnutChartRef.current) {
      doughnutChartRef.current.destroy();
      doughnutChartRef.current = null;
    }

    const ctx = doughnutCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const hasData = overallData.total > 0;
    const wins = hasData ? overallData.wins : 0;
    const losses = hasData ? overallData.losses : 1;

    doughnutChartRef.current = new ChartJS(ctx, {
      type: "doughnut",
      data: {
        labels: hasData ? ["VICTORIES", "DEFEATS"] : ["NO MATCHES"],
        datasets: [
          {
            data: hasData ? [wins, losses] : [0, 1],
            backgroundColor: hasData
              ? ["rgba(0, 210, 255, 0.85)", "rgba(255, 42, 95, 0.85)"]
              : ["rgba(51, 65, 85, 0.4)"],
            borderColor: hasData ? ["#00d2ff", "#ff2a5f"] : ["#334155"],
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        animation: {
          animateRotate: true,
          duration: 500,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: hasData,
            backgroundColor: "rgba(5, 5, 8, 0.95)",
            titleColor: "#ffd200",
            bodyColor: "#ffffff",
            borderColor: "#334155",
            borderWidth: 1.5,
            padding: 8,
            cornerRadius: 0,
            titleFont: { family: "monospace", size: 10, weight: "bold" },
            bodyFont: { family: "monospace", size: 9 },
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const val = context.raw as number;
                const pct =
                  overallData.total > 0
                    ? ((val / overallData.total) * 100).toFixed(1)
                    : "0";
                return ` ${label}: ${val} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (doughnutChartRef.current) {
        doughnutChartRef.current.destroy();
        doughnutChartRef.current = null;
      }
    };
  }, [overallData, viewMode]);

  // Render Seasonal Breakdown Bar Chart
  useEffect(() => {
    if (viewMode === "overall") return;
    if (!seasonalCanvasRef.current) return;

    if (seasonalChartRef.current) {
      seasonalChartRef.current.destroy();
      seasonalChartRef.current = null;
    }

    const ctx = seasonalCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = seasonalData.map((s) => s.shortLabel);
    const winrates = seasonalData.map((s) => s.winrate);

    const backgroundColors = seasonalData.map((s) => {
      if (s.total === 0) return "rgba(51, 65, 85, 0.4)";
      if (s.winrate >= 60) return "rgba(255, 210, 0, 0.85)";
      if (s.winrate >= 50) return "rgba(0, 210, 255, 0.85)";
      return "rgba(255, 42, 95, 0.85)";
    });

    const borderColors = seasonalData.map((s) => {
      if (s.total === 0) return "#334155";
      if (s.winrate >= 60) return "#ffd200";
      if (s.winrate >= 50) return "#00d2ff";
      return "#ff2a5f";
    });

    seasonalChartRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Win Rate %",
            data: winrates,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 0,
            barThickness: 28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: "easeOutQuart",
        },
        onClick: (_, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const chosen = seasonalData[idx];
            if (chosen) {
              playBeep(320, 0.08, "sine");
              setSelectedInspectSeason(chosen.seasonId);
            }
          }
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(5, 5, 8, 0.95)",
            titleColor: "#ffd200",
            bodyColor: "#ffffff",
            borderColor: "#334155",
            borderWidth: 1.5,
            padding: 9,
            cornerRadius: 0,
            titleFont: { family: "monospace", size: 10, weight: "bold" },
            bodyFont: { family: "monospace", size: 9 },
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return seasonalData[idx]?.label || "";
              },
              label: (context) => {
                const idx = context.dataIndex;
                const s = seasonalData[idx];
                return [
                  `WIN RATE: ${s.winrate}%`,
                  `MATCHES: ${s.total} (${s.wins}W - ${s.losses}L)`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: {
              color: "rgba(255, 255, 255, 0.07)",
            },
            ticks: {
              color: "#94a3b8",
              font: { family: "monospace", size: 8 },
              callback: (val) => `${val}%`,
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "#f1f5f9",
              font: { family: "monospace", size: 9, weight: "bold" },
            },
          },
        },
      },
    });

    return () => {
      if (seasonalChartRef.current) {
        seasonalChartRef.current.destroy();
        seasonalChartRef.current = null;
      }
    };
  }, [seasonalData, viewMode]);

  return (
    <div className={styles.chartCard}>
      {/* Rivets */}
      <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

      {/* Header & Controls */}
      <div className={styles.chartHeader}>
        <div className={styles.chartHeaderTitleGroup}>
          <h3 className={styles.chartTitle}>
            <span>📈</span> FIGHTER WIN RATE VISUALIZATIONS
          </h3>
          <p className={styles.chartSubtitle}>
            OVERALL LIFETIME AGGREGATION & SEASONAL BREAKDOWN ANALYSIS
          </p>
        </div>

        <div className={styles.chartControls}>
          {/* Mode Scope Filter */}
          <button
            type="button"
            onClick={() => {
              playBeep(260, 0.08, "sine");
              setFilterMode(
                filterMode === "current_mode" ? "all_modes" : "current_mode",
              );
            }}
            className={`${styles.toggleBtn} ${styles.toggleBtnActive}`}
            title="Toggle mode scope"
          >
            {filterMode === "current_mode"
              ? `MODE: ${currentMode}`
              : "MODE: ALL COMBINED"}
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 border border-slate-800 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => {
                playBeep(280, 0.08, "sine");
                setViewMode("dual");
              }}
              className={`${styles.toggleBtn} ${
                viewMode === "dual"
                  ? styles.toggleBtnActive
                  : styles.toggleBtnInactive
              }`}
            >
              DUAL VIEW
            </button>
            <button
              type="button"
              onClick={() => {
                playBeep(280, 0.08, "sine");
                setViewMode("overall");
              }}
              className={`${styles.toggleBtn} ${
                viewMode === "overall"
                  ? styles.toggleBtnActive
                  : styles.toggleBtnInactive
              }`}
            >
              OVERALL
            </button>
            <button
              type="button"
              onClick={() => {
                playBeep(280, 0.08, "sine");
                setViewMode("seasonal");
              }}
              className={`${styles.toggleBtn} ${
                viewMode === "seasonal"
                  ? styles.toggleBtnActive
                  : styles.toggleBtnInactive
              }`}
            >
              SEASONAL
            </button>
          </div>
        </div>
      </div>

      {/* Dual Grid Layout */}
      <div className={styles.profileDualGrid}>
        {/* Representation 1: Overall Lifetime Win Rate */}
        {(viewMode === "dual" || viewMode === "overall") && (
          <div
            className={`${styles.overallSection} ${
              viewMode === "overall" ? "!col-span-12" : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <span>🎯</span> OVERALL LIFETIME WIN RATE
              </span>
              <span className={styles.sectionBadge}>
                {overallData.total} MATCHES RECORDED
              </span>
            </div>

            <div className={styles.doughnutCanvasContainer}>
              <canvas ref={doughnutCanvasRef} />
              <div className={styles.centerDoughnutText}>
                <span className={styles.centerWinrateNumber}>
                  {overallData.winrate}%
                </span>
                <span className={styles.centerWinrateSub}>
                  {overallData.wins}W / {overallData.losses}L
                </span>
              </div>
            </div>

            <div className={styles.statRowCards}>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>VICTORIES</span>
                <span className={`${styles.miniStatValue} text-neon-blue`}>
                  {overallData.wins}
                </span>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>DEFEATS</span>
                <span className={`${styles.miniStatValue} text-neon-red`}>
                  {overallData.losses}
                </span>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>W/L RATIO</span>
                <span className={`${styles.miniStatValue} text-neon-yellow`}>
                  {overallData.ratio}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Representation 2: Seasonal Breakdown Chart */}
        {(viewMode === "dual" || viewMode === "seasonal") && (
          <div
            className={`${styles.seasonSection} ${
              viewMode === "seasonal" ? "!col-span-12" : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <span>📅</span> SEASONAL BREAKDOWN
              </span>
              <span className={styles.sectionBadge}>
                {seasonalData.length} SEASONS
              </span>
            </div>

            {/* Seasonal Bar Chart */}
            <div className="relative w-full h-[180px]">
              <canvas ref={seasonalCanvasRef} />
            </div>

            {/* Seasonal Inspector & Selector */}
            <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[7.5px] text-slate-400 uppercase tracking-widest">
                  SELECT SEASON TO INSPECT:
                </span>
                {inspectedSeasonData && (
                  <span className="font-pixel text-[8px] text-neon-yellow font-bold">
                    {inspectedSeasonData.label}
                  </span>
                )}
              </div>

              {/* Season Selection Pills */}
              <div className="flex flex-wrap gap-1.5">
                {seasonalData.map((s) => {
                  const isSelected =
                    inspectedSeasonData?.seasonId === s.seasonId;
                  return (
                    <button
                      key={s.seasonId}
                      type="button"
                      onClick={() => {
                        playBeep(320, 0.08, "sine");
                        setSelectedInspectSeason(s.seasonId);
                      }}
                      className={`font-pixel text-[7.5px] px-2.5 py-1 transition-all uppercase cursor-pointer border ${
                        isSelected
                          ? "bg-neon-yellow text-black border-white font-bold glow-yellow"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {s.shortLabel} ({s.winrate}%)
                    </button>
                  );
                })}
              </div>

              {/* Inspected Season Metrics Summary */}
              {inspectedSeasonData && (
                <div className="bg-black/50 border border-slate-800/90 p-2.5 grid grid-cols-4 gap-2 mt-1">
                  <div className="flex flex-col">
                    <span className={styles.miniStatLabel}>MATCHES</span>
                    <span className="font-action text-lg text-white leading-none">
                      {inspectedSeasonData.total}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={styles.miniStatLabel}>RECORD</span>
                    <span className="font-mono text-xs text-slate-300 font-bold leading-none mt-1">
                      <span className="text-neon-blue">
                        {inspectedSeasonData.wins}W
                      </span>{" "}
                      /{" "}
                      <span className="text-neon-red">
                        {inspectedSeasonData.losses}L
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={styles.miniStatLabel}>WIN RATE</span>
                    <span className="font-action text-lg text-neon-yellow leading-none">
                      {inspectedSeasonData.winrate}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={styles.miniStatLabel}>STATUS</span>
                    <span className="font-pixel text-[7px] text-slate-400 uppercase leading-none mt-1 truncate">
                      {inspectedSeasonData.isCurrent ? "ACTIVE" : "ARCHIVED"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
