"use client";

import React from "react";
import Image from "next/image";
import { Match, DbPlayer, RankConfig } from "@/utils/firebase";
import { playBeep, playWin } from "@/utils/audio";

interface HistoryDashboardProps {
  matches: Match[];
  onDeleteMatch: (id: string) => void;
  onUpdateWinner: (id: string, winner: "teamA" | "teamB") => void;
  availablePlayers: DbPlayer[];
  rankConfig: RankConfig;
}

export default function HistoryDashboard({
  matches,
  onDeleteMatch,
  onUpdateWinner,
  availablePlayers,
  rankConfig,
}: HistoryDashboardProps) {
  const [activeTab, setActiveTab] = React.useState<"history" | "stats">(
    "history",
  );

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleDelete = (id: string) => {
    playBeep(150, 0.15, "sawtooth");
    onDeleteMatch(id);
  };

  const handleWinnerChange = (id: string, winner: "teamA" | "teamB") => {
    playWin();
    onUpdateWinner(id, winner);
  };

  // Dynamically compute player statistics from player documents (single source of truth) and matches logs (for unregistered players)
  const playerStats = React.useMemo(() => {
    const statsMap: Record<
      string,
      { wins: number; losses: number; matches: number; dbPlayer?: DbPlayer }
    > = {};

    // 1. Initialize stats map with database stats for all available players
    availablePlayers.forEach((player) => {
      const dbMatches = Number(player.total_match_played) || 0;
      const dbWinrate = Number(player.winrate) || 0;
      const dbWins = Math.round((dbWinrate / 100) * dbMatches);
      const dbLosses = dbMatches - dbWins;

      statsMap[player.name.toLowerCase()] = {
        wins: dbWins,
        losses: dbLosses,
        matches: dbMatches,
        dbPlayer: player,
      };
    });

    // 2. Accumulate stats from matches log ONLY for unregistered players/bots (to avoid double-counting)
    matches.forEach((match) => {
      if (!match.winner) return;

      const teamAPlayers = match.teamA || [];
      const teamBPlayers = match.teamB || [];

      const winningTeam =
        match.winner === "teamA" ? teamAPlayers : teamBPlayers;
      const losingTeam = match.winner === "teamA" ? teamBPlayers : teamAPlayers;

      winningTeam.forEach((playerName) => {
        const key = playerName.toLowerCase();
        if (!statsMap[key]) {
          statsMap[key] = { wins: 0, losses: 0, matches: 0 };
        }
        if (!statsMap[key].dbPlayer) {
          statsMap[key].wins += 1;
          statsMap[key].matches += 1;
        }
      });

      losingTeam.forEach((playerName) => {
        const key = playerName.toLowerCase();
        if (!statsMap[key]) {
          statsMap[key] = { wins: 0, losses: 0, matches: 0 };
        }
        if (!statsMap[key].dbPlayer) {
          statsMap[key].losses += 1;
          statsMap[key].matches += 1;
        }
      });
    });

    const statsList = Object.entries(statsMap).map(([key, data]) => {
      const winrate = data.matches > 0 ? (data.wins / data.matches) * 100 : 0;
      const name = data.dbPlayer
        ? data.dbPlayer.name
        : key.charAt(0).toUpperCase() + key.slice(1);

      return {
        name,
        matches: data.matches,
        wins: data.wins,
        losses: data.losses,
        winrate,
        dbPlayer: data.dbPlayer,
      };
    });

    // Sort: highest win rate first, then most matches, then alphabetical
    return statsList.sort((a, b) => {
      if (b.winrate !== a.winrate) {
        return b.winrate - a.winrate;
      }
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return a.name.localeCompare(b.name);
    });
  }, [matches, availablePlayers]);

  const renderRankInfo = (dbPlayer: DbPlayer | undefined) => {
    if (!dbPlayer) return null;
    const rankName = dbPlayer.current_rank;
    let rankColorClass = "text-slate-400 font-bold";
    if (rankConfig) {
      if (rankName === rankConfig.tiers.high) {
        rankColorClass = "text-purple-400 font-bold";
      } else if (rankName === rankConfig.tiers.normal) {
        rankColorClass = "text-orange-400 font-bold";
      } else if (rankName === rankConfig.tiers.low) {
        rankColorClass = "text-green-400 font-bold";
      } else {
        // Fallback checks
        if (rankName.includes("Mythic"))
          rankColorClass = "text-purple-400 font-bold";
        else if (rankName === "Legend")
          rankColorClass = "text-orange-400 font-bold";
        else if (rankName === "Epic")
          rankColorClass = "text-green-400 font-bold";
      }
    }

    const isThai = /[\u0E00-\u0E7F]/.test(rankName);
    const fontClass = isThai
      ? "font-thai text-[10px] tracking-wide"
      : "font-pixel text-[6.5px] uppercase tracking-wider";

    return (
      <span className="text-[8.5px] text-slate-500 uppercase font-pixel tracking-tighter truncate mt-1.5 leading-none">
        {dbPlayer.alias} •{" "}
        <span className="text-neon-blue font-bold font-tech">
          {dbPlayer.role}
        </span>{" "}
        • <span className={`${rankColorClass} ${fontClass}`}>{rankName}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col bg-bg-cabinet border-4 border-slate-700/80 p-6 shadow-2xl relative overflow-hidden mt-8 transition-all duration-300">
      {/* Decorative metal rivets */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />

      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-slate-700 pb-3.5 mb-4">
        <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow">
          ARENA LOGBOOK
        </h2>
        <span className="font-pixel text-[10px] text-[#a0a0c0]">
          RECORDS: {matches.length}
        </span>
      </div>

      {/* Arcade Tab Selectors */}
      <div className="flex border-b-2 border-slate-800 mb-6 font-pixel text-[9px] gap-2">
        <button
          onClick={() => {
            playBeep(330, 0.1, "sawtooth");
            setActiveTab("history");
          }}
          className={`flex-1 py-3 border-b-4 text-center cursor-pointer transition-all duration-200 uppercase tracking-wider ${
            activeTab === "history"
              ? "border-neon-yellow text-neon-yellow bg-neon-yellow/5 glow-yellow font-bold"
              : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
          }`}
        >
          📜 MATCH LOGS
        </button>
        <button
          onClick={() => {
            playBeep(392, 0.1, "sawtooth");
            setActiveTab("stats");
          }}
          className={`flex-1 py-3 border-b-4 text-center cursor-pointer transition-all duration-200 uppercase tracking-wider ${
            activeTab === "stats"
              ? "border-neon-blue text-neon-blue bg-neon-blue/5 glow-blue font-bold"
              : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
          }`}
        >
          🏆 FIGHTER WINRATES
        </button>
      </div>

      {/* Tab Contents: MATCH HISTORY */}
      {activeTab === "history" &&
        (matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-800 bg-black/40">
            <span className="font-pixel text-[10px] text-neon-red uppercase tracking-widest mb-2 glow-red">
              NO RECORDS FOUND
            </span>
            <span className="font-pixel text-[8px] text-slate-500 uppercase">
              ARENA VACANT. START DRAFT TO INITIALIZE LOGS.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-black/60 border-2 border-slate-800 p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 hover:border-slate-500 transition-colors relative"
              >
                {/* Match Details */}
                <div className="flex flex-col flex-grow gap-2">
                  {/* Header labels */}
                  <div className="flex items-center justify-between md:justify-start gap-4">
                    <span className="font-pixel text-[8px] text-neon-yellow bg-neon-yellow/10 px-2 py-0.5 border border-neon-yellow/20">
                      MATCH LOG
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
                      {formatDate(match.createdAt)}
                    </span>
                  </div>

                  {/* Team roster names grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 border-t border-slate-800/60 pt-2.5">
                    {/* Blue */}
                    <div className="flex flex-col">
                      <span className="font-pixel text-[8px] text-neon-blue uppercase mb-1">
                        BLUE TEAM
                      </span>
                      <span className="text-xs text-slate-100 font-mono tracking-tight truncate">
                        {match.teamA.join(" • ") || "EMPTY"}
                      </span>
                    </div>
                    {/* Red */}
                    <div className="flex flex-col">
                      <span className="font-pixel text-[8px] text-neon-red uppercase mb-1">
                        RED TEAM
                      </span>
                      <span className="text-xs text-slate-100 font-mono tracking-tight truncate">
                        {match.teamB.join(" • ") || "EMPTY"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action column */}
                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-4 gap-3 min-w-[140px]">
                  {/* Winner tag */}
                  {match.winner ? (
                    <div className="flex flex-col items-center select-none">
                      <span className="font-pixel text-[8px] text-slate-500 uppercase mb-1">
                        WINNER
                      </span>
                      <span
                        className={`font-action text-2xl font-bold tracking-widest px-3 py-0.5 border-2 uppercase leading-none ${
                          match.winner === "teamA"
                            ? "border-neon-blue text-neon-blue glow-blue bg-neon-blue/10"
                            : "border-neon-red text-neon-red glow-red bg-neon-red/10"
                        }`}
                      >
                        {match.winner === "teamA" ? "BLUE TEAM" : "RED TEAM"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center w-full">
                      <span className="font-pixel text-[8px] text-neon-yellow uppercase mb-1.5 animate-pulse glow-yellow">
                        PENDING OUTCOME
                      </span>
                      <div className="flex gap-2 w-full font-pixel mt-1">
                        <button
                          onClick={() => handleWinnerChange(match.id, "teamA")}
                          className="flex-grow font-pixel text-[8px] text-cyan-400 bg-cyan-950/20 border border-cyan-500/30 py-1.5 px-2 hover:bg-cyan-400 hover:text-black transition-all duration-200 uppercase cursor-pointer flex items-center justify-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.15)] rounded-sm"
                        >
                          👑 BLUE WIN
                        </button>
                        <button
                          onClick={() => handleWinnerChange(match.id, "teamB")}
                          className="flex-grow font-pixel text-[8px] text-rose-500 bg-rose-950/20 border border-rose-500/30 py-1.5 px-2 hover:bg-rose-500 hover:text-white transition-all duration-200 uppercase cursor-pointer flex items-center justify-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.15)] rounded-sm"
                        >
                          👑 RED WIN
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(match.id)}
                    className="font-pixel text-[8px] text-slate-500 hover:text-neon-red border border-transparent hover:border-neon-red bg-transparent p-1.5 mt-0 md:mt-2 transition-all cursor-pointer uppercase flex items-center gap-1 select-none"
                    title="Purge record"
                  >
                    <svg
                      className="w-2.5 h-2.5 fill-current"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9m2 2h2v1h-2V5m-3 3h2v10H8V8m4 0h2v10h-2V8m4 0h2v10h-2V8z" />
                    </svg>
                    PURGE
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Tab Contents: FIGHTER WINRATES */}
      {activeTab === "stats" &&
        (playerStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-800 bg-black/40">
            <span className="font-pixel text-[10px] text-neon-red uppercase tracking-widest mb-2 glow-red">
              NO FIGHTER STATS
            </span>
            <span className="font-pixel text-[8px] text-slate-500 uppercase">
              CHOOSE WINNERS IN THE HISTORY LOG TO GENERATE LEADERBOARD DATA!
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-2">
            {/* Header row (Only on desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-slate-800 text-[9px] font-pixel text-slate-500 uppercase tracking-wider">
              <div className="col-span-2">RANK</div>
              <div className="col-span-4">FIGHTER NAME</div>
              <div className="col-span-2 text-center">MATCHES</div>
              <div className="col-span-2 text-center">RECORD (W-L)</div>
              <div className="col-span-2 text-right">WIN RATE</div>
            </div>

            {/* Leaderboard Cards */}
            {playerStats.map((stats, index) => {
              const rankLabel =
                index === 0
                  ? "1ST"
                  : index === 1
                    ? "2ND"
                    : index === 2
                      ? "3RD"
                      : `${index + 1}TH`;
              const rankColor =
                index === 0
                  ? "text-[#ffd200] glow-yellow border-[#ffd200]/40 bg-[#ffd200]/5"
                  : index === 1
                    ? "text-[#c0c0c0] border-[#c0c0c0]/40 bg-[#c0c0c0]/5"
                    : index === 2
                      ? "text-[#cd7f32] border-[#cd7f32]/40 bg-[#cd7f32]/5"
                      : "text-slate-400 border-slate-800 bg-slate-900/20";

              return (
                <div
                  key={stats.name}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center px-4 py-3 border-2 ${
                    index === 0
                      ? "border-[#ffd200]/30 hover:border-[#ffd200]/60 bg-[#ffd200]/5"
                      : "border-slate-800 hover:border-slate-700 bg-black/40"
                  } transition-all duration-200 relative`}
                >
                  {/* Rank Badge */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span
                      className={`font-pixel text-[9px] px-2 py-0.5 border ${rankColor} uppercase font-bold`}
                    >
                      {rankLabel}
                    </span>
                  </div>

                  {/* Fighter Name, Avatar, Alias, Role & Rank details */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 relative overflow-hidden rounded-sm border border-slate-700 shrink-0 bg-slate-900">
                      <Image
                        src={
                          stats.dbPlayer?.avatar ||
                          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${stats.name.toLowerCase()}&backgroundColor=1a1a2e`
                        }
                        alt={stats.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`
                          text-white truncate block leading-none
                          ${
                            /[\u0E00-\u0E7F]/.test(stats.name)
                              ? "font-thai text-lg md:text-xl font-bold mt-1"
                              : "font-action text-2xl md:text-3xl font-black tracking-wide"
                          }
                        `}
                      >
                        {stats.name}
                      </span>
                      {renderRankInfo(stats.dbPlayer)}
                    </div>
                  </div>

                  {/* Matches Count */}
                  <div className="col-span-2 text-left md:text-center font-tech text-sm text-slate-300">
                    <span className="inline-block md:hidden text-[9px] font-pixel text-slate-500 mr-2 uppercase">
                      MATCHES:
                    </span>
                    {stats.matches} M
                  </div>

                  {/* W/L Record */}
                  <div className="col-span-2 text-left md:text-center font-tech text-sm">
                    <span className="inline-block md:hidden text-[9px] font-pixel text-slate-500 mr-2 uppercase">
                      RECORD:
                    </span>
                    <span className="text-[#00D2FF]">{stats.wins}W</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-[#FF2A5F]">{stats.losses}L</span>
                  </div>

                  {/* Interactive Win Rate & Progress Bar */}
                  <div className="col-span-2 text-left md:text-right flex md:flex-col items-start md:items-end justify-between md:justify-center gap-2">
                    <span className="inline-block md:hidden text-[9px] font-pixel text-slate-500 uppercase">
                      WIN RATE:
                    </span>
                    <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                      <span className="font-tech text-sm font-bold text-neon-yellow glow-yellow">
                        {stats.winrate.toFixed(1)}%
                      </span>
                      {/* visual glow progress bar */}
                      <div className="w-24 h-1.5 bg-slate-900 border border-slate-700 mt-1 overflow-hidden relative rounded-none">
                        <div
                          className="h-full bg-gradient-to-r from-neon-blue via-neon-yellow to-neon-yellow"
                          style={{ width: `${stats.winrate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
