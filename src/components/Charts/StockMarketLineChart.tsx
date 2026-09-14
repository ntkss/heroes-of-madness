"use client";

import React, { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  TooltipItem,
} from "chart.js";
import { PlayerProgressionSeries } from "@/utils/progression";

// Register Chart.js Line chart modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
);

interface StockMarketLineChartProps {
  seriesList: PlayerProgressionSeries[];
  spotlightId?: string | null;
  metricType?: "winrate" | "performance_index";
  height?: number;
  showLegend?: boolean;
  baseline?: number; // default 50 for winrate, 1000 for index
}

export default function StockMarketLineChart({
  seriesList,
  spotlightId,
  metricType = "winrate",
  height = 380,
  showLegend = false,
  baseline = 50,
}: StockMarketLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (!seriesList || seriesList.length === 0) return;

    // Find the maximum number of matches across all visible series to build uniform X labels
    const maxMatches = Math.max(...seriesList.map((s) => s.points.length), 0);

    if (maxMatches === 0) return;

    // Build X axis labels: "M1", "M2", ... or "MATCH #1"
    const labels: string[] = [];
    for (let i = 1; i <= maxMatches; i++) {
      labels.push(`M${i}`);
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Build datasets – explicitly typed so both function and scalar pointRadius work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = seriesList.map((series) => {
      const isSpotlighted = !spotlightId || series.playerId === spotlightId;
      const opacity = spotlightId && !isSpotlighted ? 0.2 : 1;
      const color = series.color || "#00ff88";

      // Area gradient fill
      let backgroundColor: CanvasGradient | string = "transparent";
      if (seriesList.length === 1 || series.playerId === spotlightId) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, hexToRgba(color, 0.28 * opacity));
        gradient.addColorStop(0.5, hexToRgba(color, 0.08 * opacity));
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        backgroundColor = gradient;
      }

      const data = labels.map((_, idx) => {
        const pt = series.points[idx];
        if (!pt) return null;
        return metricType === "winrate"
          ? pt.progressiveWinrate
          : pt.performanceIndex;
      });

      return {
        label: series.playerName,
        data,
        borderColor: hexToRgba(color, opacity),
        backgroundColor,
        fill: seriesList.length === 1 || series.playerId === spotlightId,
        borderWidth: isSpotlighted ? (seriesList.length === 1 ? 3 : 2.5) : 1,
        tension: 0.25, // Smooth stock chart curve
        spanGaps: false,
        pointRadius: (ctxItem: { dataIndex: number }) => {
          if (!isSpotlighted) return 0;
          if (seriesList.length === 1) {
            // Highlight the latest point
            return ctxItem.dataIndex === series.points.length - 1 ? 6 : 3;
          }
          return 0; // Clean line for multi-series, show point on hover
        },
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: "#050508",
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        pointHoverBackgroundColor: "#ffffff",
      };
    });

    // Add baseline benchmark dataset (50% for winrate or 1000 for index)
    const baselineData = labels.map(() => baseline);
    datasets.push({
      label: metricType === "winrate" ? "50% PARITY BASELINE" : "1000 BASELINE",
      data: baselineData,
      borderColor: "rgba(148, 163, 184, 0.35)",
      backgroundColor: "transparent",
      fill: false,
      borderWidth: 1,
      tension: 0,
      spanGaps: true,
      pointRadius: 0,
      pointHoverRadius: 0,
      borderDash: [5, 5],
    });

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
          easing: "easeOutQuart",
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: showLegend,
            position: "top",
            labels: {
              color: "#94a3b8",
              font: {
                family: "monospace",
                size: 9,
              },
              boxWidth: 12,
              padding: 10,
              filter: (item) => !item.text.includes("BASELINE"),
            },
          },
          tooltip: {
            enabled: true,
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
              title: (tooltipItems) => {
                if (tooltipItems.length === 0) return "";
                const idx = tooltipItems[0].dataIndex;
                return `TRADE / MATCH #${idx + 1}`;
              },
              label: (context: TooltipItem<"line">) => {
                if (context.dataset.label?.includes("BASELINE")) return "";
                const seriesIndex = context.datasetIndex;
                const targetSeries = seriesList[seriesIndex];
                if (!targetSeries) return "";

                const matchIdx = context.dataIndex;
                const point = targetSeries.points[matchIdx];
                if (!point) return "";

                const val = context.raw as number;
                const formattedVal =
                  metricType === "winrate"
                    ? `${val.toFixed(1)}%`
                    : `${val} PTS`;

                const resultSymbol =
                  point.result === "WIN" ? "🟢 [WIN]" : "🔴 [LOSS]";
                const record = `${point.cumulativeWins}W - ${point.cumulativeLosses}L`;

                return ` ${targetSeries.playerName}: ${formattedVal} | ${resultSymbol} (${record})`;
              },
              afterBody: (tooltipItems) => {
                if (seriesList.length === 1 && tooltipItems.length > 0) {
                  const matchIdx = tooltipItems[0].dataIndex;
                  const point = seriesList[0].points[matchIdx];
                  if (point) {
                    const lines = [
                      `TIMESTAMP: ${point.dateStr}`,
                      `MODE: ${point.mode.replace("_", " ")}`,
                    ];
                    if (point.hero) lines.push(`HERO: ${point.hero}`);
                    if (point.lane) lines.push(`LANE: ${point.lane}`);
                    return lines;
                  }
                }
                return [];
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#64748b",
              font: {
                family: "monospace",
                size: 9,
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 16,
            },
            title: {
              display: true,
              text: "PROGRESSIVE MATCH TIMELINE (#)",
              color: "#64748b",
              font: {
                family: "monospace",
                size: 8,
              },
            },
          },
          y: {
            min: metricType === "winrate" ? 0 : undefined,
            max: metricType === "winrate" ? 100 : undefined,
            grid: {
              color: "rgba(255, 255, 255, 0.07)",
            },
            ticks: {
              color: "#94a3b8",
              font: {
                family: "monospace",
                size: 9,
              },
              callback: (val) =>
                metricType === "winrate" ? `${val}%` : `${val}`,
            },
            title: {
              display: true,
              text:
                metricType === "winrate"
                  ? "CUMULATIVE WIN RATE (%)"
                  : "PERFORMANCE INDEX (PTS)",
              color: "#64748b",
              font: {
                family: "monospace",
                size: 8,
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
  }, [seriesList, spotlightId, metricType, height, showLegend, baseline]);

  return (
    <div className="w-full relative" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
