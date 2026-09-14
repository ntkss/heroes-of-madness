"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
} from "chart.js";
import { Match, MatchMode, DbPlayer, Season } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";
import { computeComparativeSeasonProgression } from "@/utils/progression";
import StockMarketLineChart from "./StockMarketLineChart";
import styles from "./styles.module.css";

// Register necessary Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
);

interface ConsolidatedWinRateChartProps {
  matches: Match[];
  availablePlayers: DbPlayer[];
  seasons?: Season[];
  activeSeasonId?: number;
  activeMode?: MatchMode;
  onModeChange?: (mode: MatchMode) => void;
}

export default function ConsolidatedWinRateChart({
  matches,
  availablePlayers,
  seasons = [],
  activeSeasonId = 1,
  activeMode,
  onModeChange,
}: ConsolidatedWinRateChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);

  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [userSelectedMode, setUserSelectedMode] = useState<
    MatchMode | "ALL" | null
  >(null);
  const selectedMode: MatchMode | "ALL" =
    userSelectedMode !== null
      ? userSelectedMode
      : ((activeMode || "ALL") as MatchMode | "ALL");
  const [minMatchesOnly, setMinMatchesOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"winrate" | "matches">("winrate");

  // Stock Market Mode & Selection States
  const [viewMode, setViewMode] = useState<"stock_timeline" | "ranking_bars">(
    "stock_timeline",
  );
  const [metricType, setMetricType] = useState<"winrate" | "performance_index">(
    "winrate",
  );
  const [customFighterIds, setCustomFighterIds] = useState<string[] | null>(
    null,
  );
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // Season options list
  const seasonOptions = useMemo(() => {
    const seasonIds = new Set<number>();
    seasonIds.add(activeSeasonId);

    seasons.forEach((s) => seasonIds.add(s.id));
    matches.forEach((m) => {
      if (m.seasonId !== undefined) {
        seasonIds.add(Number(m.seasonId));
      }
    });

    const sorted = Array.from(seasonIds).sort((a, b) => b - a);

    return [
      { value: "all", label: "🌐 ALL-TIME (OVERALL)" },
      ...sorted.map((id) => {
        const isCurrent = id === activeSeasonId;
        const archive = seasons.find((s) => s.id === id);
        const name = archive?.name
          ? archive.name.toUpperCase()
          : `SEASON ${id}`;
        return {
          value: String(id),
          label: isCurrent ? `🏆 ${name} (CURRENT)` : `📜 ${name}`,
        };
      }),
    ];
  }, [seasons, activeSeasonId, matches]);

  // Dynamically compute player stats according to active filters
  const computedPlayerStats = useMemo(() => {
    // 1. Filter matches by season and mode
    const filteredMatches = matches.filter((m) => {
      // Must have resolved winner
      if (!m.winner || (m.winner !== "teamA" && m.winner !== "teamB")) {
        return false;
      }

      // Season filter
      if (selectedSeason !== "all") {
        const mSeason = m.seasonId !== undefined ? Number(m.seasonId) : 1;
        if (mSeason !== Number(selectedSeason)) {
          return false;
        }
      }

      // Mode filter
      if (selectedMode !== "ALL") {
        const mMode = m.mode || "TEAM_LANE";
        if (mMode !== selectedMode) {
          return false;
        }
      }

      return true;
    });

    // Helper to resolve player identity
    const getCanonicalPlayer = (idOrName: string) => {
      const target = idOrName.toLowerCase().trim();
      const found = availablePlayers.find(
        (p) => p.id.toLowerCase() === target || p.name.toLowerCase() === target,
      );
      if (found) {
        return {
          id: found.id,
          name: found.name,
          avatar: found.avatar || found.imageURL,
        };
      }
      return {
        id: target,
        name: idOrName,
        avatar: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${target}&backgroundColor=1a1a2e`,
      };
    };

    const statsMap: Record<
      string,
      {
        id: string;
        name: string;
        avatar?: string;
        wins: number;
        losses: number;
        matches: number;
        winrate: number;
      }
    > = {};

    // Pre-populate with all known available registered players
    availablePlayers.forEach((p) => {
      const key = p.id.toLowerCase();
      statsMap[key] = {
        id: p.id,
        name: p.name,
        avatar: p.avatar || p.imageURL,
        wins: 0,
        losses: 0,
        matches: 0,
        winrate: 0,
      };
    });

    // Tally match logs
    filteredMatches.forEach((m) => {
      const teamAPlayers = m.teamA || [];
      const teamBPlayers = m.teamB || [];

      const winningTeam = m.winner === "teamA" ? teamAPlayers : teamBPlayers;
      const losingTeam = m.winner === "teamA" ? teamBPlayers : teamAPlayers;

      winningTeam.forEach((p) => {
        const canonical = getCanonicalPlayer(p);
        const key = canonical.id.toLowerCase();
        if (!statsMap[key]) {
          statsMap[key] = {
            id: canonical.id,
            name: canonical.name,
            avatar: canonical.avatar,
            wins: 0,
            losses: 0,
            matches: 0,
            winrate: 0,
          };
        }
        statsMap[key].wins += 1;
        statsMap[key].matches += 1;
      });

      losingTeam.forEach((p) => {
        const canonical = getCanonicalPlayer(p);
        const key = canonical.id.toLowerCase();
        if (!statsMap[key]) {
          statsMap[key] = {
            id: canonical.id,
            name: canonical.name,
            avatar: canonical.avatar,
            wins: 0,
            losses: 0,
            matches: 0,
            winrate: 0,
          };
        }
        statsMap[key].losses += 1;
        statsMap[key].matches += 1;
      });
    });

    // Compute winrates dynamically: (wins / matches) * 100
    const list = Object.values(statsMap).map((stat) => {
      const winrate =
        stat.matches > 0
          ? Number(((stat.wins / stat.matches) * 100).toFixed(1))
          : 0;
      return {
        ...stat,
        winrate,
      };
    });

    // Filter out 0 matches if toggle is on or if unregistered with 0 matches
    const filteredList = list.filter((item) => {
      if (minMatchesOnly) {
        return item.matches >= 3;
      }
      return item.matches > 0;
    });

    // Sort by chosen criteria
    filteredList.sort((a, b) => {
      if (sortBy === "winrate") {
        if (b.winrate !== a.winrate) {
          return b.winrate - a.winrate;
        }
        return b.matches - a.matches;
      }
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return b.winrate - a.winrate;
    });

    return {
      totalMatchesCount: filteredMatches.length,
      fighters: filteredList,
    };
  }, [
    matches,
    availablePlayers,
    selectedSeason,
    selectedMode,
    minMatchesOnly,
    sortBy,
  ]);

  // Overall analytics metrics
  const metrics = useMemo(() => {
    const list = computedPlayerStats.fighters;
    if (list.length === 0) {
      return {
        leader: null,
        averageWinrate: 0,
        mostActive: null,
        totalParticipants: 0,
      };
    }

    const leader = list.reduce((best, cur) =>
      cur.winrate > best.winrate ? cur : best,
    );

    const mostActive = list.reduce((active, cur) =>
      cur.matches > active.matches ? cur : active,
    );

    const totalWinrates = list.reduce((sum, cur) => sum + cur.winrate, 0);
    const averageWinrate = Number((totalWinrates / list.length).toFixed(1));

    return {
      leader,
      averageWinrate,
      mostActive,
      totalParticipants: list.length,
    };
  }, [computedPlayerStats]);

  // Progressive Stock-Market comparative series
  const comparativeProgression = useMemo(() => {
    return computeComparativeSeasonProgression(matches, availablePlayers, {
      seasonId: selectedSeason === "all" ? "all" : Number(selectedSeason),
      mode: selectedMode,
      minMatches: minMatchesOnly ? 3 : 1,
    });
  }, [matches, availablePlayers, selectedSeason, selectedMode, minMatchesOnly]);

  // Derive effective active fighter IDs (default top 6 if user hasn't customized)
  const activeFighterIds = useMemo(() => {
    if (customFighterIds !== null) return customFighterIds;
    return comparativeProgression.series.slice(0, 6).map((s) => s.playerId);
  }, [customFighterIds, comparativeProgression.series]);

  const visibleSeries = useMemo(() => {
    return comparativeProgression.series.filter((s) =>
      activeFighterIds.includes(s.playerId),
    );
  }, [comparativeProgression.series, activeFighterIds]);

  const toggleFighterVisibility = (fId: string) => {
    playBeep(320, 0.06, "sine");
    setCustomFighterIds((prev) => {
      const current =
        prev ??
        comparativeProgression.series.slice(0, 6).map((s) => s.playerId);
      return current.includes(fId)
        ? current.filter((id) => id !== fId)
        : [...current, fId];
    });
  };

  const handleSpotlightFighter = (fId: string) => {
    playBeep(440, 0.08, "triangle");
    setSpotlightId((prev) => (prev === fId ? null : fId));
    // Ensure the spotlighted fighter is visible
    if (!activeFighterIds.includes(fId)) {
      setCustomFighterIds((prev) => {
        const current =
          prev ??
          comparativeProgression.series.slice(0, 6).map((s) => s.playerId);
        return [...current, fId];
      });
    }
  };

  // Render & Update Chart.js Bar instance
  useEffect(() => {
    if (viewMode !== "ranking_bars") {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const fighters = computedPlayerStats.fighters;
    if (fighters.length === 0) return;

    const labels = fighters.map((f) => f.name.toUpperCase());
    const winrates = fighters.map((f) => f.winrate);

    // Color palette based on winrate threshold
    const backgroundColors = fighters.map((f) => {
      if (f.winrate >= 60) return "rgba(255, 210, 0, 0.85)"; // Neon Yellow
      if (f.winrate >= 50) return "rgba(0, 210, 255, 0.85)"; // Neon Cyan
      return "rgba(255, 42, 95, 0.85)"; // Neon Pink/Rose
    });

    const borderColors = fighters.map((f) => {
      if (f.winrate >= 60) return "#ffd200";
      if (f.winrate >= 50) return "#00d2ff";
      return "#ff2a5f";
    });

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartInstanceRef.current = new ChartJS(ctx, {
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
            barThickness: Math.min(
              26,
              Math.max(14, Math.floor(400 / fighters.length)),
            ),
          },
        ],
      },
      options: {
        indexAxis: "y", // Horizontal bar chart for readable names
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: "easeOutQuart",
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
            padding: 10,
            cornerRadius: 0,
            titleFont: {
              family: "monospace",
              size: 11,
              weight: "bold",
            },
            bodyFont: {
              family: "monospace",
              size: 10,
            },
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const fighter = fighters[idx];
                return [
                  `WIN RATE: ${fighter.winrate}%`,
                  `TOTAL MATCHES: ${fighter.matches}`,
                  `RECORD: ${fighter.wins}W / ${fighter.losses}L`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: {
              color: "rgba(255, 255, 255, 0.07)",
            },
            ticks: {
              color: "#94a3b8",
              font: {
                family: "monospace",
                size: 9,
              },
              callback: (val) => `${val}%`,
            },
            title: {
              display: true,
              text: "WIN RATE PERCENTAGE (%)",
              color: "#64748b",
              font: {
                family: "monospace",
                size: 8,
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#f1f5f9",
              font: {
                family: "monospace",
                size: 9,
                weight: "bold",
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [computedPlayerStats, viewMode]);

  const dynamicCanvasHeight = Math.max(
    320,
    computedPlayerStats.fighters.length * 36 + 60,
  );

  return (
    <div className={styles.chartCard}>
      {/* Corner Rivets */}
      <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

      {/* Sub-Tab View Mode Switcher Navigation */}
      <div className={styles.subTabNav}>
        <button
          type="button"
          onClick={() => {
            playBeep(440, 0.08, "triangle");
            setViewMode("stock_timeline");
          }}
          className={`${styles.subTabButton} ${
            viewMode === "stock_timeline"
              ? styles.subTabButtonActive
              : styles.subTabButtonInactive
          }`}
        >
          📈 STOCK MARKET TIMELINE (COMPARATIVE)
        </button>
        <button
          type="button"
          onClick={() => {
            playBeep(380, 0.08, "triangle");
            setViewMode("ranking_bars");
          }}
          className={`${styles.subTabButton} ${
            viewMode === "ranking_bars"
              ? styles.subTabButtonActive
              : styles.subTabButtonInactive
          }`}
        >
          📊 FIGHTER RANKING BARS
        </button>
        <Link
          href="/graphs"
          onClick={() => playBeep(520, 0.1, "sine")}
          className="ml-auto font-pixel text-[8px] text-neon-blue hover:text-white border border-neon-blue/60 hover:border-neon-blue bg-neon-blue/10 px-2.5 py-1.5 transition-all flex items-center gap-1 uppercase select-none"
        >
          <span>🖥️ TRADING TERMINAL</span>
          <span>↗</span>
        </Link>
      </div>

      {/* Header & Filter Controls */}
      <div className={styles.chartHeader}>
        <div className={styles.chartHeaderTitleGroup}>
          <h3 className={styles.chartTitle}>
            <span>{viewMode === "stock_timeline" ? "📈" : "📊"}</span>
            {viewMode === "stock_timeline"
              ? "STOCK-MARKET PROGRESSION GRAPH"
              : "OVERALL WINRATE GRAPH (ALL FIGHTERS)"}
          </h3>
          <p className={styles.chartSubtitle}>
            {viewMode === "stock_timeline"
              ? "CHRONOLOGICAL CROSS-USER PERFORMANCE TRAJECTORY OVER MATCH TIMELINE"
              : "CONSOLIDATED CROSS-FIGHTER WIN RATE COMPARISON & BENCHMARKS"}
          </p>
        </div>

        <div className={styles.chartControls}>
          {/* Season Selector */}
          <select
            value={selectedSeason}
            onChange={(e) => {
              playBeep(300, 0.08, "sine");
              setSelectedSeason(e.target.value);
            }}
            className={styles.filterSelect}
            title="Filter by Season"
          >
            {seasonOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Mode Selector */}
          <select
            value={selectedMode}
            onChange={(e) => {
              playBeep(300, 0.08, "sine");
              setUserSelectedMode(e.target.value as MatchMode | "ALL");
              if (onModeChange && e.target.value !== "ALL") {
                onModeChange(e.target.value as MatchMode);
              }
            }}
            className={styles.filterSelect}
            title="Filter by Game Mode"
          >
            <option value="ALL">🎮 ALL MODES</option>
            <option value="TEAM_LANE">⚔️ RANDOM TEAM</option>
            <option value="HERO_ROV">🔥 RANDOM HERO – ROV</option>
            <option value="HERO_MLBB">⚡ RANDOM HERO – MLBB</option>
          </select>

          {/* Metric Selector for Stock Timeline */}
          {viewMode === "stock_timeline" ? (
            <button
              type="button"
              onClick={() => {
                playBeep(320, 0.08, "sine");
                setMetricType(
                  metricType === "winrate" ? "performance_index" : "winrate",
                );
              }}
              className={`${styles.toggleBtn} ${styles.toggleBtnActive}`}
              title="Switch between Win Rate % and Performance Index Points"
            >
              {metricType === "winrate"
                ? "METRIC: WIN RATE %"
                : "METRIC: INDEX PTS"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playBeep(260, 0.08, "sine");
                setSortBy(sortBy === "winrate" ? "matches" : "winrate");
              }}
              className={`${styles.toggleBtn} ${styles.toggleBtnActive}`}
              title="Sort chart records"
            >
              {sortBy === "winrate" ? "SORT: WIN RATE ▾" : "SORT: MATCHES ▾"}
            </button>
          )}

          {/* Min Matches Toggle */}
          <button
            type="button"
            onClick={() => {
              playBeep(260, 0.08, "sine");
              setMinMatchesOnly(!minMatchesOnly);
            }}
            className={`${styles.toggleBtn} ${
              minMatchesOnly ? styles.toggleBtnActive : styles.toggleBtnInactive
            }`}
            title="Filter min 3 matches"
          >
            {minMatchesOnly ? "MIN 3+ MATCHES [ON]" : "ALL RECORDED"}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: STOCK MARKET TIMELINE */}
      {viewMode === "stock_timeline" && (
        <div className="flex flex-col">
          {/* Stock Ticker HUD Banner */}
          <div className={styles.stockTickerHUD}>
            <div className={styles.stockTickerLeft}>
              <div className="flex flex-col">
                <span className={styles.stockPriceLabel}>
                  MARKET EQUILIBRIUM
                </span>
                <span className={styles.stockPriceBig}>
                  {metrics.averageWinrate}%
                </span>
              </div>
              {comparativeProgression.topGainer && (
                <div className={styles.bullishBadge}>
                  <span>▲ TOP GAINER:</span>
                  <span>{comparativeProgression.topGainer.playerName}</span>
                  <span>
                    (+{comparativeProgression.topGainer.changePercent}%)
                  </span>
                </div>
              )}
            </div>

            <div className={styles.stockMetricsRow}>
              <div className={styles.tickerMetric}>
                <span className={styles.tickerMetricLabel}>PEAK LEADER</span>
                <span className="font-action text-base text-neon-yellow leading-none truncate max-w-[120px]">
                  {comparativeProgression.highestWinrate
                    ? `${comparativeProgression.highestWinrate.currentWinrate}%`
                    : "--"}
                </span>
                <span className="font-mono text-[8px] text-slate-400 truncate max-w-[100px]">
                  {comparativeProgression.highestWinrate
                    ? comparativeProgression.highestWinrate.playerName
                    : "NONE"}
                </span>
              </div>

              <div className={styles.tickerMetric}>
                <span className={styles.tickerMetricLabel}>HIGH VOLUME</span>
                <span className="font-action text-base text-neon-blue leading-none">
                  {comparativeProgression.highestVolume
                    ? `${comparativeProgression.highestVolume.totalMatches} TRADES`
                    : "--"}
                </span>
                <span className="font-mono text-[8px] text-slate-400 truncate max-w-[100px]">
                  {comparativeProgression.highestVolume
                    ? comparativeProgression.highestVolume.playerName
                    : "NONE"}
                </span>
              </div>

              <div className={styles.tickerMetric}>
                <span className={styles.tickerMetricLabel}>TOTAL MATCHES</span>
                <span className="font-action text-base text-white leading-none">
                  {comparativeProgression.totalSeasonMatches}
                </span>
                <span className="font-mono text-[8px] text-slate-400">
                  {comparativeProgression.series.length} FIGHTERS
                </span>
              </div>
            </div>
          </div>

          {/* Fighter Selection Multi-Chips */}
          {comparativeProgression.series.length > 0 && (
            <div className={styles.fighterChipsSection}>
              <div className={styles.fighterChipsHeader}>
                <span className={styles.fighterChipsTitle}>
                  <span>📊</span> SELECT FIGHTERS TO PLOT (
                  {visibleSeries.length}/{comparativeProgression.series.length}{" "}
                  ACTIVE)
                </span>
                <div className={styles.fighterChipsActions}>
                  <button
                    type="button"
                    onClick={() => {
                      playBeep(350, 0.05, "sine");
                      setCustomFighterIds(
                        comparativeProgression.series
                          .slice(0, 6)
                          .map((s) => s.playerId),
                      );
                    }}
                    className={styles.chipQuickActionBtn}
                  >
                    TOP 6
                  </button>
                  <span className="text-slate-600 text-[8px]">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      playBeep(350, 0.05, "sine");
                      setCustomFighterIds(
                        comparativeProgression.series.map((s) => s.playerId),
                      );
                    }}
                    className={styles.chipQuickActionBtn}
                  >
                    SELECT ALL
                  </button>
                  <span className="text-slate-600 text-[8px]">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      playBeep(300, 0.05, "sine");
                      setCustomFighterIds([]);
                      setSpotlightId(null);
                    }}
                    className={styles.chipQuickActionBtn}
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              <div className={styles.fighterChipsGrid}>
                {comparativeProgression.series.map((s) => {
                  const isChecked = activeFighterIds.includes(s.playerId);
                  const isSpotlight = spotlightId === s.playerId;

                  return (
                    <button
                      key={s.playerId}
                      type="button"
                      onClick={() => toggleFighterVisibility(s.playerId)}
                      onDoubleClick={() => handleSpotlightFighter(s.playerId)}
                      className={`${styles.fighterChip} ${
                        isChecked
                          ? styles.fighterChipActive
                          : styles.fighterChipInactive
                      }`}
                      style={{
                        borderColor: isChecked ? s.color : undefined,
                        boxShadow: isSpotlight
                          ? `0 0 10px ${s.color}`
                          : undefined,
                      }}
                      title="Click to toggle, double-click to spotlight line"
                    >
                      <span
                        className={styles.chipColorIndicator}
                        style={{ backgroundColor: s.color }}
                      />
                      <img
                        src={s.avatar}
                        alt={s.playerName}
                        className={styles.chipAvatar}
                      />
                      <span>{s.playerName}</span>
                      <span className="font-mono text-[7.5px] opacity-80">
                        {s.currentWinrate}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Market Canvas */}
          {visibleSeries.length === 0 ? (
            <div className={styles.emptyChart}>
              <span>⚠️ NO FIGHTERS SELECTED TO PLOT</span>
              <span className="text-[7.5px] text-slate-500">
                CLICK THE FIGHTER CHIPS ABOVE TO ADD PROGRESSIVE LINES
              </span>
            </div>
          ) : (
            <div className={styles.stockCanvasContainer}>
              <StockMarketLineChart
                seriesList={visibleSeries}
                spotlightId={spotlightId}
                metricType={metricType}
                height={380}
                showLegend={true}
              />
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: FIGHTER RANKING BARS */}
      {viewMode === "ranking_bars" && (
        <div className="flex flex-col">
          {/* Summary Stat Grid */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryBox}>
              <span className={styles.summaryLabel}>TOP WIN RATE</span>
              <span className="font-action text-2xl text-neon-yellow leading-none">
                {metrics.leader ? `${metrics.leader.winrate}%` : "--"}
              </span>
              <span className={styles.summarySubtext}>
                {metrics.leader ? metrics.leader.name : "NO RECORD"}
              </span>
            </div>

            <div className={styles.summaryBox}>
              <span className={styles.summaryLabel}>AVERAGE WIN RATE</span>
              <span className="font-action text-2xl text-neon-blue leading-none">
                {metrics.averageWinrate}%
              </span>
              <span className={styles.summarySubtext}>COMMUNITY BENCHMARK</span>
            </div>

            <div className={styles.summaryBox}>
              <span className={styles.summaryLabel}>MOST ACTIVE FIGHTER</span>
              <span className="font-action text-2xl text-white leading-none">
                {metrics.mostActive
                  ? `${metrics.mostActive.matches} BATTLES`
                  : "--"}
              </span>
              <span className={styles.summarySubtext}>
                {metrics.mostActive ? metrics.mostActive.name : "NO RECORD"}
              </span>
            </div>

            <div className={styles.summaryBox}>
              <span className={styles.summaryLabel}>FILTERED MATCHES</span>
              <span className="font-action text-2xl text-slate-200 leading-none">
                {computedPlayerStats.totalMatchesCount}
              </span>
              <span className={styles.summarySubtext}>
                {metrics.totalParticipants} FIGHTERS SHOWN
              </span>
            </div>
          </div>

          {/* Bar Chart Canvas Area */}
          {computedPlayerStats.fighters.length === 0 ? (
            <div className={styles.emptyChart}>
              <span>⚠️ NO COMBAT MATCHES FOUND FOR CHOSEN FILTERS</span>
              <span className="text-[7.5px] text-slate-600">
                TRY SELECTING ALL-TIME OR ALL MODES
              </span>
            </div>
          ) : (
            <div className={styles.canvasWrapper}>
              <div
                className="w-full relative"
                style={{ height: `${dynamicCanvasHeight}px` }}
              >
                <canvas ref={canvasRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Jump Links to Fighter Profiles */}
      {computedPlayerStats.fighters.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="font-pixel text-[7.5px] text-slate-500 uppercase tracking-widest mr-1">
            JUMP TO PROFILE:
          </span>
          {computedPlayerStats.fighters.slice(0, 10).map((f) => (
            <Link
              key={f.id}
              href={`/players/${encodeURIComponent(f.id)}`}
              onClick={() => playBeep(350, 0.08, "sine")}
              className="font-pixel text-[7.5px] bg-black/60 border border-slate-800 hover:border-neon-yellow hover:text-neon-yellow px-2 py-1 text-slate-300 transition-colors uppercase flex items-center gap-1.5"
            >
              <span>{f.name}</span>
              <span className="text-neon-yellow font-mono text-[8px]">
                {f.winrate}%
              </span>
            </Link>
          ))}
          {computedPlayerStats.fighters.length > 10 && (
            <span className="font-pixel text-[7.5px] text-slate-600">
              +{computedPlayerStats.fighters.length - 10} MORE
            </span>
          )}
        </div>
      )}
    </div>
  );
}
